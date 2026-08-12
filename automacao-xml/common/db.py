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
                    -- Conteudo do XML autorizado. A tabela guardava so xml_path,
                    -- e em producao o diretorio e temporario: o arquivo sumia no
                    -- deploy seguinte e o registro apontava para o vazio. O XML e
                    -- o documento fiscal, com guarda de 5 anos.
                    xml_content TEXT,
                    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (company_id, chave)
                )
                """
            )
            # Base que ja existia antes desta coluna.
            cur.execute(
                """
                ALTER TABLE fiscal_xml_captures
                ADD COLUMN IF NOT EXISTS xml_content TEXT
                """
            )
            # Janela de castigo da SEFAZ. A DistDFe responde cStat 656
            # "Consumo Indevido" quando a mesma consulta se repete, e manda
            # esperar uma hora. Sem registrar ate quando, cada clique batia de
            # novo e renovava a punicao: em 12/08/2026 o cursor ficou preso em 0
            # justamente por isso, porque consulta rejeitada nao avanca NSU.
            cur.execute(
                """
                ALTER TABLE fiscal_xml_sync
                ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMPTZ
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
            # SQLite nao aceita IF NOT EXISTS em ADD COLUMN: consulta o PRAGMA.
            colunas = {
                linha[1]
                for linha in conn.execute("PRAGMA table_info(sync)").fetchall()
            }
            if "bloqueado_ate" not in colunas:
                conn.execute("ALTER TABLE sync ADD COLUMN bloqueado_ate TEXT")

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


def bloqueio_ativo(company_id: str, doc_type: str) -> datetime | None:
    """Ate quando esta consulta esta em castigo, ou None se esta liberada.

    Existe por causa do cStat 656 da DistDFe ("Consumo Indevido"): a SEFAZ manda
    esperar uma hora, e sem esta checagem cada clique batia de novo e renovava a
    punicao. Como consulta rejeitada nao avanca o NSU, o cursor ficava preso em 0
    e o proximo pedido repetia exatamente o que causou o bloqueio.
    """
    ensure_schema()
    agora = datetime.now(timezone.utc)
    with db_connection() as conn:
        if get_database_url():
            cur = conn.cursor()
            cur.execute(
                "SELECT bloqueado_ate FROM fiscal_xml_sync WHERE company_id=%s AND doc_type=%s",
                (company_id, doc_type),
            )
            row = cur.fetchone()
            ate = row[0] if row else None
        else:
            cur = conn.execute(
                "SELECT bloqueado_ate FROM sync WHERE company_id=? AND doc_type=?",
                (company_id, doc_type),
            )
            row = cur.fetchone()
            bruto = row["bloqueado_ate"] if row else None
            ate = datetime.fromisoformat(bruto) if bruto else None

    if not ate:
        return None
    # Data sem fuso (vinda do SQLite) e tratada como UTC.
    if ate.tzinfo is None:
        ate = ate.replace(tzinfo=timezone.utc)
    return ate if ate > agora else None


def save_cursor(
    company_id: str,
    doc_type: str,
    cursor_value: str,
    status: str = "ok",
    error: str | None = None,
    bloqueado_ate: datetime | None = None,
) -> None:
    """Grava o cursor.

    `bloqueado_ate` só é escrito quando vem preenchido: passar None NÃO limpa um
    bloqueio existente por acidente — usar `limpar_bloqueio` para isso. Escrever
    None a cada gravação apagaria o castigo na tentativa seguinte, que é
    exatamente o efeito que se quer evitar.
    """
    ensure_schema()
    now = datetime.now(timezone.utc)
    with db_connection() as conn:
        if get_database_url():
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO fiscal_xml_sync
                    (company_id, doc_type, cursor_value, last_sync_at, last_status, last_error, bloqueado_ate)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, doc_type) DO UPDATE SET
                    cursor_value = EXCLUDED.cursor_value,
                    last_sync_at = EXCLUDED.last_sync_at,
                    last_status = EXCLUDED.last_status,
                    last_error = EXCLUDED.last_error,
                    bloqueado_ate = COALESCE(EXCLUDED.bloqueado_ate, fiscal_xml_sync.bloqueado_ate)
                """,
                (company_id, doc_type, cursor_value, now, status, error, bloqueado_ate),
            )
            return

        anterior = None
        cur = conn.execute(
            "SELECT bloqueado_ate FROM sync WHERE company_id=? AND doc_type=?",
            (company_id, doc_type),
        )
        row = cur.fetchone()
        if row:
            anterior = row["bloqueado_ate"]
        valor_bloqueio = bloqueado_ate.isoformat() if bloqueado_ate else anterior

        conn.execute(
            """
            INSERT OR REPLACE INTO sync
                (company_id, doc_type, cursor_value, last_sync_at, last_status, last_error, bloqueado_ate)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (company_id, doc_type, cursor_value, now.isoformat(), status, error, valor_bloqueio),
        )


