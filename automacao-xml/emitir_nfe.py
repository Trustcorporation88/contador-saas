"""Emissão real de NF-e (modelo 55) via pynfe.

Uso:
    python emitir_nfe.py <caminho_payload.json>

O payload JSON contém: ambiente, certificado, emitente, destinatário, itens,
pagamento e totais. O script monta a NotaFiscal, assina com o certificado A1,
transmite à SEFAZ (autorização síncrona) e imprime o resultado como JSON na
saída padrão, prefixado por 'NFE_RESULT:' para leitura confiável pelo backend.

SEGURANÇA: por padrão emite em HOMOLOGAÇÃO (ambiente de teste, sem valor
fiscal). Produção só quando ambiente == "producao" explicitamente.
"""
from __future__ import annotations

import json
import sys
import traceback
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP


RESULT_PREFIX = "NFE_RESULT:"
HOMOLOG_DEST_NOME = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"


def _dec(value, casas: int = 2) -> Decimal:
    q = Decimal(10) ** -casas
    return Decimal(str(value or 0)).quantize(q, rounding=ROUND_HALF_UP)


def _digits(value) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _construir_nota(payload: dict):
    """Monta a NotaFiscal pynfe a partir do payload e retorna (nota, totais)."""
    from pynfe.entidades.emitente import Emitente
    from pynfe.entidades.cliente import Cliente
    from pynfe.entidades.notafiscal import NotaFiscal
    from pynfe.entidades.fonte_dados import _fonte_dados

    ambiente = str(payload.get("ambiente", "homologacao")).lower()
    homologacao = ambiente != "producao"

    emit = payload["emitente"]
    dest = payload["destinatario"]
    itens = payload["itens"]
    modelo = int(payload.get("modelo", 55))
    serie = str(payload.get("serie", 1))
    numero = str(payload["numero"])
    uf = str(emit["uf"]).upper()

    # Limpa qualquer resíduo da fonte de dados global (execuções anteriores)
    _fonte_dados.limpar_dados()

    emitente = Emitente(
        razao_social=emit["razao_social"],
        nome_fantasia=emit.get("nome_fantasia") or emit["razao_social"],
        cnpj=_digits(emit["cnpj"]),
        codigo_de_regime_tributario=str(emit.get("crt", "1")),
        inscricao_estadual=_digits(emit.get("inscricao_estadual")) or "ISENTO",
        inscricao_municipal=emit.get("inscricao_municipal", ""),
        endereco_logradouro=emit["logradouro"],
        endereco_numero=str(emit.get("numero", "S/N")),
        endereco_complemento=emit.get("complemento", ""),
        endereco_bairro=emit["bairro"],
        endereco_municipio=emit["municipio"],
        endereco_uf=uf,
        endereco_cep=_digits(emit["cep"]),
        endereco_pais="1058",
        endereco_cod_municipio=str(emit["cod_municipio"]),
        endereco_telefone=_digits(emit.get("telefone")),
    )

    dest_doc = _digits(dest["numero_documento"])
    dest_nome = HOMOLOG_DEST_NOME if homologacao else dest["razao_social"]
    cliente = Cliente(
        razao_social=dest_nome,
        tipo_documento="CNPJ" if len(dest_doc) == 14 else "CPF",
        numero_documento=dest_doc,
        indicador_ie=int(dest.get("indicador_ie", 9)),
        inscricao_estadual=_digits(dest.get("inscricao_estadual")),
        endereco_logradouro=dest["logradouro"],
        endereco_numero=str(dest.get("numero", "S/N")),
        endereco_complemento=dest.get("complemento", ""),
        endereco_bairro=dest["bairro"],
        endereco_municipio=dest["municipio"],
        endereco_uf=str(dest["uf"]).upper(),
        endereco_cep=_digits(dest["cep"]),
        endereco_pais="1058",
        endereco_cod_municipio=str(dest["cod_municipio"]),
        endereco_telefone=_digits(dest.get("telefone")),
    )

    nota = NotaFiscal(
        emitente=emitente,
        cliente=cliente,
        uf=uf,
        natureza_operacao=payload.get("natureza_operacao", "VENDA"),
        modelo=modelo,
        serie=serie,
        numero_nf=numero,
        data_emissao=datetime.now(),
        data_saida_entrada=datetime.now(),
        tipo_documento=1,            # 1 = saída
        municipio=str(emit["cod_municipio"]),
        tipo_impressao_danfe=1,      # 1 = DANFE normal retrato
        forma_emissao="1",           # 1 = normal
        cliente_final=int(payload.get("cliente_final", 1)),
        indicador_destino=int(payload.get("indicador_destino", 1)),
        indicador_presencial=int(payload.get("indicador_presencial", 1)),
        finalidade_emissao=int(payload.get("finalidade_emissao", 1)),
        processo_emissao=0,
        transporte_modalidade_frete=int(payload.get("modalidade_frete", 9)),
        informacoes_adicionais_interesse_fisco=payload.get("info_fisco", ""),
        informacoes_complementares_interesse_contribuinte=payload.get("info_adicional", ""),
        totais_tributos_aproximado=_dec(payload.get("tributos_aproximado", 0)),
    )

    total_produtos = Decimal("0")
    for item in itens:
        qtd = Decimal(str(item["quantidade"]))
        vun = Decimal(str(item["valor_unitario"]))
        bruto = _dec(qtd * vun)
        total_produtos += bruto

        icms_mod = str(item.get("icms_modalidade", "102"))
        icms_aliq = Decimal(str(item.get("icms_aliquota", 0)))
        icms_bc = bruto if icms_mod in ("00", "10", "20", "70") else Decimal("0")
        icms_valor = _dec(icms_bc * icms_aliq / 100)

        pis_mod = str(item.get("pis_modalidade", "07"))
        pis_aliq = Decimal(str(item.get("pis_aliquota", 0)))
        cofins_mod = str(item.get("cofins_modalidade", "07"))
        cofins_aliq = Decimal(str(item.get("cofins_aliquota", 0)))

        nota.adicionar_produto_servico(
            codigo=str(item["codigo"]),
            descricao=item["descricao"],
            ncm=_digits(item.get("ncm")) or "00000000",
            cfop=str(item["cfop"]),
            unidade_comercial=item.get("unidade", "UN"),
            quantidade_comercial=qtd,
            valor_unitario_comercial=vun,
            unidade_tributavel=item.get("unidade", "UN"),
            quantidade_tributavel=qtd,
            valor_unitario_tributavel=vun,
            valor_total_bruto=bruto,
            compoe_valor_total=1,
            ind_total=1,
            icms_modalidade=icms_mod,
            icms_origem=int(item.get("icms_origem", 0)),
            icms_csosn=icms_mod if len(icms_mod) == 3 else "",
            icms_credito=Decimal(str(item.get("icms_credito", 0))),
            icms_modalidade_determinacao_bc=3,
            icms_valor_base_calculo=icms_bc,
            icms_aliquota=icms_aliq,
            icms_valor=icms_valor,
            valor_tributos_aprox=Decimal(str(item.get("tributos_aprox", 0))),
            pis_modalidade=pis_mod,
            pis_valor_base_calculo=bruto if pis_aliq else Decimal("0"),
            pis_aliquota_percentual=pis_aliq,
            pis_valor=_dec(bruto * pis_aliq / 100),
            cofins_modalidade=cofins_mod,
            cofins_valor_base_calculo=bruto if cofins_aliq else Decimal("0"),
            cofins_aliquota_percentual=cofins_aliq,
            cofins_valor=_dec(bruto * cofins_aliq / 100),
        )

    valor_frete = _dec(payload.get("frete", 0))
    valor_desconto = _dec(payload.get("desconto", 0))
    valor_pago = _dec(total_produtos + valor_frete - valor_desconto)

    nota.adicionar_pagamento(
        t_pag=str(payload.get("forma_pagamento", "01")),
        v_pag=valor_pago,
        ind_pag=int(payload.get("indicador_pagamento", 0)),
    )

    return nota, {"total_produtos": total_produtos, "valor_pago": valor_pago}


