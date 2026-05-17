-- ==========================================
-- Migration: 006_create_tax_tables.sql
-- Versão: 1.0
-- Data: 2026-05-17
-- Autor: Backend Architect + Contabilidade Brasil Contador
-- Descrição: Criação de tabelas para cálculo de impostos e apuração
-- ==========================================

/*
 * ==========================================
 * OBJETIVO
 * ==========================================
 * Este arquivo cria as tabelas para gerenciamento de impostos brasileiros:
 * - Cálculo de impostos (IRPJ, CSLL, PIS, COFINS, ICMS, ISS)
 * - Ajustes fiscais (adições e exclusões)
 * - Saldos provisórios para apuração
 * 
 * DEPENDÊNCIAS: 001_create_accounts.sql (accounts table)
 * MIGRAÇÕES FUTURAS: 007_create_triggers.sql (triggers de validação)
 * 
 * ==========================================
 */

-- ==========================================
-- TABELA 1: tax_calculations
-- ==========================================
/*
 * DESCRIÇÃO: Armazena cálculos de impostos por período
 * 
 * CAMPOS PRINCIPAIS:
 * - id: Identificador único (UUID)
 * - company_id: Referência à empresa (FKEY para 001_create_accounts.sql)
 * - tax_type: Tipo de imposto suportado
 *   * IRPJ: Imposto de Renda Pessoa Jurídica
 *   * CSLL: Contribuição Social sobre Lucro Líquido
 *   * PIS: Programa de Integração Social
 *   * COFINS: Contribuição para Financiamento da Seguridade Social
 *   * ICMS: Imposto sobre Circulação de Mercadorias e Serviços (estadual)
 *   * ISS: Imposto sobre Serviços de Qualquer Natureza (municipal)
 * - period_start: Primeiro dia do período de apuração (ISO 8601)
 * - period_end: Último dia do período de apuração (ISO 8601)
 * - calculated_amount: Valor total do imposto calculado (18,2 - até 999.999.999,99)
 * - status: Estado atual do cálculo
 *   * PENDING: Aguardando aprovação contábil
 *   * APPROVED: Aprovado, aguardando envio
 *   * FILED: Enviado para Receita Federal / Prefeitura
 * - notes: Campo livre para observações contábeis
 * - created_at: Data/hora de criação (auditoria)
 * - updated_at: Data/hora da última alteração (auditoria)
 * 
 * CONSTRAINTS:
 * - UNIQUE(company_id, tax_type, period_start, period_end)
 *   Garantir que não exista duplicata de cálculo para mesmo período
 * - period_start <= period_end (validação em trigger 007)
 * - calculated_amount >= 0 (imposto não pode ser negativo)
 * 
 * ÍNDICES:
 * - idx_tax_calculations_company: Busca rápida por empresa
 * - idx_tax_calculations_period: Busca por intervalo de datas
 * - idx_tax_calculations_status: Filtro por status de apuração
 */
CREATE TABLE IF NOT EXISTS tax_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  tax_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  calculated_amount NUMERIC(18,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- CONSTRAINT para garantir unicidade por período
  UNIQUE(company_id, tax_type, period_start, period_end),
  
  -- Validação: period_start deve ser menor ou igual a period_end
  CONSTRAINT chk_period_valid CHECK (period_start <= period_end),
  
  -- Validação: calculated_amount não pode ser negativo
  CONSTRAINT chk_calculated_amount_positive CHECK (calculated_amount >= 0),
  
  -- Validação: tax_type deve ser um dos tipos suportados
  CONSTRAINT chk_tax_type_valid CHECK (
    tax_type IN ('IRPJ', 'CSLL', 'PIS', 'COFINS', 'ICMS', 'ISS')
  ),
  
  -- Validação: status deve ser um dos estados permitidos
  CONSTRAINT chk_status_valid CHECK (
    status IN ('PENDING', 'APPROVED', 'FILED')
  )
  
  -- FOREIGN KEY comentada para company_id (será referenciada em migration 007)
  -- Para adicionar: ALTER TABLE tax_calculations ADD CONSTRAINT fk_tax_calculations_company
  --   FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
);

