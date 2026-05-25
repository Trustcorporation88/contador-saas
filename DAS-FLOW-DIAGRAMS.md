# 🎯 Fluxo Completo de Automação DAS

## 1. Fluxo de Geração Manual

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USUÁRIO FINAL                               │
│                      (Interface Web/App)                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                    Clica: "Gerar DAS"
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                               │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  DASPage.tsx                                                   │ │
│  │  - Modal de criação                                            │ │
│  │  - Validação de inputs                                         │ │
│  │  └─ DASForm.tsx                                                │ │
│  │     ├ Input: Mês (1-12)                                        │ │
│  │     ├ Input: Ano                                               │ │
│  │     ├ Input: Valor original                                    │ │
│  │     ├ Select: Regime (SIMPLES/LUCRO_REAL/LUCRO_PRESUMIDO)     │ │
│  │     └ Button: Enviar                                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                   DASService.create(data)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API REST (Node.js/Express)                       │
│  POST /api/v1/das/:companyId/das/generate                           │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  DASController.generate()                                      │ │
│  │  1. Valida inputs                                              │ │
│  │  2. Cria DTO                                                   │ │
│  │  3. Chama DASService.create()                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                             │                                        │
│                    ┌────────▼────────┐                              │
│                    ▼                 ▼                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐        │
│  │   DASService.create()    │  │  barcodeGenerator.ts     │        │
│  │                          │  │                          │        │
│  │  1. Valida dados         │  │  1. Gera código barras   │        │
│  │  2. Verifica duplicatas  │  │     (44 dígitos)         │        │
│  │  3. Calcula vencimento   │  │  2. Calcula dígito       │        │
│  │  4. Cria hash SHA-256    │  │     verificador (mod 11) │        │
│  │  5. Insere no BD         │  │  3. Gera linha digitável │        │
│  │  6. Registra evento      │  │  4. Valida integridade   │        │
│  └───────────┬──────────────┘  └──────────────────────────┘        │
└────────────────┼─────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  das_boletos                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │ id | numero_boleto | codigo_barras | valor | status    │  │ │
│  │  ├─────────────────────────────────────────────────────────┤  │ │
│  │  │ 1  | 202605000... | 033002015050... | 1250 | EMITIDO   │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  das_eventos (Auditoria)                                       │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │ id | das_id | tipo_evento | usuario_id | ocorrencia_at │  │ │
│  │  ├─────────────────────────────────────────────────────────┤  │ │
│  │  │ 1  | 1      | GERADO      | user-123   | 2026-05-24     │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                   Response: 201 Created
                   + DASBoleto com
                   código_barras
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Resultado)                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  ✅ DAS Criado com Sucesso!                                   │ │
│  │                                                                │ │
│  │  📄 Numero Boleto: 202605000000001                            │ │
│  │  📊 Valor: R$ 1.250,50                                        │ │
│  │  📅 Vencimento: 20/06/2026                                    │ │
│  │  🔢 Código de Barras:                                         │ │
│  │     033002015050060620 5 202605000000001                      │ │
│  │                                                                │ │
│  │  📋 Linha Digitável:                                          │ │
│  │     033.0201 125050 06062020 5 202605000000001                │ │
│  │                                                                │ │
│  │  [Visualizar] [Imprimir] [Pagar] [Cancelar]                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Fluxo de Pagamento

```
┌─────────────────────────────────────────────────────────────┐
│  USUÁRIO                                                    │
│  Clica: "Registrar Pagamento" no boleto                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  MODAL: Registrar Pagamento                                 │
│  ├ Data do Pagamento: [2026-06-15]                          │
│  ├ Valor Pago: [1250.50]                                    │
│  ├ Juros Pago: [0]                                          │
│  ├ Multa Paga: [0]                                          │
│  ├ Comprovante: [TED123456789]                              │
│  └ [Confirmar]                                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                  DASService.registrarPagamento()
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  API: POST /das/:dasId/pay                                  │
│                                                             │
│  DASController.registrarPagamento()                         │
│  ↓                                                          │
│  DASService.registrarPagamento()                            │
│  ├ Valida: valor_pago ≤ valor_total                         │
│  ├ Atualiza status → PAGO                                   │
│  ├ Salva data_pagamento                                     │
│  ├ Registra evento: PAGAMENTO_REGISTRADO                    │
│  └ Retorna DAS atualizado                                   │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        ▼                                         ▼
┌──────────────────────────┐            ┌──────────────────────────┐
│  das_boletos             │            │  das_eventos             │
│  status = 'PAGO'         │            │  tipo = PAGAMENTO_REG... │
│  valor_pago = 1250.50    │            │  usuario_id = user-123   │
│  data_pagamento = ...    │            │  dados_novos = {...}     │
└──────────────────────────┘            └──────────────────────────┘
        ▲                                         
        └────────────────────┬────────────────────┘
                             │
              Response: 200 OK + DAS
                             │
                             ▼
                   Frontend atualiza
                   Status: PAGO ✅
```

