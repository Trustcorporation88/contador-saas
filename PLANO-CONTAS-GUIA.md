# Guia do Plano de Contas Padrão Brasileiro - Lei 6.404/76

## 📋 Visão Geral

Este guia apresenta o **Plano de Contas Padrão Brasileiro** conforme a Lei 6.404/76 (Lei das Sociedades por Ações) e Resolução CFC nº 1.484/2017, estruturado para suportar as três formas de tributação:
- **Lucro Real** (IRPJ 15%, 25% lucro extraordinário; CSLL 9%)
- **Lucro Presumido** (IRPJ 15%; CSLL 9%)
- **Simples Nacional** (alíquota progressiva única)

---

## 🏗️ Estrutura Hierárquica

O plano segue a estrutura brasileira padrão com 5 níveis de hierarquia:

```
NÍVEL 0: Classe     (Exemplo: 1 = ATIVO)
NÍVEL 1: Grupo      (Exemplo: 1.1 = Ativo Circulante)
NÍVEL 2: Subgrupo   (Exemplo: 1.1.1 = Caixa e Equivalentes)
NÍVEL 3: Conta      (Exemplo: 1.1.1.01 = Caixa)
NÍVEL 4: Subconta   (Futuro: 1.1.1.01.001 = Caixa Loja 01)
```

### Convenções de Codificação

- **Ativo Circulante**: 1.x.x.xx
- **Ativo Não-Circulante**: 1.2.x.xx
- **Passivo Circulante**: 2.1.x.xx
- **Passivo Não-Circulante**: 2.2.x.xx
- **Patrimônio Líquido**: 3.x.x.xx
- **Receitas Operacionais**: 4.1.x.xx
- **Receitas Não-Operacionais**: 4.2.x.xx
- **Despesas**: 5.1.x.xx

---

## 💼 Estrutura Completa de Contas (100+ contas)

### **ATIVO (Tipo: ASSET)**

#### 1.1 Ativo Circulante
- **1.1.1 Caixa e Equivalentes** (4 contas analíticas)
  - Caixa
  - Bancos - Conta Corrente
  - Bancos - Conta Poupança
  - Aplicações Financeiras

- **1.1.2 Contas a Receber** (4 contas analíticas)
  - Clientes
  - Clientes - Cheques a Receber
  - Adiantamentos a Clientes
  - Provisão para Créditos de Liquidação Duvidosa

- **1.1.3 Estoques** (4 contas analíticas)
  - Matéria Prima
  - Produtos em Elaboração
  - Produtos Acabados
  - Mercadorias

- **1.1.4 Despesas Antecipadas** (3 contas analíticas)
  - Seguros Antecipados
  - Aluguel Antecipado
  - Assinaturas e Licenças Antecipadas

#### 1.2 Ativo Não-Circulante

- **1.2.1 Imobilizado** (7 contas analíticas)
  - Máquinas e Equipamentos
  - Veículos
  - Móveis e Utensílios
  - Imóveis
  - Depreciação Acumulada - Máquinas
  - Depreciação Acumulada - Veículos
  - Depreciação Acumulada - Móveis

- **1.2.2 Intangível** (4 contas analíticas)
  - Marcas e Patentes
  - Software e Sistemas
  - Goodwill
  - Amortização Acumulada

- **1.2.3 Investimentos** (3 contas analíticas)
  - Ações de Coligadas
  - Ações de Controladas
  - Investimentos em Terceiros

---

### **PASSIVO (Tipo: LIABILITY)**

#### 2.1 Passivo Circulante

- **2.1.1 Contas a Pagar** (2 contas analíticas)
  - Fornecedores
  - Despesas a Pagar

- **2.1.2 Obrigações Fiscais** (7 contas analíticas com tax_code)
  - ICMS a Pagar *(tax_code: ICMS)*
  - COFINS a Pagar *(tax_code: COFINS)*
  - PIS a Pagar *(tax_code: PIS)*
  - ISS a Pagar *(tax_code: ISS)*
  - IRPJ a Pagar *(tax_code: IRPJ)*
  - CSLL a Pagar *(tax_code: CSLL)*
  - Impostos e Taxas a Pagar

- **2.1.3 Obrigações Trabalhistas** (4 contas analíticas)
  - Salários a Pagar
  - FGTS a Pagar
  - INSS a Pagar
  - Adiantamentos a Funcionários

- **2.1.4 Empréstimos Curto Prazo** (2 contas analíticas)
  - Empréstimos Bancários
  - Financiamentos

#### 2.2 Passivo Não-Circulante

- **2.2.1 Empréstimos Longo Prazo** (2 contas analíticas)
  - Empréstimos Bancários Longo Prazo
  - Debêntures

- **2.2.2 Impostos Diferidos** (1 conta analítica)
  - Imposto de Renda Diferido

---

### **PATRIMÔNIO LÍQUIDO (Tipo: EQUITY)**

#### 3.1 Capital Social
- Capital Social Integralizado
- Capital a Integralizar

