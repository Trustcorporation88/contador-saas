#!/usr/bin/env python3
"""Manifestação do Destinatário — o que destrava o XML completo das notas de entrada.

POR QUE ISSO EXISTE
-------------------
A Distribuição DFe entrega, para nota emitida CONTRA o CNPJ do cliente, apenas o
RESUMO (resNFe): chave, CNPJ do emitente, valor, data. Sem itens, sem NCM, sem
CFOP, sem impostos. Serve para saber que a nota existe — não serve para
escriturar.

Em 12/08/2026 a captura desta empresa trouxe 8 documentos, TODOS resumo. O XML
completo (procNFe) só é liberado pela SEFAZ depois que o destinatário se
manifesta. Sem este passo, a captura é um mural de avisos.

QUAL EVENTO, E POR QUE SÓ ESTE
------------------------------
Este script envia SOMENTE o 210210 — Ciência da Operação.

É deliberado. Dos quatro eventos de manifestação, ele é o único que não afirma
nada sobre o negócio: diz apenas "tomei conhecimento de que esta nota existe".
Basta para liberar o download do XML.

Os outros três são declarações de conteúdo, e IRREVERSÍVEIS:

  210200 Confirmação da Operação    — afirma que a operação ocorreu
  210220 Desconhecimento            — afirma que a empresa não reconhece a nota
  210240 Operação não Realizada     — afirma que a operação foi desfeita

Nenhum deles pode ser cancelado depois de registrado, e o 210200 impede o
cancelamento da nota pelo emitente. Automatizar isso seria o sistema declarando
fato fiscal no lugar do contador. Quem confirma operação é gente, com o
documento na mão — não um botão de sincronizar.

O AMBIENTE NACIONAL
-------------------
Manifestação não vai para a SEFAZ estadual: vai para o Ambiente Nacional. Duas
consequências, e as duas a pynfe 0.6.5 já trata:

  - cOrgao = 91 (AN), obtido passando uf="AN" ao evento, porque
    CODIGOS_ESTADOS["AN"] == "91";
  - a URL do webservice é a do AN, escolhida por ComunicacaoSefaz.evento() ao
    ver que o tpEvento começa com "2".

Uso:
    python3 manifestar_nfe.py payload.json

payload.json:
    {
      "cert_path": "/caminho/cert.pfx",
      "cert_senha": "...",
      "uf": "SP",                 (UF do destinatário, para a comunicação)
      "cnpj": "60526634000104",   (CNPJ de quem manifesta = o destinatário)
      "chave": "3526...",         (44 dígitos)
      "ambiente": "homologacao",
      "modelo": 55,
      "n_seq_evento": 1
    }

Saída: uma linha no stdout começando com MANIFEST_RESULT:, seguida do JSON.
"""

import json
import sys
import traceback
from datetime import datetime

PREFIXO_RESULTADO = "MANIFEST_RESULT:"

# Só a Ciência da Operação. Ver o cabeçalho para o motivo.
TP_EVENTO_CIENCIA = "210210"
OPERACAO_CIENCIA = 2  # índice que a pynfe usa para 210210

# 135 = evento registrado e vinculado à NF-e.
# 573 = duplicidade de evento: já manifestado antes. Para Ciência da Operação
#       isso é resultado ACEITÁVEL — o objetivo (liberar o XML) já está atingido,
#       e tratar como erro faria o usuário tentar de novo à toa.
CSTAT_OK = {"135"}
CSTAT_JA_MANIFESTADO = {"573"}


def _responder(dados: dict) -> None:
    print(PREFIXO_RESULTADO + json.dumps(dados, ensure_ascii=False))


def _digits(valor) -> str:
    return "".join(ch for ch in str(valor or "") if ch.isdigit())


