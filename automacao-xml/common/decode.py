"""Decodificação de payloads gzip+base64 (SEFAZ / ADN NFS-e)."""
from __future__ import annotations

import base64
import gzip


def decode_gzip_base64(texto: str) -> bytes:
    raw = base64.b64decode(texto.strip())
    try:
        return gzip.decompress(raw)
    except OSError:
        return raw