-- Índices para otimização de queries
CREATE INDEX IF NOT EXISTS idx_tax_calculations_company 
  ON tax_calculations(company_id);

CREATE INDEX IF NOT EXISTS idx_tax_calculations_period 
  ON tax_calculations(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_tax_calculations_status 
  ON tax_calculations(status);

CREATE INDEX IF NOT EXISTS idx_tax_calculations_tax_type 
  ON tax_calculations(tax_type);

-- Índice composto para queries frequentes: "buscar impostos pendentes por período"
CREATE INDEX IF NOT EXISTS idx_tax_calculations_status_period
  ON tax_calculations(status, period_start, period_end);

-- Índice composto para auditoria: "todos os cálculos de uma empresa em range de datas"
CREATE INDEX IF NOT EXISTS idx_tax_calculations_company_date
  ON tax_calculations(company_id, created_at);


-- ==========================================
-- TABELA 2: tax_adjustments
-- ==========================================
/*
 * DESCRIÇÃO: Armazena ajustes e adições ao cálculo base de impostos
 * 
 * CAMPOS PRINCIPAIS:
 * - id: Identificador único (UUID)
 * - tax_calculation_id: Referência ao cálculo (FKEY para tax_calculations)
 * - account_id: Conta contábil afetada pelo ajuste (FKEY para accounts table)
 * - adjustment_type: Tipo de ajuste aplicado
 *   * ADDITION: Adição ao cálculo (ex: receita não tributada que deve ser incluída)
 *   * EXCLUSION: Exclusão do cálculo (ex: despesa que não é dedutível)
 * - amount: Valor absoluto do ajuste (18,2)
 * - justification: Campo obrigatório com motivo contábil/fiscal do ajuste
 *   Exemplo: "Exclusão de despesa com almoço de diretoria conforme art. 82, § 2º, Lei 8.541/92"
 * - created_at: Data/hora de criação do ajuste (auditoria)
 * 
 * CONSTRAINTS:
 * - amount > 0 (valor de ajuste deve ser positivo)
 * - justification NOT NULL (ajuste deve sempre ter justificativa)
 * 
 * ÍNDICES:
 * - idx_tax_adjustments_calculation: Busca todos ajustes de um cálculo
 * - idx_tax_adjustments_account: Análise de ajustes por conta
 * 
 * FÓRMULA DE APLICAÇÃO:
 * valor_imposto_final = calculated_amount + 
 *   (sum(amount) WHERE adjustment_type = 'ADDITION') - 
 *   (sum(amount) WHERE adjustment_type = 'EXCLUSION')
 */
CREATE TABLE IF NOT EXISTS tax_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_calculation_id UUID NOT NULL,
  account_id UUID,
  adjustment_type VARCHAR(20) NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Validação: adjustment_type deve ser um dos tipos permitidos
  CONSTRAINT chk_adjustment_type_valid CHECK (
    adjustment_type IN ('ADDITION', 'EXCLUSION')
  ),
  
  -- Validação: amount deve ser positivo (o sinal + ou - fica no adjustment_type)
  CONSTRAINT chk_adjustment_amount_positive CHECK (amount > 0),
  
  -- Validação: justification não pode estar vazio
  CONSTRAINT chk_justification_not_empty CHECK (
    justification IS NOT NULL AND justification != ''
  )
  
  -- FOREIGN KEY comentada para tax_calculation_id (será adicionada em migration 007)
  -- ALTER TABLE tax_adjustments ADD CONSTRAINT fk_tax_adjustments_calculation
  --   FOREIGN KEY (tax_calculation_id) REFERENCES tax_calculations(id) ON DELETE CASCADE;
  
  -- FOREIGN KEY comentada para account_id (será adicionada em migration 007)
  -- ALTER TABLE tax_adjustments ADD CONSTRAINT fk_tax_adjustments_account
  --   FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
);

-- Índices para otimização de queries
CREATE INDEX IF NOT EXISTS idx_tax_adjustments_calculation 
  ON tax_adjustments(tax_calculation_id);

CREATE INDEX IF NOT EXISTS idx_tax_adjustments_account 
  ON tax_adjustments(account_id);

