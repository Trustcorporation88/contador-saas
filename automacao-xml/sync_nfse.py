"""Sincronização NFS-e via ADN (Portal Nacional) — distribuição DFe por NSU."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests
from requests_pkcs12 import Pkcs12Adapter

from common.certificates import alerta_expiracao
from common.config import EmpresaConfig, homologacao, nfse_adn_base
from common.db import get_cursor, registrar_captura, save_cursor
from common.decode import decode_gzip_base64
from common.storage import hash_xml, salvar_xml
from common.xml_parser import parse_nfse

NSU_WIDTH = 15
MAX_LOTE = 50


@dataclass
class SyncResult:
    capturados: int
    ultimo_nsu: str
    alerta_certificado: str | None = None
    aviso: str | None = None


def formatar_nsu(valor: str | int) -> str:
    digits = "".join(c for c in str(valor) if c.isdigit())
    return digits.zfill(NSU_WIDTH)[-NSU_WIDTH:]


def _session_pfx(pfx: str, senha: str) -> requests.Session:
    session = requests.Session()
    session.mount(
        "https://",
        Pkcs12Adapter(pkcs12_filename=pfx, pkcs12_password=senha),
    )
    return session


def consultar_distribuicao_dfe(empresa: EmpresaConfig, ultimo_nsu: str) -> dict[str, Any]:
    """
    GET /contribuintes/DFe/{UltimoNSU}
    Manual ADN NFS-e v1.2 — até 50 documentos por chamada.
    """
    base = nfse_adn_base()
    nsu_param = formatar_nsu(ultimo_nsu or "0")
    url = f"{base}/DFe/{nsu_param}"

    session = _session_pfx(empresa.pfx, empresa.senha)
    last_error: Exception | None = None
    for tentativa in range(3):
        try:
            response = session.get(url, timeout=180)
            if response.status_code in (502, 503, 504) and tentativa < 2:
                continue
            response.raise_for_status()
            if not response.text.strip():
                return {"StatusProcessamento": "NENHUM_DOCUMENTO_LOCALIZADO", "LoteDFe": []}
            return response.json()
        except requests.HTTPError as exc:
            last_error = exc
            if exc.response is not None and exc.response.status_code in (502, 503, 504) and tentativa < 2:
                continue
            raise
        except requests.RequestException as exc:
            last_error = exc
            if tentativa < 2:
                continue
            raise

    if last_error:
        raise last_error
    return {"StatusProcessamento": "NENHUM_DOCUMENTO_LOCALIZADO", "LoteDFe": []}


def _extrair_nsu_resposta(payload: dict[str, Any], lote: list[dict[str, Any]], nsu_atual: str) -> str:
    for key in ("UltNSU", "ultNSU", "UltimoNSU"):
        valor = payload.get(key)
        if valor is not None:
            return formatar_nsu(valor)

    if lote:
        return formatar_nsu(max(int(item.get("NSU", 0)) for item in lote))

    return formatar_nsu(nsu_atual)


def _status_sem_documentos(status: str | None) -> bool:
    if not status:
        return False
    normalizado = status.upper()
    return any(
        trecho in normalizado
        for trecho in (
            "NENHUM",
            "NAO_EXIST",
            "NÃO_EXIST",
            "SEM_DOCUMENTO",
            "NAO_HA",
        )
    )


def sync_empresa_nfse(empresa: EmpresaConfig, company_id: str | None = None) -> SyncResult:
    company_id = company_id or empresa.company_id or empresa.cnpj
    alerta = alerta_expiracao(empresa.pfx, empresa.senha)
    nsu = formatar_nsu(get_cursor(company_id, "nfse") or "0")

    capturados = 0
    aviso = None

    if empresa.serpro_motor:
        aviso = (
            "Empresa optante Simples Nacional: avalie o Motor de Calculo Serpro "
            "(custo adicional) para apuracao automatica alem da captura de XML."
        )

    while True:
        try:
            payload = consultar_distribuicao_dfe(empresa, nsu)
        except requests.HTTPError as exc:
            save_cursor(company_id, "nfse", nsu, status="error", error=str(exc))
            raise

        status = payload.get("StatusProcessamento") or payload.get("statusProcessamento")
        lote = payload.get("LoteDFe") or payload.get("loteDFe") or []

        if _status_sem_documentos(status) or not lote:
            break

        for item in lote:
            tipo = (item.get("TipoDocumento") or item.get("tipoDocumento") or "").upper()
            arquivo = item.get("ArquivoXml") or item.get("arquivoXml")
            chave = item.get("ChaveAcesso") or item.get("chaveAcesso")
            nsu_item = item.get("NSU") or item.get("nsu")

            if not arquivo:
                continue

            # Prioriza XML completo de NFS-e; eventos podem ser armazenados depois.
            if tipo and tipo not in ("NFSE", "NFS-E", "NFS"):
                continue

            try:
                xml_bytes = decode_gzip_base64(arquivo)
            except Exception:
                continue

            chave_arquivo = chave or (str(nsu_item) if nsu_item is not None else hash_xml(xml_bytes)[:50])
            path = salvar_xml(empresa.cnpj, str(chave_arquivo), xml_bytes)
            meta = parse_nfse(xml_bytes, empresa.cnpj)
            # Garante chave nao-vazia para evitar colisao no UNIQUE(company_id, chave).
            if not meta.chave:
                meta.chave = str(chave or chave_arquivo)
            if registrar_captura(company_id, meta, str(path), hash_xml(xml_bytes)):
                capturados += 1

        novo_nsu = _extrair_nsu_resposta(payload, lote, nsu)
        max_nsu = payload.get("MaxNSU") or payload.get("maxNSU")
        save_cursor(company_id, "nfse", novo_nsu)

        if len(lote) < MAX_LOTE:
            break
        if max_nsu is not None and formatar_nsu(novo_nsu) >= formatar_nsu(max_nsu):
            break
        if novo_nsu == nsu:
            break

        nsu = novo_nsu

    save_cursor(company_id, "nfse", nsu, status="ok")
    return SyncResult(
        capturados=capturados,
        ultimo_nsu=nsu,
        alerta_certificado=alerta,
        aviso=aviso,
    )