#### 3.2 Reservas
- Reserva Legal (5% do lucro líquido)
- Reserva de Contingência
- Reserva de Lucros a Realizar

#### 3.3 Lucros ou Prejuízos Acumulados
- Lucros Acumulados
- Prejuízos Acumulados

---

### **RECEITAS (Tipo: REVENUE)**

#### 4.1 Receitas Operacionais

- **4.1.1 Vendas de Produtos** (2 contas analíticas)
  - Vendas Internas
  - Vendas Externas

- **4.1.2 Prestação de Serviços** (1 conta analítica)

- **4.1.3 Outras Receitas Operacionais** (1 conta analítica)

- **4.1.4 Deduções de Receitas** (3 contas analíticas)
  - Devoluções e Abatimentos
  - ICMS sobre Vendas *(tax_code: ICMS)*
  - PIS/COFINS sobre Vendas

#### 4.2 Receitas Não-Operacionais

- **4.2.1 Receitas Financeiras** (2 contas analíticas)
  - Juros Ativos
  - Descontos Obtidos

- **4.2.2 Ganhos em Investimentos** (1 conta analítica)

---

### **DESPESAS (Tipo: EXPENSE)**

#### 5.1 Custos e Despesas

- **5.1.1 Custo da Mercadoria Vendida (CMV)** (3 contas analíticas)
  - Estoque Inicial
  - Compras
  - Estoque Final

- **5.1.2 Despesas Operacionais** (10 contas analíticas)
  - Salários e Encargos
  - Aluguel
  - Utilities (água, luz, gás)
  - Telefone e Internet
  - Despesas de Viagem
  - Consultoria e Serviços
  - Depreciação
  - Manutenção e Reparos
  - Publicidade e Marketing
  - Seguros

- **5.1.3 Despesas Tributárias** (1 conta analítica)
  - Impostos e Taxas

- **5.1.4 Despesas Financeiras** (3 contas analíticas)
  - Juros Passivos
  - Variação Cambial Passiva
  - Descontos Concedidos

- **5.1.5 Outras Despesas Não-Operacionais** (2 contas analíticas)
  - Perdas em Investimentos
  - Doações e Contribuições

---

## 📊 Mapeamento de Impostos

O plano está integrado com as principais obrigações fiscais brasileiras:

| Imposto | Código | Tipo | Aplicação |
|---------|--------|------|-----------|
| **ICMS** | ICMS | LIABILITY / REVENUE | Circulante - Pessoas Jurídicas (exceto LC 116/2003) |
| **COFINS** | COFINS | LIABILITY | Circulante - Lucro Real 7.6%, Simples Nacional |
| **PIS** | PIS | LIABILITY | Circulante - Lucro Real 1.65%, Simples Nacional |
| **ISS** | ISS | LIABILITY | Circulante - Prestadores de Serviço |
| **IRPJ** | IRPJ | LIABILITY | Circulante - Lucro Real/Presumido (15% + 25% PE) |
| **CSLL** | CSLL | LIABILITY | Circulante - Lucro Real/Presumido 9% |

---

## 🔄 Como Usar o Arquivo JSON

### 1. **Importar para Banco de Dados**

#### Exemplo SQL (PostgreSQL):
```sql
-- Criar tabela
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  parent_code VARCHAR(20),
  tax_code VARCHAR(10),
  is_analytical BOOLEAN DEFAULT false,
  description TEXT,
  level INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Importar JSON
INSERT INTO chart_of_accounts 
SELECT * FROM json_to_recordset(pg_read_file('/path/to/plano-contas-padrao.json', 'accounts')) 
AS x(id UUID, code VARCHAR, name VARCHAR, type VARCHAR, parent_code VARCHAR, tax_code VARCHAR, is_analytical BOOLEAN, description TEXT, level INTEGER);
```

#### Exemplo SQL (MySQL):
```sql
-- Criar tabela
CREATE TABLE chart_of_accounts (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  parent_code VARCHAR(20),
  tax_code VARCHAR(10),
  is_analytical BOOLEAN DEFAULT 0,
  description TEXT,
  level INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_parent (parent_code)
);

-- Importar usando MySQL Workbench ou ferramenta similar
LOAD DATA LOCAL INFILE '/path/to/plano-contas-padrao.json' ...
```

### 2. **Estrutura de Dados (Campo a Campo)**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único universal |
| `code` | String | Código contábil (ex: 1.1.1.01) |
| `name` | String | Nome da conta |
| `type` | Enum | ASSET \| LIABILITY \| EQUITY \| REVENUE \| EXPENSE |
| `parent_code` | String | Código da conta pai (para hierarquia) |
| `tax_code` | String | ICMS \| COFINS \| PIS \| ISS \| IRPJ \| CSLL (se aplicável) |
| `is_analytical` | Boolean | `true` = conta analítica (pode receber lançamentos) |
| `description` | String | Descrição completa |
| `level` | Integer | Nível hierárquico (0-3) |