CREATE INDEX IF NOT EXISTS idx_tax_adjustments_type 
  ON tax_adjustments(adjustment_type);

-- Índice composto para análise: "todos ajustes de adição em um cálculo"
CREATE INDEX IF NOT EXISTS idx_tax_adjustments_calc_type
  ON tax_adjustments(tax_calculation_id, adjustment_type);


-- ==========================================
-- TABELA 3: provisional_balances
-- ==========================================
/*
 * DESCRIÇÃO: Armazena saldos provisórios das contas para apuração de impostos
 * 
 * CAMPOS PRINCIPAIS:
 * - id: Identificador único (UUID)
 * - company_id: Referência à empresa (FKEY para companies table)
 * - balance_date: Data de referência do saldo (ISO 8601)
 * - account_id: Conta contábil (FKEY para accounts table)
 * - balance_type: Natureza do saldo
 *   * DEBIT: Saldo devedor (contas de ativo ou despesa)
 *   * CREDIT: Saldo credor (contas de passivo, receita ou PL)
 * - amount: Valor absoluto do saldo (18,2)
 * - created_at: Data/hora de cálculo do saldo (auditoria)
 * 
 * USO: Tabela de cache para acelerar cálculos de apuração
 * Alimentada por trigger que executa após cada journal entry postada
 * Permite recálculo rápido de impostos sem varre lançamento por lançamento
 * 
 * CONSTRAINTS:
 * - UNIQUE(balance_date, account_id): Evitar duplicata para mesma conta/data
 * - amount >= 0 (saldo é sempre positivo, o sinal fica em balance_type)
 * - balance_type IN ('DEBIT', 'CREDIT')
 * 
 * ÍNDICES:
 * - idx_provisional_balances_company: Busca todos saldos de uma empresa
 * - idx_provisional_balances_date: Busca saldos de uma data específica
 * - idx_provisional_balances_account: Análise histórica de uma conta
 * 
 * EXEMPLO DE CÁLCULO:
 * SELECT 
 *   SUM(CASE WHEN balance_type = 'DEBIT' THEN amount ELSE -amount END) as saldo
 * FROM provisional_balances
 * WHERE company_id = :id AND balance_date = '2026-04-30'
 */
CREATE TABLE IF NOT EXISTS provisional_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  balance_date DATE NOT NULL,
  account_id UUID NOT NULL,
  balance_type VARCHAR(10) NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Garantir que não exista saldo duplicado para mesma conta/data
  UNIQUE(balance_date, account_id),
  
  -- Validação: balance_type deve ser um dos tipos permitidos
  CONSTRAINT chk_balance_type_valid CHECK (
    balance_type IN ('DEBIT', 'CREDIT')
  ),
  
  -- Validação: amount deve ser não-negativo
  CONSTRAINT chk_balance_amount_nonnegative CHECK (amount >= 0)
  
  -- FOREIGN KEY comentada para company_id (será adicionada em migration 007)
  -- ALTER TABLE provisional_balances ADD CONSTRAINT fk_provisional_balances_company
  --   FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  
  -- FOREIGN KEY comentada para account_id (será adicionada em migration 007)
  -- ALTER TABLE provisional_balances ADD CONSTRAINT fk_provisional_balances_account
  --   FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
);

-- Índices para otimização de queries
CREATE INDEX IF NOT EXISTS idx_provisional_balances_company 
  ON provisional_balances(company_id);

CREATE INDEX IF NOT EXISTS idx_provisional_balances_date 
  ON provisional_balances(balance_date);

CREATE INDEX IF NOT EXISTS idx_provisional_balances_account 
  ON provisional_balances(account_id);

-- Índice composto para queries de apuração: "saldos de uma empresa em uma data"
CREATE INDEX IF NOT EXISTS idx_provisional_balances_company_date
  ON provisional_balances(company_id, balance_date);

-- Índice composto para histórico de conta: "saldos de uma conta ao longo do tempo"
CREATE INDEX IF NOT EXISTS idx_provisional_balances_account_date
  ON provisional_balances(account_id, balance_date DESC);