def montar_xml(payload: dict, retorna_string: bool = False):
    """Monta a nota e serializa (sem assinar). Útil para validação offline."""
    from pynfe.entidades.fonte_dados import _fonte_dados
    from pynfe.processamento.serializacao import SerializacaoXML

    homologacao = str(payload.get("ambiente", "homologacao")).lower() != "producao"
    _construir_nota(payload)
    serializador = SerializacaoXML(_fonte_dados, homologacao=homologacao)
    return serializador.exportar(retorna_string=retorna_string)


def _emitir(payload: dict) -> dict:
    from pynfe.processamento.assinatura import AssinaturaA1
    from pynfe.processamento.comunicacao import ComunicacaoSefaz
    from pynfe.utils.flags import NAMESPACE_NFE
    from lxml import etree

    ambiente = str(payload.get("ambiente", "homologacao")).lower()
    homologacao = ambiente != "producao"
    cert_path = payload["cert_path"]
    cert_senha = payload["cert_senha"]
    modelo = int(payload.get("modelo", 55))
    uf = str(payload["emitente"]["uf"]).upper()

    # Serialização -> assinatura -> transmissão
    xml = montar_xml(payload)

    assinatura = AssinaturaA1(cert_path, cert_senha)
    xml_assinado = assinatura.assinar(xml)

    con = ComunicacaoSefaz(uf, cert_path, cert_senha, homologacao)
    envio = con.autorizacao(modelo=modelo, nota_fiscal=xml_assinado)

    ns = {"ns": NAMESPACE_NFE}
    status = envio[0]
    resultado: dict = {"ambiente": ambiente}

    if status == 0 and hasattr(envio[1], "xpath"):
        # Sucesso síncrono: envio[1] é o nfeProc (NFe + protNFe)
        proc = envio[1]
        xml_proc = etree.tostring(proc, encoding="unicode")
        inf_prot = proc.xpath(".//ns:protNFe/ns:infProt", namespaces=ns)
        cstat = inf_prot[0].xpath("ns:cStat/text()", namespaces=ns) if inf_prot else []
        xmotivo = inf_prot[0].xpath("ns:xMotivo/text()", namespaces=ns) if inf_prot else []
        nprot = inf_prot[0].xpath("ns:nProt/text()", namespaces=ns) if inf_prot else []
        chave = inf_prot[0].xpath("ns:chNFe/text()", namespaces=ns) if inf_prot else []
        dhrecbto = inf_prot[0].xpath("ns:dhRecbto/text()", namespaces=ns) if inf_prot else []
        cstat_val = cstat[0] if cstat else ""
        resultado.update({
            "ok": cstat_val in ("100", "150"),
            "cStat": cstat_val,
            "motivo": xmotivo[0] if xmotivo else "",
            "protocolo": nprot[0] if nprot else "",
            "chave": chave[0] if chave else "",
            "dhRecbto": dhrecbto[0] if dhrecbto else "",
            "xml_proc": xml_proc,
        })
    else:
        # Falha: envio[1] é o objeto de resposta HTTP; tenta extrair cStat/xMotivo
        retorno = envio[1]
        texto = getattr(retorno, "text", str(retorno))
        cstat_val = ""
        motivo = ""
        try:
            root = etree.fromstring(texto.encode("utf-8"))
            cs = root.xpath("//ns:cStat/text()", namespaces=ns)
            xm = root.xpath("//ns:xMotivo/text()", namespaces=ns)
            cstat_val = cs[0] if cs else ""
            motivo = xm[0] if xm else ""
        except Exception:
            motivo = texto[:500]
        resultado.update({
            "ok": False,
            "cStat": cstat_val,
            "motivo": motivo or "Falha na transmissão à SEFAZ",
            "protocolo": "",
            "chave": "",
            "raw": texto[:1000],
        })

    return resultado


def main() -> int:
    if len(sys.argv) < 2:
        print(RESULT_PREFIX + json.dumps({"ok": False, "motivo": "payload não informado"}))
        return 2

    try:
        with open(sys.argv[1], "r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except Exception as exc:
        print(RESULT_PREFIX + json.dumps({"ok": False, "motivo": f"payload inválido: {exc}"}))
        return 2

    try:
        resultado = _emitir(payload)
    except Exception as exc:
        traceback.print_exc()
        print(RESULT_PREFIX + json.dumps({"ok": False, "motivo": f"erro na emissão: {exc}"}))
        return 1

    print(RESULT_PREFIX + json.dumps(resultado, ensure_ascii=False))
    return 0 if resultado.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
