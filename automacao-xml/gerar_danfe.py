#!/usr/bin/env python3
"""Gera o DANFE em PDF a partir do XML AUTORIZADO da NF-e.

Por que este script existe: o sistema emitia a nota e entregava só o XML. O XML
não acompanha mercadoria — o que circula é o DANFE impresso. Sem ele a emissão
não servia para o dia a dia de quem vende.

REGRA CENTRAL, e é fiscal, não técnica: o DANFE só pode ser impresso a partir do
XML autorizado pela SEFAZ (o nfeProc, com protNFe e cStat 100 ou 150). O XML de
rascunho que o sistema guarda em nfe.xml_nfe NÃO é uma NF-e válida — vem
embrulhado em nfeProc sem protocolo, sem enderEmit e sem enderDest. Imprimir
DANFE a partir dele produziria um documento com aparência de nota fiscal e sem
nota fiscal por trás. Este script recusa.

A marca d'água "SEM VALOR FISCAL" em homologação é aplicada pela própria
biblioteca a partir do tpAmb=2 do XML — não precisamos pedir. Já a de
cancelamento depende do status no nosso banco (o XML autorizado continua
autorizado depois do cancelamento), então vem no payload.

Uso:
    python3 gerar_danfe.py payload.json

payload.json:
    {
      "xml":       "/caminho/do/nfeproc.xml",   (obrigatório)
      "saida":     "/caminho/do/danfe.pdf",     (obrigatório)
      "cancelada": false,                        (opcional)
      "logo":      "/caminho/logo.png"           (opcional)
    }

Saída: uma linha no stdout começando com DANFE_RESULT:, seguida do JSON.
O prefixo existe porque a biblioteca e suas dependências podem escrever avisos
no stdout; sem um marcador, o Node tentaria fazer parse do aviso.
"""

import json
import sys
import traceback

PREFIXO_RESULTADO = "DANFE_RESULT:"

# cStat de nota autorizada. 100 = autorizado; 150 = autorizado fora do prazo.
# Ambos são autorização válida e ambos imprimem DANFE.
CSTAT_AUTORIZADA = {"100", "150"}

NS_NFE = "http://www.portalfiscal.inf.br/nfe"


def _responder(dados: dict) -> None:
    print(PREFIXO_RESULTADO + json.dumps(dados, ensure_ascii=False))


def _texto(elemento) -> str:
    return (elemento.text or "").strip() if elemento is not None else ""


def validar_xml_autorizado(xml: str) -> dict:
    """Confere que o XML é um nfeProc autorizado.

    Devolve {"ok": True, "chave": ..., "cstat": ...} ou {"ok": False, "motivo": ...}.
    Roda ANTES de gerar qualquer PDF: recusar depois de escrever o arquivo
    deixaria um DANFE inválido no disco.
    """
    from lxml import etree

    try:
        raiz = etree.fromstring(xml.encode("utf-8") if isinstance(xml, str) else xml)
    except Exception as erro:  # XML corrompido ou truncado
        return {"ok": False, "motivo": f"XML ilegível: {erro}"}

    if etree.QName(raiz).localname != "nfeProc":
        return {
            "ok": False,
            "motivo": (
                "O XML não é um nfeProc (retorno autorizado da SEFAZ). "
                "O DANFE só pode ser impresso a partir da nota autorizada."
            ),
        }

    # O caminho é protNFe/infProt, e não .//infProt: um infProt solto em
    # qualquer lugar da árvore não é protocolo de autorização. Escrevi primeiro
    # com .//infProt e o teste negativo passou indevidamente — o elemento
    # continuava sendo encontrado sob outro pai.
    prot = raiz.find(f"{{{NS_NFE}}}protNFe/{{{NS_NFE}}}infProt")
    if prot is None:
        return {
            "ok": False,
            "motivo": (
                "XML sem protNFe: não há protocolo de autorização. "
                "Este é o rascunho, não a nota autorizada."
            ),
        }

    cstat = _texto(prot.find(f"{{{NS_NFE}}}cStat"))
    if cstat not in CSTAT_AUTORIZADA:
        motivo = _texto(prot.find(f"{{{NS_NFE}}}xMotivo"))
        return {
            "ok": False,
            "motivo": f"Nota não autorizada (cStat {cstat or 'ausente'}): {motivo or 'sem motivo'}",
        }

    # enderEmit e enderDest são obrigatórios no layout 4.00 e ausentes no nosso
    # rascunho. Se faltarem aqui, o XML não veio da SEFAZ, veio de outro lugar.
    if raiz.find(f".//{{{NS_NFE}}}enderEmit") is None:
        return {"ok": False, "motivo": "XML sem enderEmit — não é a nota autorizada."}

    return {
        "ok": True,
        "chave": _texto(prot.find(f"{{{NS_NFE}}}chNFe")),
        "cstat": cstat,
        "protocolo": _texto(prot.find(f"{{{NS_NFE}}}nProt")),
    }


def gerar(payload: dict) -> dict:
    caminho_xml = payload.get("xml")
    saida = payload.get("saida")
    if not caminho_xml:
        return {"ok": False, "motivo": "payload sem 'xml'"}
    if not saida:
        return {"ok": False, "motivo": "payload sem 'saida'"}

    try:
        with open(caminho_xml, "r", encoding="utf-8") as arquivo:
            xml = arquivo.read()
    except OSError as erro:
        return {"ok": False, "motivo": f"não foi possível ler o XML: {erro}"}

    validacao = validar_xml_autorizado(xml)
    if not validacao.get("ok"):
        return validacao

    from brazilfiscalreport.danfe import Danfe, DanfeConfig

    # watermark_cancelled é o nome real do campo em brazilfiscalreport 1.0.1 —
    # conferido por introspecção da dataclass, não suposto.
    config = DanfeConfig(watermark_cancelled=bool(payload.get("cancelada")))
    logo = payload.get("logo")
    if logo:
        config.logo = logo

    try:
        danfe = Danfe(xml=xml, config=config)
        danfe.output(saida)
    except Exception as erro:
        return {
            "ok": False,
            "motivo": f"falha ao renderizar o DANFE: {type(erro).__name__}: {erro}",
        }

    return {
        "ok": True,
        "arquivo": saida,
        "chave": validacao.get("chave"),
        "protocolo": validacao.get("protocolo"),
        "cancelada": bool(payload.get("cancelada")),
    }


def main() -> int:
    if len(sys.argv) < 2:
        _responder({"ok": False, "motivo": "uso: gerar_danfe.py payload.json"})
        return 2

    try:
        with open(sys.argv[1], "r", encoding="utf-8") as arquivo:
            payload = json.load(arquivo)
    except Exception as erro:
        _responder({"ok": False, "motivo": f"payload ilegível: {erro}"})
        return 2

    try:
        resultado = gerar(payload)
    except Exception as erro:
        # O traceback vai para stderr; o stdout fica só com o DANFE_RESULT.
        traceback.print_exc()
        resultado = {"ok": False, "motivo": f"erro inesperado: {type(erro).__name__}: {erro}"}

    _responder(resultado)
    return 0 if resultado.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