-- ==========================================
-- DOCUMENTAÇÃO: FÓRMULAS DE CÁLCULO DE IMPOSTOS
-- ==========================================
/*
 * REGIME: Lucro Real
 * 
 * ========================================
 * 1. IRPJ - Imposto de Renda Pessoa Jurídica
 * ========================================
 * Taxa padrão: 15% do lucro líquido
 * Adicional: 10% sobre lucro que exceder R$ 240.000 por trimestre
 * 
 * Fórmula Base:
 * IRPJ = Lucro Líquido × 15%
 * 
 * Fórmula com Adicional:
 * Lucro_Trimestral = (Receitas - Despesas) / 3
 * Faixa_Base = MIN(Lucro_Trimestral, 240.000)
 * Faixa_Adicional = MAX(Lucro_Trimestral - 240.000, 0)
 * 
 * IRPJ = (Faixa_Base × 15%) + (Faixa_Adicional × 25%)
 * 
 * Contas envolvidas:
 * - Débito: Receita Bruta (4.1.1.x)
 * - Crédito: Despesas Operacionais (5.1.x.x, 5.2.x.x)
 * - Resultado: Conta 2.4.2 (Imposto de Renda a Recolher)
 * 
 * ========================================
 * 2. CSLL - Contribuição Social sobre Lucro Líquido
 * ========================================
 * Taxa: 9% do lucro líquido
 * 
 * Fórmula:
 * CSLL = Lucro Líquido × 9%
 * 
 * Observação: O CSLL é não-cumulativo, havendo créditos de contribuição
 * sobre aquisições de insumos (se aplicável)
 * 
 * Resultado: Conta 2.4.3 (CSLL a Recolher)
 * 
 * ========================================
 * 3. PIS - Programa de Integração Social
 * ========================================
 * Taxa: 1,65% da receita bruta (regime não-cumulativo)
 * Créditos: Sobre insumos e materiais adquiridos
 * 
 * Fórmula Simples:
 * PIS_Devido = Receita Bruta × 1,65%
 * PIS_a_Recolher = PIS_Devido - Créditos_PIS
 * 
 * Resultado: Conta 2.4.4 (PIS a Recolher)
 * 
 * ========================================
 * 4. COFINS - Contribuição para Financiamento da Seg. Social
 * ========================================
 * Taxa: 7,6% da receita bruta (regime não-cumulativo)
 * Créditos: Sobre insumos e materiais adquiridos
 * 
 * Fórmula Simples:
 * COFINS_Devido = Receita Bruta × 7,6%
 * COFINS_a_Recolher = COFINS_Devido - Créditos_COFINS
 * 
 * Resultado: Conta 2.4.5 (COFINS a Recolher)
 * 
 * ========================================
 * 5. ICMS - Imposto sobre Circulação de Mercadorias e Serviços
 * ========================================
 * Taxa: Varia por estado (ex: SP 18%, RJ 20%)
 * Modelo: Débito/Crédito (não-cumulativo)
 * 
 * Fórmula:
 * ICMS_Incidência = Saída × Alíquota_Estado
 * ICMS_a_Pagar = ICMS_Incidência - ICMS_Crédito_Entradas
 * 
 * Observações:
 * - Diferentes alíquotas por natureza de produto
 * - Crédito sobre aquisições de mercadorias
 * 
 * Resultado: Conta 2.4.6 (ICMS a Recolher)
 * 
 * ========================================
 * 6. ISS - Imposto sobre Serviços de Qualquer Natureza
 * ========================================
 * Taxa: Varia por município (2% a 5%)
 * Modelo: Fixo (cumulativo, sem créditos)
 * 
 * Fórmula:
 * ISS = Receita de Serviços × Alíquota_Município
 * 
 * Observação:
 * - Retenção na fonte pelo tomador de serviço (para alguns casos)
 * - Município pode exigir guia própria
 * 
 * Resultado: Conta 2.4.7 (ISS a Recolher)
 * 
 * ========================================
 * APURAÇÃO CONSOLIDADA (Trimestral)
 * ========================================
 * 
 * Total de Impostos = IRPJ + CSLL + PIS + COFINS + ICMS + ISS
 * 
 * Onde cada componente pode sofrer ajustes:
 * - ADDITION: Somas para aumentar o imposto (receita esquecida, etc)
 * - EXCLUSION: Subtrações para diminuir o imposto (despesa dedutível)
 */

