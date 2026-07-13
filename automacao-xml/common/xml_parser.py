"""Extração de metadados de NF-e e NFS-e."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date
from typing import Any


@dataclass
class MetadadosXml:
    chave: str
    modelo: str | None
    numero: str | None
    serie: str | None
    data_emissao: date | None
    emitente_cnpj: str | None
    destinatario_cnpj: str | None
    valor_total: float | None
    direcao: str | None
    tipo_doc: str


def _text(el: ET.Element | None) -> str | None:
    if el is None or el.text is None:
        return None
    return el.text.strip()


def _first(*elements: ET.Element | None) -> ET.Element | None:
    """Retorna o primeiro elemento nao-nulo.

    Necessario porque em ElementTree um elemento sem filhos avalia como
    ``False`` num ``or``, fazendo folhas (vLiq, nNFSe, dhProc) caírem no
    fallback e virarem ``None``.
    """
    for el in elements:
        if el is not None:
            return el
    return None


def _only_digits(value: str | None) -> str | None:
    if not value:
        return None
    digits = "".join(c for c in value if c.isdigit())
    return digits or None


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    value = value[:10]
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _num_from_float(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _dados_da_chave(chave: str) -> tuple[str | None, str | None, str | None]:
    """Extrai (modelo, serie, numero) de uma chave de acesso NF-e de 44 digitos.

    Layout: cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1).
    """
    digits = _only_digits(chave) or ""
    if len(digits) != 44:
        return None, None, None
    modelo = digits[20:22]
    serie = digits[22:25].lstrip("0") or "0"
    numero = digits[25:34].lstrip("0") or "0"
    return modelo, serie, numero


def parse_nfe(xml_bytes: bytes, cnpj_empresa: str) -> MetadadosXml:
    root = ET.fromstring(xml_bytes)
    ns = {"nfe": "http://www.portalfiscal.inf.br/nfe"}
    ns_uri = "http://www.portalfiscal.inf.br/nfe"

    def achar(localname: str) -> ET.Element | None:
        """Localiza por nome local considerando a propria raiz e descendentes,
        com e sem namespace (docZip pode ter resNFe/resEvento como raiz)."""
        for tag in (f"{{{ns_uri}}}{localname}", localname):
            if root.tag == tag:
                return root
            found = root.find(f".//{tag}")
            if found is not None:
                return found
        return None

    inf = achar("infNFe")

    if inf is not None:
        chave = _only_digits(inf.attrib.get("Id", "").replace("NFe", "")) or None

        ide = root.find(".//nfe:ide", ns)
        emit = root.find(".//nfe:emit", ns)
        dest = root.find(".//nfe:dest", ns)
        total = root.find(".//nfe:ICMSTot/nfe:vNF", ns)

        emit_cnpj = _only_digits(_text(emit.find("nfe:CNPJ", ns)) if emit is not None else None)
        dest_cnpj = _only_digits(_text(dest.find("nfe:CNPJ", ns)) if dest is not None else None)

        direcao = None
        if emit_cnpj == cnpj_empresa:
            direcao = "saida"
        elif dest_cnpj == cnpj_empresa:
            direcao = "entrada"

        return MetadadosXml(
            chave=chave or "",
            modelo=_text(ide.find("nfe:mod", ns)) if ide is not None else None,
            numero=_text(ide.find("nfe:nNF", ns)) if ide is not None else None,
            serie=_text(ide.find("nfe:serie", ns)) if ide is not None else None,
            data_emissao=_parse_date(_text(ide.find("nfe:dhEmi", ns)) if ide is not None else None),
            emitente_cnpj=emit_cnpj,
            destinatario_cnpj=dest_cnpj,
            valor_total=_num_from_float(_text(total)),
            direcao=direcao,
            tipo_doc="nfe",
        )

    # Resumo de NF-e (resNFe): documento recebido antes/sem a NF-e completa.
    res = achar("resNFe")
    if res is not None:
        def rf(name: str) -> ET.Element | None:
            return _first(res.find(f"nfe:{name}", ns), res.find(name))

        chave = _only_digits(_text(rf("chNFe"))) or ""
        emit_cnpj = _only_digits(_text(rf("CNPJ")) or _text(rf("CPF")))
        modelo, serie, numero = _dados_da_chave(chave)
        # No resumo a empresa e sempre a parte interessada (destinataria) => compra,
        # a menos que ela propria seja a emitente.
        direcao = "saida" if emit_cnpj and emit_cnpj == cnpj_empresa else "entrada"
        return MetadadosXml(
            chave=chave,
            modelo=modelo,
            numero=numero,
            serie=serie,
            data_emissao=_parse_date(_text(rf("dhEmi"))),
            emitente_cnpj=emit_cnpj,
            destinatario_cnpj=None if direcao == "saida" else _only_digits(cnpj_empresa),
            valor_total=_num_from_float(_text(rf("vNF"))),
            direcao=direcao,
            tipo_doc="nfe_resumo",
        )

    # Eventos (resEvento / procEventoNFe) — nao sao notas; retorna chave se houver.
    chave_evt = _only_digits(_text(achar("chNFe"))) or ""
    return MetadadosXml(
        chave=chave_evt,
        modelo=None,
        numero=None,
        serie=None,
        data_emissao=None,
        emitente_cnpj=None,
        destinatario_cnpj=None,
        valor_total=None,
        direcao=None,
        tipo_doc="nfe_evento",
    )


def parse_nfse(xml_bytes: bytes, cnpj_empresa: str) -> MetadadosXml:
    root = ET.fromstring(xml_bytes)
    ns_uri = "http://www.sped.fazenda.gov.br/nfse"

    def q(tag: str) -> str:
        return f"{{{ns_uri}}}{tag}"

    inf_nfse = root.find(f".//{q('infNFSe')}")

    chave = None
    if inf_nfse is not None:
        raw_id = inf_nfse.attrib.get("Id", "")
        chave = raw_id.replace("NFS", "").replace("NFSe", "")
        chave = "".join(c for c in chave if c.isdigit()) or raw_id or None

    if not chave:
        for tag in ("chNFSe", "ChaveAcesso", "CodigoVerificacao"):
            el = _first(root.find(f".//{tag}"), root.find(f".//{q(tag)}"))
            if el is not None and el.text:
                chave = el.text.strip()
                break

    emit = _first(root.find(f".//{q('emit')}"), root.find(".//Emitente//Cnpj"))
    tom = _first(root.find(f".//{q('toma')}"), root.find(".//Tomador//Cnpj"))

    emit_cnpj_el = emit.find(q("CNPJ")) if emit is not None else None
    tom_cnpj_el = tom.find(q("CNPJ")) if tom is not None else None
    emit_cnpj = _only_digits(_text(emit_cnpj_el) or _text(emit))
    dest_cnpj = _only_digits(_text(tom_cnpj_el) or _text(tom))

    direcao = None
    if emit_cnpj == cnpj_empresa:
        direcao = "saida"
    elif dest_cnpj == cnpj_empresa:
        direcao = "entrada"

    valor_el = _first(
        root.find(f".//{q('valores')}/{q('vLiq')}"),
        root.find(f".//{q('vServPrest')}/{q('vServ')}"),
        root.find(f".//{q('vServ')}"),
        root.find(".//ValoresNfse//ValorLiquidoNfse"),
        root.find(".//ValorServicos"),
    )
    numero_el = _first(
        root.find(f".//{q('nNFSe')}"),
        root.find(f".//{q('nDFSe')}"),
        root.find(".//Numero"),
    )
    data_el = _first(
        root.find(f".//{q('dhProc')}"),
        root.find(f".//{q('dhEmi')}"),
        root.find(".//DataEmissao"),
    )

    return MetadadosXml(
        chave=chave or "",
        modelo="NFSe",
        numero=_text(numero_el),
        serie=None,
        data_emissao=_parse_date(_text(data_el)),
        emitente_cnpj=emit_cnpj,
        destinatario_cnpj=dest_cnpj,
        valor_total=float(_text(valor_el)) if _text(valor_el) else None,
        direcao=direcao,
        tipo_doc="nfse",
    )


def metadados_para_dict(meta: MetadadosXml) -> dict[str, Any]:
    return {
        "chave": meta.chave,
        "modelo": meta.modelo,
        "numero": meta.numero,
        "serie": meta.serie,
        "data_emissao": meta.data_emissao.isoformat() if meta.data_emissao else None,
        "emitente_cnpj": meta.emitente_cnpj,
        "destinatario_cnpj": meta.destinatario_cnpj,
        "valor_total": meta.valor_total,
        "direcao": meta.direcao,
        "tipo_doc": meta.tipo_doc,
    }
