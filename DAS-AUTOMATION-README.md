# DAS - Documento de Arrecadação do Simples

## 📋 Visão Geral

Sistema **100% online** de automação para geração, acompanhamento e gerenciamento de boletos **DAS (Documento de Arrecadação do Simples)**.

### ✨ Diferenciais

- ✅ Geração automática mensal de DAS
- ✅ Cálculo automático integrado com apuração de impostos
- ✅ Código de barras FEBRABAN completo
- ✅ Rastreamento de vencimentos e alertas automáticos
- ✅ Registro de pagamentos com comprovante
- ✅ Histórico de eventos (auditoria completa)
- ✅ Suporte para Simples Nacional, Lucro Real e Lucro Presumido
- ✅ Hash de integridade SHA-256 para segurança
- ✅ Interface web moderna e responsiva

---

## 🏗️ Arquitetura Técnica

### Backend (Node.js + TypeScript)

**Componentes principais:**

```
backend/src/
├── models/dtos/dasDTO.ts          # Tipos e interfaces
├── services/dasService.ts         # Lógica de negócio
├── services/dasScheduler.ts       # Agendamento automático
├── controllers/dasController.ts   # Endpoints da API
├── routes/das.ts                  # Roteamento
├── migrations/add_das_boletos.ts  # Schema do banco
└── utils/barcodeGenerator.ts      # Gerador de código de barras
```

**Banco de Dados (PostgreSQL):**

```sql
-- Tabela principal de boletos DAS
das_boletos (
  id UUID PRIMARY KEY,
  company_id UUID (FK),
  data_emissao DATE,
  data_vencimento DATE,
  valor_total DECIMAL,
  status ENUM (EMITIDO, PENDENTE, PAGO, VENCIDO, CANCELADO),
  codigo_barras VARCHAR (44),
  linha_digitavel VARCHAR,
  -- ... mais campos
)

-- Histórico de eventos (auditoria)
das_eventos (
  id UUID PRIMARY KEY,
  das_boleto_id UUID (FK),
  tipo_evento ENUM (GERADO, EMITIDO, PAGAMENTO_REGISTRADO, ...),
  usuario_id UUID (FK),
  ocorrencia_at TIMESTAMP,
  -- ... mais campos
)

-- Configuração de agendamento por empresa
das_agendamentos (
  id UUID PRIMARY KEY,
  company_id UUID (FK),
  regime_tributario VARCHAR,
  auto_gerar BOOLEAN,
  dias_antes_alerta INT,
  ultimo_agendamento TIMESTAMP,
  proximo_agendamento TIMESTAMP,
)
```

### Frontend (React + TypeScript)

**Componentes:**

```
frontend/src/
├── pages/DAS/DASPage.tsx          # Página principal
├── services/dasService.ts         # Cliente HTTP
└── components/DAS/
    ├── DASForm.tsx                # Formulário de criação
    ├── DASList.tsx                # Tabela de listagem
    └── DASPaymentForm.tsx         # Formulário de pagamento
```

---

## 📡 API Endpoints

### Criar/Gerar DAS

```bash
POST /api/v1/das/:companyId/das/generate
Content-Type: application/json

{
  "mes_competencia": 5,
  "ano_competencia": 2026,
  "valor_original": 1250.50,
  "regime_tributario": "SIMPLES",
  "juros": 0,
  "multa": 0,
  "desconto": 0,
  "observacoes": "DAS do mês 05/2026"
}

Response (201):
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "data_vencimento": "2026-06-20",
    "valor_total": 1250.50,
    "status": "EMITIDO",
    "numero_boleto": "202605000000001",
    "codigo_barras": "03300201202605000000001125050060620...",
    "linha_digitavel": "033.0201 125050 06062020 5 202605000000001",
    ...
  },
  "message": "DAS gerado com sucesso"
}
```

### Listar DAS com filtros

```bash
GET /api/v1/das/:companyId/das?status=PENDENTE&regime_tributario=SIMPLES&somente_nao_pagos=true&page=1&limit=20
```

**Query Parameters:**