def manifestar(payload: dict) -> dict:
    from pynfe.entidades.evento import EventoManifestacaoDest
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
    uf_destinatario = str(payload["uf"]).upper()
    cnpj = _digits(payload["cnpj"])
    chave = _digits(payload["chave"])
    modelo = modelo_pynfe(payload.get("modelo", 55))
    n_seq_evento = int(payload.get("n_seq_evento", 1))

    if len(chave) != 44:
        raise ValueError(
            f"Chave de acesso inválida: precisa ter 44 dígitos, recebeu {len(chave)}."
        )
    if len(cnpj) not in (11, 14):
        raise ValueError(f"CNPJ/CPF do destinatário inválido: {cnpj!r}")

    _fonte_dados.limpar_dados()

    # uf="AN" faz o cOrgao sair 91 (Ambiente Nacional). Não é a UF da empresa —
    # é o órgão que RECEBE o evento, e manifestação é sempre nacional.
    evento = EventoManifestacaoDest(
        cnpj=cnpj,
        chave=chave,
        data_emissao=datetime.now(),
        uf="AN",
        operacao=OPERACAO_CIENCIA,
        n_seq_evento=n_seq_evento,
    )

    if evento.tp_evento != TP_EVENTO_CIENCIA:
        # Trava de sanidade. Se uma versão futura da pynfe remapear os índices de
        # operação, este script passaria a enviar Confirmação da Operação — que é
        # irreversível — sem ninguém perceber. Melhor abortar.
        raise RuntimeError(
            f"Esperava tpEvento {TP_EVENTO_CIENCIA} (Ciência da Operação), "
            f"a pynfe montou {evento.tp_evento}. Abortado por segurança."
        )

    serializador = SerializacaoXML(_fonte_dados, homologacao=homologacao)
    xml_evento = serializador.serializar_evento(evento, tag_raiz="evento")

    assinatura = AssinaturaA1(cert_path, cert_senha)
    xml_assinado = assinatura.assinar(xml_evento)

    con = ComunicacaoSefaz(uf_destinatario, cert_path, cert_senha, homologacao)
    resposta = con.evento(modelo=modelo, evento=xml_assinado)

    ns = {"ns": NAMESPACE_NFE}
    texto = getattr(resposta, "text", None) or str(resposta)
    resultado: dict = {"ambiente": ambiente, "chave": chave, "tp_evento": TP_EVENTO_CIENCIA}

    try:
        root = etree.fromstring(
            texto.encode("utf-8") if isinstance(texto, str) else texto
        )
        # XPath absoluto: funciona com <retEvento> na raiz ou envolvido, o que
        # "//" resolve e ".//" não (este último só olha descendentes).
        inf = root.xpath("//ns:infEvento", namespaces=ns)
        base = inf[0] if inf else root
        cstat = (base.xpath("ns:cStat/text()", namespaces=ns) or [""])[0]
        motivo = (base.xpath("ns:xMotivo/text()", namespaces=ns) or [""])[0]
        nprot = (base.xpath("ns:nProt/text()", namespaces=ns) or [""])[0]
        dh = (base.xpath("ns:dhRegEvento/text()", namespaces=ns) or [""])[0]

        ja_estava = cstat in CSTAT_JA_MANIFESTADO
        resultado.update({
            "ok": cstat in CSTAT_OK or ja_estava,
            "ja_manifestado": ja_estava,
            "cStat": cstat,
            "motivo": motivo,
            "protocolo": nprot,
            "dhRegEvento": dh,
            "xml_evento": etree.tostring(root, encoding="unicode"),
        })
    except Exception as exc:
        resultado.update({
            "ok": False,
            "cStat": "",
            "motivo": f"Falha ao interpretar retorno da SEFAZ: {exc}",
            "protocolo": "",
            "bruto": texto[:800] if isinstance(texto, str) else "",
        })

    return resultado


def main() -> int:
    if len(sys.argv) < 2:
        _responder({"ok": False, "motivo": "uso: manifestar_nfe.py payload.json"})
        return 2

    try:
        with open(sys.argv[1], "r", encoding="utf-8") as arquivo:
            payload = json.load(arquivo)
    except Exception as exc:
        _responder({"ok": False, "motivo": f"payload ilegível: {exc}"})
        return 2

    try:
        resultado = manifestar(payload)
    except Exception as exc:
        traceback.print_exc()
        resultado = {
            "ok": False,
            "motivo": f"{type(exc).__name__}: {exc}",
        }

    _responder(resultado)
    return 0 if resultado.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
