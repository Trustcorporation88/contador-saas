"""Validação e metadados de certificados A1 (.pfx)."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives.serialization import pkcs12


def validade_certificado(pfx_path: str | Path, senha: str) -> datetime | None:
    data = Path(pfx_path).read_bytes()
    _, cert, _ = pkcs12.load_key_and_certificates(data, senha.encode("utf-8"))
    if cert is None or cert.not_valid_after_utc is None:
        return None
    return cert.not_valid_after_utc.replace(tzinfo=timezone.utc)


def dias_para_expirar(pfx_path: str | Path, senha: str) -> int | None:
    validade = validade_certificado(pfx_path, senha)
    if validade is None:
        return None
    delta = validade - datetime.now(timezone.utc)
    return delta.days


def alerta_expiracao(pfx_path: str | Path, senha: str, dias_alerta: int = 30) -> str | None:
    dias = dias_para_expirar(pfx_path, senha)
    if dias is None:
        return "Não foi possível ler a validade do certificado A1."
    if dias < 0:
        return f"Certificado A1 expirado há {abs(dias)} dia(s)."
    if dias <= dias_alerta:
        return f"Certificado A1 expira em {dias} dia(s)."
    return None