| Param | Type | Descrição |
|-------|------|-----------|
| `status` | EMITIDO\|PENDENTE\|PAGO\|VENCIDO\|CANCELADO | Filtrar por status |
| `regime_tributario` | SIMPLES\|LUCRO_REAL\|LUCRO_PRESUMIDO | Filtrar por regime |
| `mes_competencia` | number | Mês (1-12) |
| `ano_competencia` | number | Ano |
| `somente_atrasadas` | boolean | Apenas DAS vencidos |
| `somente_nao_pagos` | boolean | Apenas não pagos |
| `sort_by` | data_vencimento\|valor_total\|status | Ordenação |
| `sort_order` | asc\|desc | Ordem crescente/decrescente |
| `page` | number | Página (padrão: 1) |
| `limit` | number | Itens por página (padrão: 20, máx: 100) |

### Buscar DAS específico

```bash
GET /api/v1/das/:companyId/das/:dasId
```

### Registrar pagamento

```bash
POST /api/v1/das/:companyId/das/:dasId/pay
Content-Type: application/json

{
  "data_pagamento": "2026-06-15",
  "valor_pago": 1250.50,
  "juros_pago": 0,
  "multa_paga": 0,
  "numero_comprovante": "TED123456789"
}

Response (200):
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "PAGO",
    "valor_pago": 1250.50,
    "data_pagamento": "2026-06-15",
    ...
  },
  "message": "Pagamento registrado com sucesso"
}
```

### Atualizar DAS

```bash
PATCH /api/v1/das/:companyId/das/:dasId
Content-Type: application/json

{
  "juros": 50.00,
  "multa": 0,
  "desconto": 100.00,
  "observacoes": "Desconto concedido"
}
```

### Cancelar DAS

```bash
DELETE /api/v1/das/:companyId/das/:dasId
Content-Type: application/json

{
  "motivo": "DAS duplicado, cancelando"
}
```

### Agendamento automático

```bash
# Buscar configuração
GET /api/v1/das/:companyId/das/agendamento/SIMPLES

# Atualizar configuração
PUT /api/v1/das/:companyId/das/agendamento/SIMPLES
Content-Type: application/json

{
  "auto_gerar": true,
  "dias_antes_alerta": 3,
  "codigos_receita": {
    "SIMPLES": "0201",
    "LUCRO_REAL": "0200"
  }
}
```

---

## 🤖 Automação e Scheduler

### Execução Automática Mensal

O **DASScheduler** roda diariamente e:

1. **01:00 UTC** - Marca DAS como VENCIDO se data_vencimento < hoje
2. **02:00 UTC** - Verifica DAS com vencimento próximo (configurable: 3 dias por padrão)
3. **03:00 UTC** - Gera automaticamente DAS para o mês corrente (se configurado)

### Setup do Scheduler

**1. No arquivo de inicialização (src/server.ts ou src/index.ts):**

```typescript
import { DASScheduler } from './services/dasScheduler';
import cron from 'node-cron';

// Executar agendamentos automaticamente
// Atualizar vencidos: 01:00 UTC
cron.schedule('0 1 * * *', async () => {
  console.log('[CRON] Atualizando DAS vencidos...');
  await DASScheduler.atualizarVencidos();
});

// Verificar vencimentos próximos: 02:00 UTC
cron.schedule('0 2 * * *', async () => {
  console.log('[CRON] Verificando vencimentos próximos...');
  await DASScheduler.verificarVencimentosProximos();
});

// Gerar DAS automático: 03:00 UTC (20º dia do mês, +1)
// Recomendação: executar entre dias 15-19 para gerar DAS do próximo mês
cron.schedule('0 3 15-19 * *', async () => {
  console.log('[CRON] Gerando DAS mensais...');
  await DASScheduler.processarGeracaoMensal();
});
```

**2. Instalar dependência:**

```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

---

## 🗄️ Integração com Apuração de Impostos

O DAS é automaticamente calculado a partir da **apuração de impostos (tax_calculations)**:

```typescript
// Exemplo: Gerar DAS a partir de apuração
const calculo = await DASService.calcularDAS(
  companyId,
  5, // mês
  2026, // ano
  'SIMPLES' // regime
);

