"""Validação e metadados de certificados A1 (.pfx)."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives.serialization import pkcs12


def _only_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def extract_cnpj_from_text(text: str) -> str | None:
    if not text:
        return None
    labeled = re.search(r"CNPJ[:\s]*([\d./-]{14,18})", text, re.I)
    if labeled:
        digits = _only_digits(labeled.group(1))
        if len(digits) == 14:
            return digits
    colon = re.search(r":(\d{14})\b", text)
    if colon:
        return colon.group(1)
    raw = re.search(r"\b(\d{14})\b", text)
    return raw.group(1) if raw else None


def load_pfx(pfx_path: str | Path, senha: str):
    data = Path(pfx_path).read_bytes()
    try:
        return pkcs12.load_key_and_certificates(data, senha.encode("utf-8"))
    except Exception as exc:  # noqa: BLE001 — senha/arquivo inválidos
        raise ValueError(
            "Senha do certificado incorreta ou arquivo .pfx inválido."
        ) from exc


def validade_certificado(pfx_path: str | Path, senha: str) -> datetime | None:
    _, cert, _ = load_pfx(pfx_path, senha)
    if cert is None or cert.not_valid_after_utc is None:
        return None
    return cert.not_valid_after_utc.replace(tzinfo=timezone.utc)


def cnpj_do_certificado(pfx_path: str | Path, senha: str) -> str | None:
    _, cert, _ = load_pfx(pfx_path, senha)
    if cert is None:
        return None
    subject = cert.subject.rfc4514_string()
    return extract_cnpj_from_text(subject)


def dias_para_expirar(pfx_path: str | Path, senha: str) -> int | None:
    validade = validade_certificado(pfx_path, senha)
    if validade is None:
        return None
    delta = validade - datetime.now(timezone.utc)
    return delta.days


def alerta_expiracao(pfx_path: str | Path, senha: str, dias_alerta: int = 30) -> str | None:
    try:
        dias = dias_para_expirar(pfx_path, senha)
    except ValueError as exc:
        return str(exc)
    if dias is None:
        return "Não foi possível ler a validade do certificado A1."
    if dias < 0:
        return f"Certificado A1 expirado há {abs(dias)} dia(s)."
    if dias <= dias_alerta:
        return f"Certificado A1 expira em {dias} dia(s)."
    return None
