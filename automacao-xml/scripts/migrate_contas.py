"""Cria tabelas contas_receber e contas_pagar no Postgres (migration 013/014)."""
from pathlib import Path

import psycopg2
from dotenv import dotenv_values

vals = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
url = vals.get("DATABASE_URL") or vals.get("\ufeffDATABASE_URL")
if not url:
    raise SystemExit("DATABASE_URL não encontrada")

SQL = """
CREATE TABLE IF NOT EXISTS contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  updated_by uuid,
  documento_fiscal_id uuid,
  categoria varchar(40) NOT NULL,
  numero_titulo varchar(60) NOT NULL,
  descricao text NOT NULL,
  cliente_nome varchar(255) NOT NULL,
  cliente_cnpj varchar(14),
  cliente_email varchar(255),
  cliente_telefone varchar(30),
  data_emissao date NOT NULL,
  data_vencimento date NOT NULL,
  valor_original decimal(15,2) NOT NULL,
  valor_recebido decimal(15,2) DEFAULT 0,
  juros decimal(15,2) DEFAULT 0,
  multa decimal(15,2) DEFAULT 0,
  desconto decimal(15,2) DEFAULT 0,
  status varchar(30) DEFAULT 'pendente',
  observacoes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, numero_titulo)
);

CREATE TABLE IF NOT EXISTS recebimentos_contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id uuid NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,
  data_recebimento date NOT NULL,
  valor_recebido decimal(15,2) NOT NULL,
  juros decimal(15,2) DEFAULT 0,
  multa decimal(15,2) DEFAULT 0,
  desconto decimal(15,2) DEFAULT 0,
  forma_recebimento varchar(30) NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  updated_by uuid,
  documento_fiscal_id uuid,
  categoria varchar(40) NOT NULL,
  numero_titulo varchar(60) NOT NULL,
  descricao text NOT NULL,
  fornecedor_nome varchar(255) NOT NULL,
  fornecedor_cnpj varchar(14),
  fornecedor_email varchar(255),
  fornecedor_telefone varchar(30),
  data_emissao date NOT NULL,
  data_vencimento date NOT NULL,
  valor_original decimal(15,2) NOT NULL,
  valor_pago decimal(15,2) DEFAULT 0,
  juros decimal(15,2) DEFAULT 0,
  multa decimal(15,2) DEFAULT 0,
  desconto decimal(15,2) DEFAULT 0,
  status varchar(30) DEFAULT 'pendente',
  observacoes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, numero_titulo)
);

CREATE TABLE IF NOT EXISTS pagamentos_contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_pagar_id uuid NOT NULL REFERENCES contas_pagar(id) ON DELETE CASCADE,
  data_pagamento date NOT NULL,
  valor_pago decimal(15,2) NOT NULL,
  juros decimal(15,2) DEFAULT 0,
  multa decimal(15,2) DEFAULT 0,
  desconto decimal(15,2) DEFAULT 0,
  forma_pagamento varchar(30) NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL
);

INSERT INTO migrations_executed (migration_name)
VALUES ('013_add_contas_receber'), ('014_add_contas_pagar')
ON CONFLICT (migration_name) DO NOTHING;
"""

conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()
for stmt in SQL.split(";"):
    s = stmt.strip()
    if s:
        cur.execute(s)
        print("OK:", s.split("\n", 1)[0][:60])
cur.execute(
    "SELECT table_name FROM information_schema.tables "
    "WHERE table_schema='public' AND table_name IN ('contas_pagar','contas_receber')"
)
print("Tabelas:", [r[0] for r in cur.fetchall()])
conn.close()
