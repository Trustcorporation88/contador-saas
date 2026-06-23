"""Sincronização NF-e (produto/comércio) via Distribuição DFe — SEFAZ."""
from __future__ import annotations

import base64
import gzip
import xml.etree.ElementTree as ET
from dataclasses import dataclass

from common.certificates import alerta_expiracao
from common.config import EmpresaConfig, homologacao
from common.db import get_cursor, registrar_captura, save_cursor
from common.storage import hash_xml, salvar_xml
from common.xml_parser import parse_nfe


NS = {"ns": "http://www.portalfiscal.inf.br/nfe"}


@dataclass
class SyncResult:
    capturados: int
    ultimo_nsu: str
    alerta_certificado: str | None = None


def _decode_doc_zip(texto: str) -> bytes:
    raw = base64.b64decode(texto.strip())
    try:
        return gzip.decompress(raw)
    except OSError:
        return raw


def sync_empresa_nfe(empresa: EmpresaConfig, company_id: str | None = None) -> SyncResult:
    company_id = company_id or empresa.company_id or empresa.cnpj
    alerta = alerta_expiracao(empresa.pfx, empresa.senha)

    try:
        from pynfe.processamento.comunicacao import ComunicacaoSefaz
    except ImportError as exc:
        raise RuntimeError("Instale pynfe: pip install -r requirements.txt") from exc

    con = ComunicacaoSefaz(
        uf=empresa.uf.lower(),
        certificado=empresa.pfx,
        senha=empresa.senha,
        homologacao=homologacao(),
    )

    nsu = get_cursor(company_id, "nfe")
    capturados = 0

    while True:
        resposta = con.consulta_distribuicao(
            cnpj=empresa.cnpj,
            chave="",
            nsu=int(nsu),
            consulta_nsu_especifico=False,
        )
        root = ET.fromstring(resposta.text)
        docs = root.findall(".//ns:docZip", NS)

        if not docs:
            break

        for doc in docs:
            chave = doc.attrib.get("NSU") or doc.attrib.get("chNFe") or doc.attrib.get("schema", "doc")
            if doc.text:
                xml_bytes = _decode_doc_zip(doc.text)
                chave_arquivo = doc.attrib.get("chNFe") or chave
                path = salvar_xml(empresa.cnpj, chave_arquivo, xml_bytes)
                meta = parse_nfe(xml_bytes, empresa.cnpj)
                if meta.chave:
                    chave_arquivo = meta.chave
                if registrar_captura(company_id, meta, str(path), hash_xml(xml_bytes)):
                    capturados += 1

        ultimo_nsu = root.findtext(".//ns:ultNSU", namespaces=NS) or nsu
        max_nsu = root.findtext(".//ns:maxNSU", namespaces=NS)
        save_cursor(company_id, "nfe", ultimo_nsu)
        nsu = ultimo_nsu

        if len(docs) < 50:
            break
        if max_nsu and ultimo_nsu >= max_nsu:
            break

    save_cursor(company_id, "nfe", nsu, status="ok")
    return SyncResult(capturados=capturados, ultimo_nsu=nsu, alerta_certificado=alerta)