// Resultado do cálculo
{
  mes_competencia: 5,
  ano_competencia: 2026,
  data_vencimento: '2026-06-20',
  regime_tributario: 'SIMPLES',
  valor_base: 1250.50,
  valor_total: 1250.50,
  percentual_aliquota: 6.5,
  observacoes: [...]
}
```

### Fluxo de Integração

```
1. Usuário apura impostos do mês via TaxCalculationService
   ↓
2. Sistema calcula total_tax da apuração
   ↓
3. DASScheduler busca apuração do mês
   ↓
4. Valida se regime é SIMPLES
   ↓
5. Cria boleto DAS com valor = total_tax
   ↓
6. Gera código de barras FEBRABAN
   ↓
7. Armazena no banco + auditoria
```

---

## 📊 Código de Barras FEBRABAN

### Formato (44 dígitos)

```
BBBCCCCCVVVVVVVVVVDDDDDDDDXDDVVVVVVVVVV
```

- **BBB**: Código do Banco (033 para DAS)
- **CCCCC**: Código de Receita (0201 = Simples Nacional)
- **VVVVVVVVVV**: Valor em centavos (10 dígitos)
- **DDDDDDDD**: Data de Vencimento (DDMMYY)
- **X**: Dígito verificador (módulo 11)
- **DDVVVVVVVVVV**: Sequência + data + valor

### Linha Digitável

Formato amigável para digitação:
```
BBB.CCCCC VVVVVVVVVV DDDDDDDD DDVVVVVVVVVV
```

---

## 🔐 Segurança e Auditoria

### Hash de Integridade (SHA-256)

Cada DAS gerado possui um hash única que garante:

```typescript
hash = SHA256({
  codigo_receita: "0201",
  numero_boleto: "202605000000001",
  valor_total: 1250.50,
  data_vencimento: "2026-06-20T00:00:00.000Z"
})
```

### Trilha de Auditoria

Todos os eventos de DAS são registrados:

```sql
INSERT INTO das_eventos (
  das_boleto_id,
  tipo_evento,
  usuario_id,
  ocorrencia_at,
  dados_novos
) VALUES (
  'uuid',
  'GERADO',
  'user-uuid',
  NOW(),
  '{"regime": "SIMPLES", "valor": 1250.50}'
)
```

### Tipos de Eventos Auditados

| Evento | Descrição |
|--------|-----------|
| `GERADO` | DAS criado |
| `EMITIDO` | DAS emitido |
| `VENCIMENTO_PROXIMO` | Alerta de vencimento próximo |
| `VENCIDO` | DAS marcado como vencido |
| `PAGAMENTO_REGISTRADO` | Pagamento registrado |
| `CANCELADO` | DAS cancelado |
| `ALTERADO` | Dados alterados (juros, multa, etc) |

---

## 🚀 Instalação e Setup

### 1. Executar Migration

```bash
npm run migrate:up
# ou com knex diretamente
npx knex migrate:latest
```

### 2. Registrar Rotas

As rotas de DAS já estão registradas em `/api/v1/das` (veja `routes/index.ts`).

### 3. Iniciar Scheduler (Opcional)

Se não usar cron externo, configure no `src/server.ts`:

```typescript
import { DASScheduler } from './services/dasScheduler';

// Executar todas as tarefas a cada dia
setInterval(() => {
  DASScheduler.executarTodasAsTarefas();
}, 24 * 60 * 60 * 1000); // 24h
```

### 4. Testes

```bash
# Gerar DAS de teste
curl -X POST http://localhost:3000/api/v1/das/123/generate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mes_competencia": 5,
    "ano_competencia": 2026,
    "valor_original": 1250.50,
    "regime_tributario": "SIMPLES"
  }'

# Listar DAS
curl http://localhost:3000/api/v1/das/123?status=PENDENTE \
  -H "Authorization: Bearer TOKEN"
```

---

## 📝 Exemplos de Uso

### Caso 1: Gerar DAS Simples Nacional

```typescript
const result = await DASService.create(companyId, userId, {
  mes_competencia: 5,
  ano_competencia: 2026,
  valor_original: 1250.50,
  regime_tributario: 'SIMPLES',
  observacoes: 'DAS de maio/2026'
});

