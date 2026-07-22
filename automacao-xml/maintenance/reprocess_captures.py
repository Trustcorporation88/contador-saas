"""Reprocessa XMLs ja capturados e atualiza metadados (valor/emitente/numero/data).

Necessario porque o registro de captura usa UNIQUE(company_id, chave) com
ON CONFLICT DO NOTHING — rodar o sync novamente nao corrige capturas antigas
que foram gravadas antes da correcao do parser.

Uso:
    python maintenance/reprocess_captures.py            # todas as empresas
    python maintenance/reprocess_captures.py <company>   # apenas uma empresa
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from common.config import get_database_url  # noqa: E402
from common.db import db_connection, ensure_schema  # noqa: E402
from common.xml_parser import (  # noqa: E402
    metadados_para_dict,
    parse_nfe,
    parse_nfse,
)


def _parse(xml_bytes: bytes, doc_type: str, cnpj_empresa: str):
    if (doc_type or "").startswith("nfe"):
        return parse_nfe(xml_bytes, cnpj_empresa)
    return parse_nfse(xml_bytes, cnpj_empresa)


def _rows_pg(conn, company_id: str | None):
    cur = conn.cursor()
    if company_id:
        cur.execute(
            "SELECT id, company_id, doc_type, xml_path, emitente_cnpj, destinatario_cnpj "
            "FROM fiscal_xml_captures WHERE company_id=%s",
            (company_id,),
        )
    else:
        cur.execute(
            "SELECT id, company_id, doc_type, xml_path, emitente_cnpj, destinatario_cnpj "
            "FROM fiscal_xml_captures"
        )
    return cur.fetchall()


def _rows_sqlite(conn, company_id: str | None):
    if company_id:
        cur = conn.execute(
            "SELECT id, company_id, doc_type, xml_path, metadata FROM captures WHERE company_id=?",
            (company_id,),
        )
    else:
        cur = conn.execute("SELECT id, company_id, doc_type, xml_path, metadata FROM captures")
    return cur.fetchall()


def reprocess(company_id: str | None = None) -> None:
    ensure_schema()
    is_pg = bool(get_database_url())
    atualizados = 0
    faltando = 0

    with db_connection() as conn:
        if is_pg:
            cur = conn.cursor()
            cur.execute("SELECT company_id, cnpj FROM fiscal_certificates")
            cnpj_por_empresa = {
                str(r[0]): "".join(c for c in str(r[1]) if c.isdigit())
                for r in cur.fetchall()
            }
            rows = _rows_pg(conn, company_id)
            for rid, cid, doc_type, xml_path, *_ in rows:
                path = Path(xml_path)
                cnpj_empresa = cnpj_por_empresa.get(str(cid), "")
                if not path.exists():
                    faltando += 1
                    continue
                meta = _parse(path.read_bytes(), doc_type, cnpj_empresa)
                cur.execute(
                    """
                    UPDATE fiscal_xml_captures SET
                        direcao=COALESCE(%s, direcao), emitente_cnpj=%s, destinatario_cnpj=%s,
                        valor_total=%s, data_emissao=%s, modelo=%s, numero=%s,
                        serie=%s, metadata=%s::jsonb
                    WHERE id=%s
                    """,
                    (
                        meta.direcao,
                        meta.emitente_cnpj,
                        meta.destinatario_cnpj,
                        meta.valor_total,
                        meta.data_emissao,
                        meta.modelo,
                        meta.numero,
                        meta.serie,
                        json.dumps(metadados_para_dict(meta)),
                        rid,
                    ),
                )
                atualizados += 1
        else:
            rows = _rows_sqlite(conn, company_id)
            for row in rows:
                rid, cid, doc_type, xml_path, _meta = row
                path = Path(xml_path)
                cnpj_empresa = "".join(c for c in str(cid) if c.isdigit())
                if not path.exists():
                    faltando += 1
                    continue
                meta = _parse(path.read_bytes(), doc_type, cnpj_empresa)
                conn.execute(
                    "UPDATE captures SET direcao=COALESCE(?, direcao), metadata=? WHERE id=?",
                    (meta.direcao, json.dumps(metadados_para_dict(meta)), rid),
                )
                atualizados += 1

    print(f"Reprocessado: {atualizados} | XML ausente: {faltando}")


if __name__ == "__main__":
    reprocess(sys.argv[1] if len(sys.argv) > 1 else None)