-- ========================================
-- EXEMPLO 1: APURAÇÃO DE IRPJ (Lucro Real)
-- ========================================
/*
 * CENÁRIO: Empresa XYZ LTDA apurando IRPJ do 1º Trimestre de 2026
 * Período: 01/01/2026 a 31/03/2026
 * 
 * PASSO 1: Cálculo Base
 * ├─ Receita Bruta (Conta 4.1.1.1):           R$ 500.000,00
 * ├─ Deduções (Devoluções, 4.1.9.1):         R$ (10.000,00)
 * ├─ Receita Líquida:                         R$ 490.000,00
 * ├─ Custo de Mercadoria Vendida (5.1.1.1): R$ (200.000,00)
 * ├─ Lucro Bruto:                             R$ 290.000,00
 * ├─ Despesas Operacionais (5.2.x.x):        R$ (70.000,00)
 * └─ Lucro Líquido (antes de impostos):       R$ 220.000,00
 * 
 * PASSO 2: Cálculo do IRPJ
 * ├─ Faixa Base (até R$ 240.000):             R$ 220.000,00
 * ├─ Faixa Adicional (acima R$ 240.000):      R$ 0,00
 * ├─ IRPJ Faixa Base (220.000 × 15%):         R$ 33.000,00
 * ├─ IRPJ Faixa Adicional (0 × 25%):          R$ 0,00
 * └─ IRPJ Total Calculado:                    R$ 33.000,00
 * 
 * PASSO 3: Ajustes Fiscais
 * ├─ ADDITION: Receita com PJ não registrada  R$ 5.000,00
 * │  Justificativa: "Conforme RPA emitida em 15/03/2026"
 * ├─ ADDITION: Multa indenizatória (não tributária) R$ 500,00
 * │  Justificativa: "Conforme Lei 9.430/96 art. 38"
 * └─ EXCLUSION: Despesa com almoço diretoria  R$ (1.000,00)
 *    Justificativa: "Conforme art. 82, § 2º, Lei 8.541/92"
 * 
 * PASSO 4: IRPJ Final
 * ├─ IRPJ Calculado:        R$ 33.000,00
 * ├─ + Adições:             R$  5.500,00
 * ├─ - Exclusões:           R$ (1.000,00)
 * └─ IRPJ a Recolher:        R$ 37.500,00
 * 
 * DADOS NO BANCO:
 * 
 * INSERT INTO tax_calculations (
 *   company_id, tax_type, period_start, period_end,
 *   calculated_amount, status, notes
 * ) VALUES (
 *   'uuid-empresa-xyz',
 *   'IRPJ',
 *   '2026-01-01',
 *   '2026-03-31',
 *   33000.00,
 *   'PENDING',
 *   'IRPJ T1/2026 - Apuração conforme Lucro Real'
 * );
 * -- Retorna: tax_calculation_id = 'uuid-calc-001'
 * 
 * INSERT INTO tax_adjustments (
 *   tax_calculation_id, account_id, adjustment_type, amount, justification
 * ) VALUES
 *   ('uuid-calc-001', 'uuid-account-rpa-services', 'ADDITION', 5000.00,
 *    'Receita com PJ não registrada - RPA emitida em 15/03/2026'),
 *   ('uuid-calc-001', 'uuid-account-penalties', 'ADDITION', 500.00,
 *    'Multa indenizatória - Conforme Lei 9.430/96 art. 38'),
 *   ('uuid-calc-001', 'uuid-account-meals', 'EXCLUSION', 1000.00,
 *    'Despesa com almoço diretoria - Conforme art. 82, § 2º, Lei 8.541/92');
 * 
 * QUERY PARA APURAÇÃO:
 * 
 * SELECT
 *   tc.calculated_amount as irpj_base,
 *   COALESCE(SUM(CASE WHEN ta.adjustment_type = 'ADDITION' 
 *                     THEN ta.amount ELSE 0 END), 0) as total_additions,
 *   COALESCE(SUM(CASE WHEN ta.adjustment_type = 'EXCLUSION' 
 *                     THEN ta.amount ELSE 0 END), 0) as total_exclusions,
 *   tc.calculated_amount +
 *     COALESCE(SUM(CASE WHEN ta.adjustment_type = 'ADDITION' THEN ta.amount ELSE 0 END), 0) -
 *     COALESCE(SUM(CASE WHEN ta.adjustment_type = 'EXCLUSION' THEN ta.amount ELSE 0 END), 0)
 *     as irpj_final
 * FROM tax_calculations tc
 * LEFT JOIN tax_adjustments ta ON tc.id = ta.tax_calculation_id
 * WHERE
 *   tc.company_id = 'uuid-empresa-xyz' AND
 *   tc.tax_type = 'IRPJ' AND
 *   tc.period_start = '2026-01-01'
 * GROUP BY tc.id, tc.calculated_amount;
 * 
 * RESULTADO ESPERADO:
 * irpj_base    | total_additions | total_exclusions | irpj_final
 * 33000.00     | 5500.00         | 1000.00          | 37500.00
 */