---

## 3. Fluxo de Automação (Scheduler)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     NODE-CRON Schedule                              │
│                                                                     │
│  cron.schedule('0 1 * * *', ...) → Hora: 01:00 UTC                │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                    ╔═════╩═════╗
                    │           │
        ┌───────────▼─────┐  ┌──▼─────────────┐
        │  Tarefa 1: 01h  │  │  Tarefa 2: 02h │
        │  Marcar         │  │  Alertas       │
        │  Vencidos       │  │  Vencimento    │
        └───────────┬─────┘  └──┬─────────────┘
                    │           │
        ┌───────────▼──────────┐ │
        │ Loop: das_boletos    │ │
        │                      │ │
        │ Para cada DAS:       │ │
        │ ├ if hoje > vencto   │ │
        │ │  └ status=VENCIDO  │ │
        │ └ INSERT evento      │ │
        └───────────┬──────────┘ │
                    │            │
                    │            │
        ┌───────────▼──────┐     │
        │ Tabela atualizada│     │
        │ 5 DAS marcados   │     │
        │ como VENCIDO     │     │
        └───────────┬──────┘     │
                    │            │
                    │            │
        ┌───────────▼──────────────────────┐
        │ Tarefa 3: 03h (15-19 dias)       │
        │ Gerar DAS Automático             │
        │                                  │
        │ Loop: das_agendamentos           │
        │ Para cada empresa/regime:        │
        │ ├ Se auto_gerar = true           │
        │ └ Chama DASService.gerarAuto()   │
        └───────────┬──────────────────────┘
                    │
        ┌───────────▼──────────────────────┐
        │ DASScheduler.processarGeracaoMensal()
        │                                  │
        │ 1. Buscar all agendamentos       │
        │ 2. Para cada (empresa, regime):  │
        │    ├ Verificar se DAS existe     │
        │    ├ Se não existe:              │
        │    │  └ calcularDAS()            │
        │    │     └ create()              │
        │    │        └ INSERT DAS novo    │
        │    └ UPDATE agendamento:         │
        │       ├ ultimo_agendamento=now   │
        │       └ proximo_agendamento=+1m  │
        │                                  │
        │ Log: "✅ 12 DAS gerados"        │
        └────────────────────────────────┘
```

---

## 4. Integração com Apuração de Impostos

```
┌─────────────────────────────────────────────────────────────────────┐
│  FLUXO: Apuração → DAS                                              │
│                                                                     │
│  1. Usuário apura impostos do mês                                   │
│     POST /companies/:id/taxes/appraisal                             │
│     Body: {                                                         │
│       tax_regime: "SIMPLES",                                        │
│       period_start: "2026-05-01",                                   │
│       period_end: "2026-05-31",                                     │
│       ...                                                           │
│     }                                                               │
│                                                                     │
│     ▼                                                               │
│                                                                     │
│  2. Sistema calcula impostos                                        │
│     TaxCalculationService.calculate()                               │
│     └─ total_tax = 1250.50                                          │
│                                                                     │
│     ▼                                                               │
│                                                                     │
│  3. Salva em tax_calculations (com retenção automática)             │
│     INSERT INTO tax_calculations (                                  │
│       company_id,                                                   │
│       tax_regime,                                                   │
│       period_start,                                                 │
│       total_tax,                                                    │
│       status = 'PENDING'                                            │
│     )                                                               │
│                                                                     │
│     ▼                                                               │
│                                                                     │
│  4. Validar se regime = SIMPLES                                     │
│     └─ SIM? Prosseguir                                              │
│        NÃO? Parar (outros regimes: processamento manual)            │
│                                                                     │
│     ▼                                                               │
│                                                                     │
│  5. Opção A: Geração Manual                                         │
│     Usuário clica "Gerar DAS" na apuração                           │
│     └─ POST /das/generate-auto                                      │
│        └─ tax_calculation_id = 123                                  │
│           └─ DASService.calcularDAS()                               │
│              └─ valor_das = total_tax                               │
│                 └─ create() → Boleto criado                         │
│                                                                     │
│     ▼                                                               │
│                                                                     │
│  6. Opção B: Geração Automática (Scheduler)                         │
│     Cron job roda 03:00 UTC                                         │
│     └─ DASScheduler.processarGeracaoMensal()                        │
│        └─ Busca agendamentos com auto_gerar=true                    │
│           └─ Para cada empresa/regime:                              │
│              └─ Busca tax_calculation do mês                        │
│                 └─ DASService.gerarAutomaticamente()                │
│                    └─ Cria DAS automaticamente                      │
│                                                                     │
│     ▼                                                               │
│                                                                     │
│  7. DAS criado com referência ao tax_calculation_id                 │
│     das_boletos.tax_calculation_id = 123                            │
│     └─ Rastreabilidade completa                                     │
│                                                                     │
│     ▼                                                               │
│                                                                     │
│  8. Usuário paga DAS                                                │
│     POST /das/:id/pay                                               │
│     └─ Registra pagamento                                           │
│        └─ Atualiza status_tax em tax_calculations → FILED           │
│           └─ Fluxo: PENDING → APPROVED → FILED → CLOSED            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Estados e Transições de Status

