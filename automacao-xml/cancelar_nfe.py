"""Cancelamento real de NF-e via evento SEFAZ (tpEvento 110111) usando pynfe.

Uso:
    python cancelar_nfe.py <caminho_payload.json>

O payload JSON contém: ambiente, cert_path, cert_senha, uf, cnpj, chave,
protocolo (da autorização original), justificativa, modelo (opcional, padrão
55) e n_seq_evento (opcional, padrão 1).

Monta o evento de cancelamento, assina com o certificado A1 e transmite à
SEFAZ. Imprime o resultado como JSON na saída padrão, prefixado por
'NFE_CANCEL_RESULT:' para leitura confiável pelo backend.

SEGURANÇA: por padrão opera em HOMOLOGAÇÃO (ambiente de teste, sem valor
fiscal). Produção só quando ambiente == "producao" explicitamente.

IMPORTANTE: este script realiza um cancelamento DE VERDADE junto à SEFAZ.
Não existe simulação aqui — se a nota já estiver autorizada em produção, o
cancelamento também será registrado em produção, de forma definitiva.
"""
from __future__ import annotations

import json
import sys
import traceback
from datetime import datetime


RESULT_PREFIX = "NFE_CANCEL_RESULT:"


def _digits(value) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _cancelar(payload: dict) -> dict:
    from pynfe.entidades.evento import EventoCancelarNota
    from pynfe.entidades.fonte_dados import _fonte_dados
    from pynfe.processamento.assinatura import AssinaturaA1
    from pynfe.processamento.comunicacao import ComunicacaoSefaz
    from pynfe.processamento.serializacao import SerializacaoXML
    from pynfe.utils.flags import NAMESPACE_NFE
    from lxml import etree

    from common.nfe_utils import modelo_pynfe

    ambiente = str(payload.get("ambiente", "homologacao")).lower()
    homologacao = ambiente != "producao"
    cert_path = payload["cert_path"]
    cert_senha = payload["cert_senha"]
    uf = str(payload["uf"]).upper()
    cnpj = _digits(payload["cnpj"])
    chave = _digits(payload["chave"])
    protocolo = str(payload["protocolo"]).strip()
    justificativa = str(payload["justificativa"]).strip()
    modelo_raw = payload.get("modelo", 55)
    modelo = modelo_pynfe(modelo_raw)
    n_seq_evento = int(payload.get("n_seq_evento", 1))

    if len(chave) != 44:
        raise ValueError(f"Chave de acesso inválida: precisa ter 44 dígitos, recebeu {len(chave)}.")
    if not protocolo:
        raise ValueError("Protocolo de autorização da NF-e é obrigatório para o cancelamento.")
    if len(justificativa) < 15:
        raise ValueError("Justificativa deve ter no mínimo 15 caracteres.")

    _fonte_dados.limpar_dados()

    evento = EventoCancelarNota(
        cnpj=cnpj,
        chave=chave,
        data_emissao=datetime.now(),
        uf=uf,
        protocolo=protocolo,
        justificativa=justificativa,
        n_seq_evento=n_seq_evento,
    )

    serializador = SerializacaoXML(_fonte_dados, homologacao=homologacao)
    xml_evento = serializador.serializar_evento(evento, tag_raiz="evento")

    assinatura = AssinaturaA1(cert_path, cert_senha)
    xml_assinado = assinatura.assinar(xml_evento)

    con = ComunicacaoSefaz(uf, cert_path, cert_senha, homologacao)
    resposta = con.evento(modelo=modelo, evento=xml_assinado)

    ns = {"ns": NAMESPACE_NFE}
    texto = getattr(resposta, "text", None) or str(resposta)
    resultado: dict = {"ambiente": ambiente}

    try:
        root = etree.fromstring(texto.encode("utf-8") if isinstance(texto, str) else texto)
        # XPath absoluto (sem "." inicial): funciona tanto se `root` for o
        # próprio <retEvento> quanto se vier envolvido em outro elemento —
        # com ".//" o retEvento raiz nunca seria encontrado (só descendentes).
        inf_evento = root.xpath("//ns:infEvento", namespaces=ns)
        base = inf_evento[0] if inf_evento else root
        cstat = base.xpath("ns:cStat/text()", namespaces=ns)
        xmotivo = base.xpath("ns:xMotivo/text()", namespaces=ns)
        nprot = base.xpath("ns:nProt/text()", namespaces=ns)
        dhregevento = base.xpath("ns:dhRegEvento/text()", namespaces=ns)
        cstat_val = cstat[0] if cstat else ""
        # 135 = evento registrado e vinculado à NF-e; 155 = cancelamento extemporâneo registrado.
        resultado.update({
            "ok": cstat_val in ("135", "155"),
            "cStat": cstat_val,
            "motivo": xmotivo[0] if xmotivo else "",
            "protocolo": nprot[0] if nprot else "",
            "dhRegEvento": dhregevento[0] if dhregevento else "",
            "chave": chave,
            "xml_evento": etree.tostring(root, encoding="unicode"),
        })
    except Exception as exc:
        resultado.update({
            "ok": False,
            "cStat": "",
            "motivo": f"Falha ao interpretar retorno da SEFAZ: {exc}",
            "protocolo": "",
            "chave": chave,
            "raw": texto[:1000] if isinstance(texto, str) else str(texto)[:1000],
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
        resultado = _cancelar(payload)
    except Exception as exc:
        traceback.print_exc()
        print(RESULT_PREFIX + json.dumps({"ok": False, "motivo": f"erro no cancelamento: {exc}"}))
        return 1

    print(RESULT_PREFIX + json.dumps(resultado, ensure_ascii=False))
    return 0 if resultado.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