-- ========================================
-- EXEMPLO 2: USO DA TABELA provisional_balances
-- ========================================
/*
 * QUERY PARA CALCULAR SALDO PATRIMONIAL EM 31/03/2026:
 * 
 * SELECT
 *   ac.code,
 *   ac.name,
 *   ac.type,
 *   SUM(CASE 
 *     WHEN pb.balance_type = 'DEBIT' THEN pb.amount
 *     WHEN pb.balance_type = 'CREDIT' THEN -pb.amount
 *     ELSE 0
 *   END) as saldo
 * FROM provisional_balances pb
 * INNER JOIN accounts ac ON pb.account_id = ac.id
 * WHERE
 *   pb.company_id = 'uuid-empresa-xyz' AND
 *   pb.balance_date = '2026-03-31'
 * GROUP BY ac.code, ac.name, ac.type
 * ORDER BY ac.code;
 * 
 * Esta query fornece a base para:
 * 1. Balanço Patrimonial (agrupado por tipo: ASSET, LIABILITY, EQUITY)
 * 2. Cálculo de base tributária (somando receitas - despesas)
 * 3. Apuração de impostos (subconjuntos de contas por natureza fiscal)
 */

-- ========================================
-- SUMMARY: ÍNDICES CRIADOS
-- ========================================
/*
 * TOTAL DE ÍNDICES: 11 (+ 3 índices implícitos das constraints UNIQUE)
 * 
 * tax_calculations (6 índices):
 *   1. idx_tax_calculations_company (para filtros por empresa)
 *   2. idx_tax_calculations_period (para intervalo de datas)
 *   3. idx_tax_calculations_status (para filtros de status)
 *   4. idx_tax_calculations_tax_type (para filtros por tipo)
 *   5. idx_tax_calculations_status_period (para queries combinadas)
 *   6. idx_tax_calculations_company_date (para auditoria temporal)
 * 
 * tax_adjustments (4 índices):
 *   7. idx_tax_adjustments_calculation (para busca de ajustes)
 *   8. idx_tax_adjustments_account (para análise por conta)
 *   9. idx_tax_adjustments_type (para filtros de tipo)
 *   10. idx_tax_adjustments_calc_type (para queries compostas)
 * 
 * provisional_balances (5 índices):
 *   11. idx_provisional_balances_company (para busca por empresa)
 *   12. idx_provisional_balances_date (para busca por data)
 *   13. idx_provisional_balances_account (para histórico)
 *   14. idx_provisional_balances_company_date (para apurações)
 *   15. idx_provisional_balances_account_date (para histórico com ordem)
 * 
 * CONSTRAINT UNIQUEs (3 índices implícitos):
 *   - UNIQUE(company_id, tax_type, period_start, period_end) em tax_calculations
 *   - UNIQUE(balance_date, account_id) em provisional_balances
 */

-- ========================================
-- FIM DO ARQUIVO
-- ========================================
-- Próximas migrações:
-- 007_create_triggers.sql: Triggers para validação e auto-atualização
-- 008_create_views.sql: Views para relatórios e apurações
