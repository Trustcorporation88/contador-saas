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


def parse_nfe(xml_bytes: bytes, cnpj_empresa: str) -> MetadadosXml:
    root = ET.fromstring(xml_bytes)
    ns = {"nfe": "http://www.portalfiscal.inf.br/nfe"}

    inf = root.find(".//nfe:infNFe", ns) or root.find(".//{http://www.portalfiscal.inf.br/nfe}infNFe")
    chave = None
    if inf is not None:
        chave = inf.attrib.get("Id", "").replace("NFe", "") or None

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
        valor_total=float(_text(total)) if _text(total) else None,
        direcao=direcao,
        tipo_doc="nfe",
    )


def parse_nfse(xml_bytes: bytes, cnpj_empresa: str) -> MetadadosXml:
    root = ET.fromstring(xml_bytes)
    chave = None
    for tag in ("chNFSe", "ChaveAcesso", "CodigoVerificacao", "Numero"):
        el = root.find(f".//{tag}")
        if el is not None and el.text:
            chave = el.text.strip()
            break

    emit = root.find(".//Emitente//Cnpj") or root.find(".//Prestador//Cnpj")
    tom = root.find(".//Tomador//Cnpj") or root.find(".//TomadorServico//Cnpj")
    emit_cnpj = _only_digits(_text(emit))
    dest_cnpj = _only_digits(_text(tom))

    direcao = None
    if emit_cnpj == cnpj_empresa:
        direcao = "saida"
    elif dest_cnpj == cnpj_empresa:
        direcao = "entrada"

    valor_el = root.find(".//ValoresNfse//ValorLiquidoNfse") or root.find(".//ValorServicos")
    numero_el = root.find(".//Numero") or root.find(".//nNFSe")
    data_el = root.find(".//DataEmissao") or root.find(".//dhEmi")

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