def limpar_bloqueio(company_id: str, doc_type: str) -> None:
    """Libera a consulta. Chamado quando ela volta a funcionar."""
    ensure_schema()
    with db_connection() as conn:
        if get_database_url():
            cur = conn.cursor()
            cur.execute(
                "UPDATE fiscal_xml_sync SET bloqueado_ate = NULL WHERE company_id=%s AND doc_type=%s",
                (company_id, doc_type),
            )
            return
        conn.execute(
            "UPDATE sync SET bloqueado_ate = NULL WHERE company_id=? AND doc_type=?",
            (company_id, doc_type),
        )


def _xml_para_texto(xml_content: bytes | str | None) -> str | None:
    """Normaliza o XML para texto.

    O XML da SEFAZ vem como bytes. Decodifica em UTF-8 e, se falhar, tenta
    latin-1 antes de desistir: perder o documento por causa de um byte
    inesperado seria pior que gravar com um caractere trocado. Nunca levanta —
    o registro da captura nao pode falhar por causa do conteudo.
    """
    if xml_content is None:
        return None
    if isinstance(xml_content, str):
        return xml_content
    for encoding in ("utf-8", "latin-1"):
        try:
            return xml_content.decode(encoding)
        except (UnicodeDecodeError, AttributeError):
            continue
    return xml_content.decode("utf-8", errors="replace")


def registrar_captura(
    company_id: str,
    meta: MetadadosXml,
    xml_path: str,
    xml_hash: str,
    xml_content: bytes | str | None = None,
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
                    modelo, numero, serie, metadata, xml_content, captured_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s
                )
                -- O resumo (resNFe) e o XML completo (procNFe) da MESMA nota
                -- tem a MESMA chave. Com DO NOTHING, o completo que chega depois
                -- da manifestacao era descartado em silencio: a linha continuava
                -- resumo para sempre, e a manifestacao — que existe justamente
                -- para liberar o completo — nao servia para nada.
                --
                -- Agora o completo SOBREPOE o resumo. So nessa direcao: o WHERE
                -- impede que um resumo chegando depois rebaixe um completo ja
                -- guardado, o que perderia itens, NCM e impostos.
                --
                -- O metadata e MESCLADO (antigo || novo) para nao perder o bloco
                -- `manifestacao`, que so existe no antigo e registra quando a
                -- ciencia foi dada.
                ON CONFLICT (company_id, chave) DO UPDATE SET
                    doc_type    = EXCLUDED.doc_type,
                    direcao     = COALESCE(EXCLUDED.direcao, fiscal_xml_captures.direcao),
                    xml_path    = EXCLUDED.xml_path,
                    xml_hash    = EXCLUDED.xml_hash,
                    emitente_cnpj     = COALESCE(EXCLUDED.emitente_cnpj, fiscal_xml_captures.emitente_cnpj),
                    destinatario_cnpj = COALESCE(EXCLUDED.destinatario_cnpj, fiscal_xml_captures.destinatario_cnpj),
                    valor_total = COALESCE(EXCLUDED.valor_total, fiscal_xml_captures.valor_total),
                    data_emissao = COALESCE(EXCLUDED.data_emissao, fiscal_xml_captures.data_emissao),
                    modelo      = COALESCE(EXCLUDED.modelo, fiscal_xml_captures.modelo),
                    numero      = COALESCE(EXCLUDED.numero, fiscal_xml_captures.numero),
                    serie       = COALESCE(EXCLUDED.serie, fiscal_xml_captures.serie),
                    metadata    = COALESCE(fiscal_xml_captures.metadata, '{}'::jsonb)
                                  || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
                    xml_content = EXCLUDED.xml_content,
                    captured_at = EXCLUDED.captured_at
                WHERE fiscal_xml_captures.doc_type = 'nfe_resumo'
                  AND EXCLUDED.doc_type <> 'nfe_resumo'
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
                    _xml_para_texto(xml_content),
                    now,
                ),
            )
            return cur.fetchone() is not None

        # Mesma regra do Postgres: o XML completo sobrepoe o resumo da mesma
        # chave, e nunca o contrario. Aqui em dois passos, porque o SQLite deste
        # projeto guarda menos colunas e nao tem o operador de mesclagem de JSON.
        existente = conn.execute(
            "SELECT doc_type FROM captures WHERE company_id=? AND chave=?",
            (company_id, meta.chave),
        ).fetchone()
        if existente:
            era_resumo = str(existente["doc_type"]) == "nfe_resumo"
            agora_completo = meta.tipo_doc != "nfe_resumo"
            if era_resumo and agora_completo:
                conn.execute(
                    """
                    UPDATE captures
                       SET doc_type=?, direcao=?, xml_path=?, xml_hash=?, metadata=?, captured_at=?
                     WHERE company_id=? AND chave=?
                    """,
                    (
                        meta.tipo_doc, meta.direcao, xml_path, xml_hash,
                        json.dumps(payload), now.isoformat(), company_id, meta.chave,
                    ),
                )
                return True
            return False

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