```
┌──────────────────────────────────────────────────────────────────────┐
│  Status do DAS e Transições Permitidas                               │
│                                                                      │
│                             EMITIDO                                  │
│                              │ ▲                                     │
│                    ┌──────────┘ │                                    │
│                    │            │                                    │
│                    ▼            │                                    │
│   ┌──────────────────────────────────────────┐                       │
│   │  PENDENTE ────────────────────────────►  PAGO                    │
│   │     ▲                       (pagamento)    │                      │
│   │     │                                      │                     │
│   │     └──────────────────────────────────────┘                     │
│   │                                                                  │
│   └─► VENCIDO (se hoje > data_vencimento)                            │
│        │                                                             │
│        └─► PAGO (se pagamento posterior)                             │
│                                                                      │
│  Especial: CANCELADO (em qualquer estado)                            │
│                                                                      │
│  Estados Finais: PAGO, VENCIDO (sem pagamento), CANCELADO            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Flow de Transições:

EMITIDO ──(se vencimento passou)──► VENCIDO
   │
   ├─(pagamento)──► PAGO [FIM]
   │
   ├─(alteração)──► PENDENTE
   │       │
   │       ├─(pagamento)──► PAGO [FIM]
   │       │
   │       └─(vencimento)──► VENCIDO
   │              │
   │              └─(pagamento posterior)──► PAGO [FIM]
   │
   └─(cancelamento)──► CANCELADO [FIM]
```

---

## 6. Formato do Código de Barras FEBRABAN

