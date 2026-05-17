-- ============================================================
-- Migration 008: NF-e (Nota Fiscal Eletrônica)
-- Suporte ao layout SEFAZ 4.00 (NF-e modelo 55 e NFC-e modelo 65)
-- ============================================================

-- Tabela principal de NF-e
CREATE TABLE IF NOT EXISTS nfe (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Identificação
  numero            INTEGER       NOT NULL,
  serie             SMALLINT      NOT NULL DEFAULT 1,
  modelo            SMALLINT      NOT NULL DEFAULT 55,  -- 55=NF-e, 65=NFC-e
  chave_acesso      CHAR(44)      UNIQUE,               -- chave de acesso de 44 dígitos
  protocolo         VARCHAR(15),                        -- protocolo de autorização SEFAZ

  -- Emitente / Destinatário
  emit_cnpj         CHAR(14)      NOT NULL,
  emit_razao_social VARCHAR(255)  NOT NULL,
  dest_cpf_cnpj     VARCHAR(14)   NOT NULL,
  dest_razao_social VARCHAR(255)  NOT NULL,
  dest_email        VARCHAR(255),

  -- Valores totais
  valor_produtos    NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_frete       NUMERIC(15,2)          DEFAULT 0,
  valor_desconto    NUMERIC(15,2)          DEFAULT 0,
  valor_icms        NUMERIC(15,2)          DEFAULT 0,
  valor_pis         NUMERIC(15,2)          DEFAULT 0,
  valor_cofins      NUMERIC(15,2)          DEFAULT 0,
  valor_total       NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Status do ciclo de vida
  status            VARCHAR(20)   NOT NULL DEFAULT 'RASCUNHO'
                    CHECK (status IN ('RASCUNHO','PENDENTE','AUTORIZADA','CANCELADA','DENEGADA')),
  status_sefaz      VARCHAR(10),                        -- código de retorno SEFAZ
  status_motivo     TEXT,                               -- mensagem de retorno SEFAZ

  -- XML
  xml_nfe           TEXT,                               -- XML da NF-e gerada
  xml_protocolo     TEXT,                               -- XML do protocolo SEFAZ
  xml_cancelamento  TEXT,                               -- XML de cancelamento (se aplicável)

  -- Natureza da operação e informações adicionais
  natureza_operacao VARCHAR(60)   NOT NULL DEFAULT 'VENDA',
  informacoes_adicionais TEXT,

  -- Datas
  data_emissao      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  data_autorizacao  TIMESTAMPTZ,
  data_cancelamento TIMESTAMPTZ,
  justificativa_cancelamento TEXT,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Tabela de itens da NF-e
CREATE TABLE IF NOT EXISTS nfe_itens (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_id            UUID          NOT NULL REFERENCES nfe(id) ON DELETE CASCADE,
  numero_item       SMALLINT      NOT NULL,

  -- Produto
  codigo_produto    VARCHAR(60)   NOT NULL,
  descricao         VARCHAR(120)  NOT NULL,
  ncm               VARCHAR(8),
  cfop              VARCHAR(4)    NOT NULL,
  unidade           VARCHAR(6)    NOT NULL DEFAULT 'UN',
  quantidade        NUMERIC(15,4) NOT NULL,
  valor_unitario    NUMERIC(15,4) NOT NULL,
  valor_total       NUMERIC(15,2) NOT NULL,

  -- Impostos do item
  cst_icms          VARCHAR(3),
  aliquota_icms     NUMERIC(5,2)  DEFAULT 0,
  valor_icms        NUMERIC(15,2) DEFAULT 0,
  cst_pis           VARCHAR(2),
  aliquota_pis      NUMERIC(5,2)  DEFAULT 0,
  valor_pis         NUMERIC(15,2) DEFAULT 0,
  cst_cofins        VARCHAR(2),
  aliquota_cofins   NUMERIC(5,2)  DEFAULT 0,
  valor_cofins      NUMERIC(15,2) DEFAULT 0,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_nfe_company_id   ON nfe(company_id);
CREATE INDEX IF NOT EXISTS idx_nfe_status        ON nfe(status);
CREATE INDEX IF NOT EXISTS idx_nfe_chave_acesso  ON nfe(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_nfe_data_emissao  ON nfe(data_emissao);
CREATE INDEX IF NOT EXISTS idx_nfe_itens_nfe_id  ON nfe_itens(nfe_id);

-- Sequência de numeração por empresa/série
CREATE TABLE IF NOT EXISTS nfe_numeracao (
  company_id UUID     NOT NULL,
  serie      SMALLINT NOT NULL DEFAULT 1,
  modelo     SMALLINT NOT NULL DEFAULT 55,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, serie, modelo)
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_nfe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nfe_updated_at ON nfe;
CREATE TRIGGER trg_nfe_updated_at
  BEFORE UPDATE ON nfe
  FOR EACH ROW EXECUTE FUNCTION update_nfe_updated_at();
