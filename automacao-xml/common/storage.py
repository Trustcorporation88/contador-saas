"""Armazenamento de XMLs: xmls/{cnpj}/{ano}/{mes}/{chave}.xml"""
from __future__ import annotations

import hashlib
from datetime import datetime
from pathlib import Path

from .config import get_xml_root


def chave_nfe_parts(chave: str) -> tuple[str, str, str]:
    chave = "".join(c for c in chave if c.isdigit())
    if len(chave) >= 6:
        return chave[:4], chave[4:6], chave
    ano = datetime.now().strftime("%Y")
    mes = datetime.now().strftime("%m")
    return ano, mes, chave


def xml_destino(cnpj: str, chave: str, xml_root: Path | None = None) -> Path:
    root = xml_root or get_xml_root()
    ano, mes, nome = chave_nfe_parts(chave)
    pasta = root / cnpj / ano / mes
    pasta.mkdir(parents=True, exist_ok=True)
    return pasta / f"{nome}.xml"


def salvar_xml(cnpj: str, chave: str, conteudo: bytes, xml_root: Path | None = None) -> Path:
    destino = xml_destino(cnpj, chave, xml_root)
    destino.write_bytes(conteudo)
    return destino


def hash_xml(conteudo: bytes) -> str:
    return hashlib.sha256(conteudo).hexdigest()