console.log(result.data); // DAS com código de barras pronto
```

### Caso 2: Registrar Pagamento

```typescript
const pagamento = await DASService.registrarPagamento(
  companyId,
  dasId,
  userId,
  {
    data_pagamento: '2026-06-15',
    valor_pago: 1250.50,
    numero_comprovante: 'TED123456789'
  }
);

console.log(pagamento.data.status); // 'PAGO'
```

### Caso 3: Listar apenas DAS atrasados

```typescript
const atrasados = await DASService.list(companyId, {
  somente_atrasadas: true,
  somente_nao_pagos: true,
  sort_by: 'data_vencimento',
  sort_order: 'asc'
});

// Alertar para pagamento imediato
for (const das of atrasados.data) {
  console.log(`Boleto ${das.numero_boleto} venceu em ${das.data_vencimento}`);
}
```

### Caso 4: Configurar automação

```typescript
const agendamento = await DASService.atualizarAgendamento(
  companyId,
  'SIMPLES',
  userId,
  {
    auto_gerar: true,
    dias_antes_alerta: 3,
    codigos_receita: {
      'SIMPLES': '0201',
      'LUCRO_REAL': '0200'
    }
  }
);

console.log('Automação configurada!', agendamento);
```

---

## 🧪 Testes

### Teste Unitário: Geração de Código de Barras

```typescript
import { generateBarCode, validarCodigoBarras } from '../utils/barcodeGenerator';

const codigoBarras = generateBarCode(
  '0201', // código receita
  '202605000000001', // número boleto
  '1250.50', // valor
  new Date('2026-06-20') // vencimento
);

expect(codigoBarras.length).toBe(44);
expect(validarCodigoBarras(codigoBarras)).toBe(true);
```

### Teste de Integração: Criar e Pagar DAS

```typescript
// 1. Criar
const created = await DASService.create(companyId, userId, {
  mes_competencia: 5,
  ano_competencia: 2026,
  valor_original: 1250.50,
  regime_tributario: 'SIMPLES'
});

expect(created.success).toBe(true);
expect(created.data.status).toBe('EMITIDO');

// 2. Registrar pagamento
const paid = await DASService.registrarPagamento(
  companyId,
  created.data.id,
  userId,
  {
    data_pagamento: '2026-06-15',
    valor_pago: 1250.50
  }
);

expect(paid.success).toBe(true);
expect(paid.data.status).toBe('PAGO');
```

---

## 📱 UI/Frontend

### Página de DAS

- **Dashboard**: Cartões com resumo (total a pagar, atrasados, pagos)
- **Filtros**: Por regime, status, data, atrasados, não pagos
- **Tabela**: Listagem com colunas sortáveis
- **Ações**: Criar, editar, pagar, cancelar, download boleto

### Modals

1. **Criar/Editar DAS**: Formulário com validações
2. **Registrar Pagamento**: Data, valor, comprovante
3. **Detalhes**: Visualizar todas as informações + código de barras

---

## ⚙️ Configurações Padrão

### Vencimento DAS

Padrão: **20º dia do mês seguinte** (configurável)

```typescript
const dataVencimento = new Date(ano, mes, 20); // mes + 1
```

### Código de Receita

| Regime | Código |
|--------|--------|
| Simples Nacional | 0201 |
| Lucro Real | 0200 |
| Lucro Presumido | 0200 |

### Alertas de Vencimento

Padrão: **3 dias antes** do vencimento (configurável)

---

## 🔗 Referências

- [FEBRABAN - Documento de Arrecadação do Simples](https://www.febraban.org.br)
- [Receita Federal - Simples Nacional](https://www8.receita.fazenda.gov.br/SimplesNacional/)
- [Banco do Brasil - DAS](https://www.bb.com.br)

---

## 📞 Suporte

Para dúvidas ou issues, abra uma issue no GitHub ou entre em contato via email.

**Versão:** 1.0.0  
**Última atualização:** 2026-05-24  
**Status:** ✅ Produção