### 3. **Exemplos de Lançamentos**

#### Venda de Mercadoria (Lucro Real - ICMS)
```
Débito: 1.1.2.01 (Clientes)                 R$ 1.190,00
  Crédito: 4.1.1.01 (Vendas Internas)                    R$ 1.000,00
  Crédito: 2.1.2.01 (ICMS a Pagar)                       R$   190,00
```

#### Recebimento de Salários
```
Débito: 5.1.2.01 (Salários e Encargos)      R$ 5.000,00
  Crédito: 2.1.3.01 (Salários a Pagar)                   R$ 5.000,00
```

#### Depreciação de Equipamento
```
Débito: 5.1.2.07 (Depreciação)              R$   500,00
  Crédito: 1.2.1.05 (Deprec. Acum. - Eq.)               R$   500,00
```

### 4. **Conformidade com Legislação**

#### Lei 6.404/76 - Estrutura Obrigatória
✅ Divisão entre Circulante e Não-Circulante  
✅ Distinção entre Operacional e Não-Operacional  
✅ Apresentação por Ordem Decrescente de Liquidez  
✅ Agrupamento por Natureza de Conta  

#### Resolução CFC 1.484/2017
✅ Estrutura Conceitual para Relatórios Financeiros  
✅ Classificação por Tipo (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)  
✅ Suporte a Contas Analíticas (Subcontas)  
✅ Rastreabilidade de Impostos via tax_code  

---

## 🎯 Boas Práticas

### ✓ Recomendações de Uso

1. **Customize conforme necessário**: Adicione subcontas (4º nível) específicas do seu negócio
2. **Use only is_analytical=true**: Apenas contas com `is_analytical: true` podem receber lançamentos diretos
3. **Respeite a hierarquia**: Sempre lance em contas analíticas, nunca em grupos
4. **Mapeie impostos**: Certifique-se de que tax_code está corretamente atribuído
5. **Mantenha backlist**: Guarde cópia do plano original antes de modificações

### ✗ Erros Comuns

- ❌ Lançar em contas não-analíticas (ex: 1.1 Ativo Circulante)
- ❌ Não usar deduções de receita (ICMS, PIS/COFINS)
- ❌ Misturar impostos de diferentes regimes tributários
- ❌ Não acompanhar depreciação acumulada
- ❌ Esquecer de conciliação de caixa

---

## 📈 Relatórios Gerados Automaticamente

Com este plano, você pode gerar automaticamente:

1. **Balanço Patrimonial** (BP)
   - Ativo (Circulante + Não-Circulante)
   - Passivo (Circulante + Não-Circulante)
   - Patrimônio Líquido

2. **Demonstração do Resultado do Exercício** (DRE)
   - Receitas Operacionais (menos deduções)
   - Custo da Mercadoria Vendida
   - Lucro Bruto
   - Despesas Operacionais
   - EBIT (Lucro Operacional)
   - Resultado Não-Operacional
   - EBITDA e Lucro Líquido

3. **Fluxo de Caixa** (via movimento em contas de caixa)

4. **Apuração de Impostos** (via tax_code)

---

## 🔧 Suporte a Formas de Tributação

### Lucro Real
- Implementa separação de IRPJ (15%) e CSLL (9%)
- Suporta adição/exclusão fiscal
- Deduções de ICMS, PIS, COFINS

**Contas principais**: 2.1.2.01, 2.1.2.05, 2.1.2.06

### Lucro Presumido
- Presunção de lucro (8-32% da receita)
- IRPJ simplificado (15%)
- CSLL sobre presunção

**Contas principais**: 2.1.2.05, 2.1.2.06

### Simples Nacional
- Alíquota progressiva única por faturamento
- Sem separação de impostos
- Recolhimento unificado

**Contas principais**: Integrar em conta única de tributos

---

## 📚 Referências Normativas

- **Lei nº 6.404/1976** - Lei das Sociedades por Ações (Lei de Sociedades Anônimas)
- **Lei nº 11.638/2007** - Alterações à Lei 6.404/76
- **Lei nº 11.941/2009** - Alterações a leis tribut árias
- **Resolução CFC nº 1.484/2017** - Estrutura Conceitual para Relatórios Financeiros Digitais
- **Resolução CFC nº 1.419/2012** - Normas de Auditoria
- **Instrução Normativa RFB nº 1.700/2017** - SPED Contábil
- **Decreto nº 9.580/2018** - Regulamento do Imposto de Renda

---

## 💡 Próximas Etapas

1. Importar arquivo JSON em seu sistema ERP/Contábil
2. Criar subcontas analíticas específicas da empresa
3. Configurar integração com módulo de impostos
4. Calibrar depreciação conforme legislação fiscal
5. Testar com transações piloto antes de produção

---

**Versão**: 1.0  
**Data**: 17/05/2026  
**Responsável**: Contabilidade Brasil Contador  
**Status**: ✅ Pronto para Implementação
