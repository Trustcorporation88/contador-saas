"""Sincronização NFS-e via Portal Nacional (mTLS com certificado A1)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin

import requests
from requests_pkcs12 import Pkcs12Adapter

from common.certificates import alerta_expiracao
from common.config import EmpresaConfig, nfse_api_base
from common.db import get_cursor, registrar_captura, save_cursor
from common.storage import hash_xml, salvar_xml
from common.xml_parser import parse_nfse


@dataclass
class SyncResult:
    capturados: int
    ultima_chave: str | None
    alerta_certificado: str | None = None
    aviso: str | None = None


def _session_pfx(pfx: str, senha: str) -> requests.Session:
    session = requests.Session()
    session.mount(
        "https://",
        Pkcs12Adapter(pkcs12_filename=pfx, pkcs12_password=senha),
    )
    return session


def _extrair_xml_payload(item: dict[str, Any]) -> bytes | None:
    for key in ("xml", "xmlNfse", "arquivoXml", "conteudo"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.encode("utf-8")
    return None


def consultar_nfse(
    empresa: EmpresaConfig,
    ultima_chave: str | None = None,
    pagina: int = 1,
) -> dict[str, Any]:
    """
  Consulta documentos no ADN/Portal Nacional da NFS-e.
  Endpoint configurável via NFSE_API_BASE — municípios legados exigem integrador (Nuvem Fiscal, DFE Digital).
  """
    base = nfse_api_base()
    url = urljoin(base + "/", "documentosfiscais")
    params: dict[str, Any] = {
        "cnpjCpf": empresa.cnpj,
        "pagina": pagina,
    }
    if ultima_chave:
        params["ultimaChave"] = ultima_chave

    session = _session_pfx(empresa.pfx, empresa.senha)
    response = session.get(url, params=params, timeout=120)
    response.raise_for_status()
    return response.json()


def sync_empresa_nfse(empresa: EmpresaConfig, company_id: str | None = None) -> SyncResult:
    company_id = company_id or empresa.company_id or empresa.cnpj
    alerta = alerta_expiracao(empresa.pfx, empresa.senha)
    ultima_chave = get_cursor(company_id, "nfse")
    if ultima_chave == "0":
        ultima_chave = None

    capturados = 0
    pagina = 1
    aviso = None

    if empresa.serpro_motor:
        aviso = (
            "Empresa optante Simples Nacional: avalie o Motor de Cálculo Serpro "
            "(custo adicional) para apuração automática além da captura de XML."
        )

    while True:
        try:
            payload = consultar_nfse(empresa, ultima_chave=ultima_chave, pagina=pagina)
        except requests.HTTPError as exc:
            save_cursor(company_id, "nfse", ultima_chave or "0", status="error", error=str(exc))
            raise

        itens = payload.get("documentos") or payload.get("lista") or payload.get("nfse") or []
        if not itens:
            break

        for item in itens:
            xml_bytes = _extrair_xml_payload(item)
            chave = (
                item.get("chaveAcesso")
                or item.get("chNFSe")
                or item.get("chave")
                or item.get("id")
            )
            if not xml_bytes and isinstance(item.get("linkXml"), str):
                session = _session_pfx(empresa.pfx, empresa.senha)
                xml_resp = session.get(item["linkXml"], timeout=120)
                xml_resp.raise_for_status()
                xml_bytes = xml_resp.content

            if not xml_bytes:
                continue

            chave = chave or hash_xml(xml_bytes)[:44]
            path = salvar_xml(empresa.cnpj, str(chave), xml_bytes)
            meta = parse_nfse(xml_bytes, empresa.cnpj)
            if meta.chave:
                chave = meta.chave
            if registrar_captura(company_id, meta, str(path), hash_xml(xml_bytes)):
                capturados += 1
            ultima_chave = str(chave)

        proxima = payload.get("proximaPagina") or payload.get("paginaSeguinte")
        if not proxima or proxima <= pagina:
            break
        pagina = int(proxima)

    cursor = ultima_chave or "0"
    save_cursor(company_id, "nfse", cursor, status="ok")
    return SyncResult(
        capturados=capturados,
        ultima_chave=ultima_chave,
        alerta_certificado=alerta,
        aviso=aviso,
    )
