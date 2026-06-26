"""Configuração central da automação de captura XML."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XML_ROOT = ROOT / "xmls"
DEFAULT_CERTS_DIR = ROOT / "certs"
DEFAULT_SQLITE = ROOT / "sync.db"


@dataclass
class EmpresaConfig:
    company_id: str
    cnpj: str
    uf: str
    pfx: str
    senha: str
    serpro_motor: bool = False


def get_xml_root() -> Path:
    return Path(os.getenv("FISCAL_XML_ROOT", str(DEFAULT_XML_ROOT)))


def get_certs_dir() -> Path:
    return Path(os.getenv("FISCAL_CERTS_DIR", str(DEFAULT_CERTS_DIR)))


def get_database_url() -> str | None:
    url = os.getenv("DATABASE_URL") or os.getenv("\ufeffDATABASE_URL")
    if url:
        return url
    # Fallback: .env salvo com BOM no Windows
    from dotenv import dotenv_values
    vals = dotenv_values(ROOT / ".env")
    return vals.get("DATABASE_URL") or vals.get("\ufeffDATABASE_URL")


def get_sqlite_path() -> Path:
    return Path(os.getenv("FISCAL_SYNC_DB", str(DEFAULT_SQLITE)))


def homologacao() -> bool:
    return os.getenv("FISCAL_HOMOLOGACAO", "false").lower() in ("1", "true", "yes")


def nfse_adn_base() -> str:
    """Base URL ADN para distribuicao DFe (contribuintes)."""
    return os.getenv(
        "NFSE_ADN_BASE",
        os.getenv(
            "NFSE_API_BASE",
            "https://adn.nfse.gov.br/contribuintes",
        ),
    ).rstrip("/")


def nfse_api_base() -> str:
    """Alias legado — aponta para ADN contribuintes."""
    return nfse_adn_base()
