"""Persistência de cursor NSU/chave e registros de captura."""
from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterator

from .config import get_database_url, get_sqlite_path
from .xml_parser import MetadadosXml, metadados_para_dict


@dataclass
class SyncState:
    cursor_value: str
    last_sync_at: datetime | None
    last_status: str | None
    last_error: str | None


def _sqlite_conn() -> sqlite3.Connection:
    db_path = get_sqlite_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def _pg_conn():
    import psycopg2
    import psycopg2.extras

    return psycopg2.connect(get_database_url())


@contextmanager
def db_connection() -> Iterator[Any]:
    if get_database_url():
        conn = _pg_conn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        conn = _sqlite_conn()
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def ensure_schema() -> None:
    if get_database_url():
        with db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS fiscal_xml_sync (
                    company_id TEXT NOT NULL,
                    doc_type TEXT NOT NULL,
                    cursor_value TEXT NOT NULL DEFAULT '0',
                    last_sync_at TIMESTAMPTZ,
                    last_status TEXT,
                    last_error TEXT,
                    PRIMARY KEY (company_id, doc_type)
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS fiscal_xml_captures (
                    id TEXT PRIMARY KEY,
                    company_id TEXT NOT NULL,
                    doc_type TEXT NOT NULL,
                    chave TEXT NOT NULL,
                    direcao TEXT,
                    xml_path TEXT NOT NULL,
                    xml_hash TEXT,
                    emitente_cnpj TEXT,
                    destinatario_cnpj TEXT,
                    valor_total NUMERIC(15,2),
                    data_emissao DATE,
                    modelo TEXT,
                    numero TEXT,
                    serie TEXT,
                    metadata JSONB,
                    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (company_id, chave)
                )
                """
            )
    else:
        with db_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sync (
                    company_id TEXT NOT NULL,
                    doc_type TEXT NOT NULL,
                    cursor_value TEXT NOT NULL DEFAULT '0',
                    last_sync_at TEXT,
                    last_status TEXT,
                    last_error TEXT,
                    PRIMARY KEY (company_id, doc_type)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS captures (
                    id TEXT PRIMARY KEY,
                    company_id TEXT NOT NULL,
                    doc_type TEXT NOT NULL,
                    chave TEXT NOT NULL,
                    direcao TEXT,
                    xml_path TEXT NOT NULL,
                    xml_hash TEXT,
                    metadata TEXT,
                    captured_at TEXT NOT NULL,
                    UNIQUE (company_id, chave)
                )
                """
            )


def get_cursor(company_id: str, doc_type: str) -> str:
    ensure_schema()
    with db_connection() as conn:
        if get_database_url():
            cur = conn.cursor()
            cur.execute(
                "SELECT cursor_value FROM fiscal_xml_sync WHERE company_id=%s AND doc_type=%s",
                (company_id, doc_type),
            )
            row = cur.fetchone()
            return str(row[0]) if row else "0"

        cur = conn.execute(
            "SELECT cursor_value FROM sync WHERE company_id=? AND doc_type=?",
            (company_id, doc_type),
        )
        row = cur.fetchone()
        return str(row["cursor_value"]) if row else "0"


def save_cursor(
    company_id: str,
    doc_type: str,
    cursor_value: str,
    status: str = "ok",
    error: str | None = None,
) -> None:
    ensure_schema()
    now = datetime.now(timezone.utc)
    with db_connection() as conn:
        if get_database_url():
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO fiscal_xml_sync (company_id, doc_type, cursor_value, last_sync_at, last_status, last_error)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, doc_type) DO UPDATE SET
                    cursor_value = EXCLUDED.cursor_value,
                    last_sync_at = EXCLUDED.last_sync_at,
                    last_status = EXCLUDED.last_status,
                    last_error = EXCLUDED.last_error
                """,
                (company_id, doc_type, cursor_value, now, status, error),
            )
            return

        conn.execute(
            """
            INSERT OR REPLACE INTO sync (company_id, doc_type, cursor_value, last_sync_at, last_status, last_error)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (company_id, doc_type, cursor_value, now.isoformat(), status, error),
        )


def registrar_captura(
    company_id: str,
    meta: MetadadosXml,
    xml_path: str,
    xml_hash: str,
) -> bool:
    """Retorna False se já existia."""
    ensure_schema()
    capture_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    payload = metadados_para_dict(meta)

    with db_connection() as conn:
        if get_database_url():
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO fiscal_xml_captures (
                    id, company_id, doc_type, chave, direcao, xml_path, xml_hash,
                    emitente_cnpj, destinatario_cnpj, valor_total, data_emissao,
                    modelo, numero, serie, metadata, captured_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s
                )
                ON CONFLICT (company_id, chave) DO NOTHING
                RETURNING id
                """,
                (
                    capture_id,
                    company_id,
                    meta.tipo_doc,
                    meta.chave,
                    meta.direcao,
                    xml_path,
                    xml_hash,
                    meta.emitente_cnpj,
                    meta.destinatario_cnpj,
                    meta.valor_total,
                    meta.data_emissao,
                    meta.modelo,
                    meta.numero,
                    meta.serie,
                    json.dumps(payload),
                    now,
                ),
            )
            return cur.fetchone() is not None

        try:
            conn.execute(
                """
                INSERT INTO captures (id, company_id, doc_type, chave, direcao, xml_path, xml_hash, metadata, captured_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    capture_id,
                    company_id,
                    meta.tipo_doc,
                    meta.chave,
                    meta.direcao,
                    xml_path,
                    xml_hash,
                    json.dumps(payload),
                    now.isoformat(),
                ),
            )
            return True
        except sqlite3.IntegrityError:
            return False