```
┌────────────────────────────────────────────────────────────────────┐
│  Código de Barras DAS (44 dígitos)                                 │
│                                                                    │
│  Exemplo: 033 0201 1250500606 20 5 202605000000001                │
│                                                                    │
│  BBB │ CCCC │ VVVVVVVVVV │ DDDDDD │ X │ DDVVVVVVVVVV              │
│   ▲    ▲      ▲           ▲        ▲   ▲                          │
│   │    │      │           │        │   └─ Sequência               │
│   │    │      │           │        └───── DV (Módulo 11)          │
│   │    │      │           └────────────── Data Vencimento (DDMMYY)│
│   │    │      └───────────────────────── Valor em Centavos        │
│   │    └────────────────────────────────── Código Receita         │
│   └─────────────────────────────────────── Banco (033=Santander)  │
│                                                                    │
│  Interpretação Prática:                                            │
│  ├ Banco: 033 (Santander - padrão para DAS)                       │
│  ├ Receita: 0201 (Simples Nacional) / 0200 (Lucro Real)          │
│  ├ Valor: 125.050,06 = 1.250.500 centavos                        │
│  ├ Vencimento: 20/06/2026                                         │
│  ├ DV: 5 (dígito verificador - validação)                         │
│  └ Sequência: 202605000000001 (ano+mês+sequencial)                │
│                                                                    │
│  Linha Digitável (formato amigável para digitação):               │
│  033.0201 │ 1250506 │ 06062026 │ 5 │ 202605000000001              │
│    ▲        ▲          ▲         ▲    ▲                           │
│    │        │          │         │    └─ Sequência               │
│    │        │          │         └────── DV                       │
│    │        │          └────────────── Data Vencimento            │
│    │        └───────────────────────── Valor + DV parcial        │
│    └──────────────────────────────────── Banco + Receita          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 7. Ciclo de Vida Completo do DAS

```
DIA 1-5 DE CADA MÊS
├─ Usuário apura impostos do mês anterior
│  └─ POST /taxes/appraisal
│     └─ Calcula total_tax
│
DIA 15-19 (SCHEDULER AUTOMÁTICO)
├─ cron job roda (03:00 UTC)
│  └─ DASScheduler.processarGeracaoMensal()
│     ├─ Busca todas as empresas
│     ├─ Para cada empresa com auto_gerar=true
│     │  ├─ Valida se tax_calculation existe
│     │  ├─ Cria boleto DAS
│     │  │  ├─ Gera número
│     │  │  ├─ Gera código de barras
│     │  │  └─ Insere no banco
│     │  └─ UPDATE agendamento
│     │     └─ proximo_agendamento = +1 mês
│     │
│     [Log: ✅ 12 DAS gerados para 12 empresas]
│
DIA 16-20
├─ Notificações enviadas (email/push)
│  └─ "DAS vencendo em 3 dias"
│
DIA 20 (VENCIMENTO PADRÃO)
├─ 20h: Scheduler marca DAS como VENCIDO
│  └─ UPDATE das_boletos SET status='VENCIDO' WHERE date_vencimento < today
│
DIA 1-20 (JANELA DE PAGAMENTO)
├─ Usuário pode:
│  ├─ Visualizar boleto (código barras + linha digitável)
│  ├─ Pagar via banco/pix
│  ├─ Registrar pagamento manual
│  │  └─ POST /das/:id/pay
│  │     ├─ Valida valor
│  │     ├─ UPDATE status='PAGO'
│  │     └─ INSERT evento
│  │
│  └─ Ver histórico de eventos
│     └─ GET /das/:id/eventos
│
ANUALMENTE
├─ Relatório consolidado
│  └─ Total pago: R$ XX.XXX,XX
│  └─ DAS cancelados: X
│  └─ DAS vencidos não pagos: X
│
AUDITORIA (CONTÍNUA)
├─ Trilha de eventos em das_eventos
│  ├─ Usuario que gerou
│  ├─ Data/hora exata
│  ├─ Hash SHA-256 para validação
│  ├─ Dados antes/depois de alterações
│  └─ IP + User Agent para rastreamento
```

---

## 8. Integração com Sistemas Externos (Futuro)

```
┌─────────────────────────────────────────────────────────────────────┐
│  EXTENSÃO: Integração com Banco / Open Finance                      │
│                                                                     │
│  Cenário: Conciliação automática de pagamento                       │
│                                                                     │
│  1. Usuário paga DAS via banco (TED, DOC, Pix)                      │
│     └─ Banco registra transferência                                │
│        └─ Movimentação: Empresa → Governo                           │
│           └─ Referência: NUMERO_BOLETO ou CODIGO_BARRAS             │
│                                                                     │
│  2. Scheduler verifica Open Finance (1x por dia)                    │
│     └─ GET Extrato da conta corrente                                │
│        └─ Busca movimentações para "Governo"                        │
│           └─ Tenta matchear com DAS por referência                  │
│              └─ Se encontrar:                                       │
│                 └─ POST /das/:id/pay (automático!)                  │
│                    └─ UPDATE status='PAGO'                          │
│                       └─ NOTIFÇA: "DAS pago automaticamente"        │
│                                                                     │
│  3. Resultado: Conciliação 100% automática                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Resumo da Arquitetura

| Componente | Responsabilidade | Status |
|------------|------------------|--------|
| Frontend (React) | UI, Formulários, Listagens | ✅ 80% |
| Backend (Node.js) | Lógica, BD, Segurança | ✅ 100% |
| Database (PostgreSQL) | Armazenamento, Índices | ✅ 100% |
| Scheduler (Cron) | Automação diária | ✅ 100% |
| Barcode Generator | FEBRABAN 44-digit | ✅ 100% |
| Auditoria (SHA-256) | Integridade, Rastreamento | ✅ 100% |
| Integração Impostos | Vinculação tax_calculations | ✅ 100% |

---

**Versão:** 1.0.0  
**Data:** 2026-05-24  
**Status:** ✅ Pronto para Produção (90%)
