import psycopg2
from dotenv import dotenv_values

vals = dotenv_values(".env")
url = vals.get("DATABASE_URL") or vals.get("\ufeffDATABASE_URL")
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute(
    "SELECT column_name FROM information_schema.columns "
    "WHERE table_name='companies' ORDER BY 1"
)
print("companies cols:", [r[0] for r in cur.fetchall()])

cur.execute("SELECT id, legal_name, cnpj FROM companies ORDER BY legal_name")
for cid, nome, cnpj in cur.fetchall():
    print(f"\n{nome} ({cnpj})")
    cur.execute(
        "SELECT doc_type, COUNT(*), MAX(captured_at) "
        "FROM fiscal_xml_captures WHERE company_id=%s GROUP BY doc_type",
        (cid,),
    )
    print("  capturas:", cur.fetchall() or "nenhuma")
    cur.execute(
        "SELECT doc_type, cursor_value, last_sync_at, last_status, last_error "
        "FROM fiscal_xml_sync WHERE company_id=%s",
        (cid,),
    )
    print("  sync:", cur.fetchall() or "nunca")
    cur.execute(
        "SELECT cert_valid_until, active FROM fiscal_certificates WHERE company_id=%s",
        (cid,),
    )
    print("  cert:", cur.fetchone() or "sem")

conn.close()
