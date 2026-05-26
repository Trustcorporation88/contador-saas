# 🚀 GUIA RÁPIDO: LANÇAMENTOS RECORRENTES

## Objetivo
Permitir que você (contador) crie "templates" de lançamentos que se repetem automaticamente (aluguel, folha, contas, etc.). O sistema cria automaticamente todo mês (ou outro período) SEM você precisar fazer nada.

---

## 📱 Como Usar (para Contadores)

### 1️⃣ Criar um Lançamento Recorrente

**Quando usar:** Você tem um gasto que acontece toda semana/mês/ano?

```bash
POST /api/v1/companies/{id}/recurring-transactions

{
  "description": "Aluguel - Loja Centro",
  "amount": 2500.50,
  "debitAccount": "3fa85f64-5717-4562-b3fc-2c963f66afa6",     # Conta para DÉBITO (saída)
  "creditAccount": "6fa85f64-5717-4562-b3fc-2c963f66afa7",    # Conta para CRÉDITO (entrada)
  "frequency": "MENSAL",                                         # DIARIO, MENSAL ou ANUAL
  "startDate": "2025-01-01",                                     # Quando começa?
  "endDate": "2026-12-31"                                        # Quando termina? (opcional)
}
```

**O que o sistema faz:**
- ✅ Verifica se as contas existem
- ✅ Valida o valor (deve ser > 0)
- ✅ Calcula próxima execução automática
- ✅ Salva no banco de dados

**Resposta:**
```json
{
  "id": "a1b2c3d4-e5f6-4789-abcd-ef1234567890",
  "description": "Aluguel - Loja Centro",
  "amount": 2500.50,
  "frequency": "MENSAL",
  "nextExecutionDate": "2025-02-01",    # Próxima vez que vai rodar
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00Z"
}
```

---

### 2️⃣ Ver Todos Seus Lançamentos Recorrentes

```bash
GET /api/v1/companies/{id}/recurring-transactions?status=active&page=1&limit=20
```

**O que retorna:**
```json
{
  "data": [
    {
      "id": "a1b2c3d4...",
      "description": "Aluguel - Loja Centro",
      "amount": 2500.50,
      "frequency": "MENSAL",
      "nextExecutionDate": "2025-02-01",
      "isActive": true
    },
    ...
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,           # Você tem 5 lançamentos recorrentes
    "totalPages": 1
  }
}
```

---

### 3️⃣ Desativar um Lançamento (Parar de Repetir)

**Quando usar:** Aluguel venceu? Folha de pagamento mudou?

```bash
PATCH /api/v1/companies/{id}/recurring-transactions/{id}

{
  "isActive": false
}
```

**Resultado:** Lançamento para de repetir. Histórico é mantido.

---

### 4️⃣ Ver Histórico de Execuções

**Quando usar:** Você quer saber se o lançamento foi criado?

```bash
GET /api/v1/companies/{id}/recurring-transactions/{id}/executions?page=1&limit=30
```

**O que retorna:**
```json
{
  "data": [
    {
      "executionDate": "2025-02-01",
      "status": "SUCCESS",              # Funcionou!
      "journalEntryId": "j1j2j3j4...",  # ID do lançamento criado
      "executedAt": "2025-02-01T00:05:15Z"
    },
    {
      "executionDate": "2025-01-01",
      "status": "FAILED",               # Erro!
      "errorMessage": "Conta não encontrada",
      "executedAt": "2025-01-01T00:05:20Z"
    }
  ],
  "pagination": {
    "total": 12,                        # 12 vezes foi executado
    "page": 1
  }
}
```

---

### 5️⃣ Ver TODOS os Históricos (Dashboard)

```bash
GET /api/v1/companies/{id}/recurring-transactions/executions/all?page=1&limit=50
```

**O que retorna:** Histórico completo de TODAS as recorrências da empresa (útil para dashboard)

---

## 🔄 Como Funciona Automaticamente (você não precisa fazer nada!)

### O Cron Job

```
⏰ Todos os dias às 00:05 UTC (5 minutos após meia-noite)
   ↓
🔍 Sistema procura por lançamentos que vencerem HOJE
   ↓
📝 Para cada um, cria automaticamente o lançamento contábil
   ↓
✅ Registra: sucesso ou erro
   ↓
📅 Calcula próxima execução (próximo mês/semana/ano)
```

---

## 📊 Exemplo de Caso Real

**Cenário:** Você gerencia uma empresa com aluguel mensal de R$ 2.500

### Dia 1° (Criação)
```
POST /companies/abc123/recurring-transactions
{
  "description": "Aluguel - Sala 201",
  "amount": 2500.00,
  "debitAccount": "conta-despesa-aluguel",
  "creditAccount": "conta-caixa",
  "frequency": "MENSAL",
  "startDate": "2025-01-15"
}
↓
Resposta: nextExecutionDate = 2025-02-15
```

### Dia 15 (Primeira Execução - Automática)
```
00:05 UTC → Cron Job roda
Procura: templates com nextExecutionDate = 2025-02-15
Encontra: Aluguel - Sala 201
Cria: Lançamento contábil automático
  - Débito: Despesa com Aluguel (2500.00)
  - Crédito: Caixa (2500.00)
Atualiza: nextExecutionDate = 2025-03-15
Registra: status = SUCCESS
```

### Dia 15 do Próximo Mês (2ª Execução)
```
Repete automaticamente...
```

### Sempre assim!
```
Até você desativar (PATCH isActive=false)
OU até a endDate terminar
```

---

## ⚠️ Validações que Fazem Sentido

Você **não consegue** criar um lançamento recorrente se:

| Erro | Por quê? |
|------|---------|
| ❌ Conta de débito não existe | Sistema não consegue lançar |
| ❌ Conta de crédito não existe | Sistema não consegue lançar |
| ❌ Contas são iguais | Não são partidas dobradas |
| ❌ Valor <= 0 | Lançamentos precisam de valor |
| ❌ Data fim < Data início | Não faz lógica |
| ❌ Frequência inválida | Só: DIARIO, MENSAL, ANUAL |

---

## 🆘 Troubleshooting

### "Erro: Contas não encontradas"
- ✅ Copie os UUIDs corretos das contas
- ✅ Verifique se as contas estão ATIVAS
- ✅ Verifique se pertencem à empresa certa

### "Lançamento não foi criado ontem à noite"
- ✅ Verificar se status = "success" no histórico
- ✅ Pode estar agendado para data diferente
- ✅ Checar se lançamento não foi criado 2x (evitar duplicatas)

### "Quero parar de repetir"
- ✅ PATCH com `"isActive": false`
- ✅ Histórico antigo é mantido
- ✅ Pode reativar depois (PATCH `"isActive": true`)

---

## 📈 Dicas de Uso

### 1. Organize por Tipo
```
✅ Use bons nomes:
  - "Aluguel - Loja Centro (mensal)"
  - "Folha Pagamento - Funcionários (mensal)"
  - "Internet/Telefone (mensal)"
  - "Almoço Gerencial (diário)"

❌ Evite:
  - "Despesa"
  - "Lançamento"
  - "Coisa"
```

### 2. Frequências Corretas
- **DIARIO:** Café, pão, gastos diários pequenos
- **MENSAL:** Aluguel, internet, folha, contas
- **ANUAL:** Seguro, renovações anuais

### 3. Use Datas Realistas
```
❌ Errado:
  startDate: "1900-01-01" (muito antigo!)
  endDate: "2050-12-31" (muito futuro!)

✅ Certo:
  startDate: "2025-02-01" (próximo mês)
  endDate: "2026-01-31" (1 ano depois)
```

---

## 🔒 Segurança

O sistema:
- ✅ Valida que você pertence à empresa
- ✅ Nunca mostra dados de outras empresas
- ✅ Registra quem criou cada lançamento
- ✅ Mantém histórico completo (rastreabilidade)

---

## 📱 Exemplo com cURL

```bash
# 1. Criar
curl -X POST \
  "http://api.contador.com/api/v1/companies/f47ac10b-58cc-4372-a567-0e02b2c3d479/recurring-transactions" \
  -H "Authorization: Bearer seu_token_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Aluguel",
    "amount": 2500.50,
    "debitAccount": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "creditAccount": "6fa85f64-5717-4562-b3fc-2c963f66afa7",
    "frequency": "MENSAL",
    "startDate": "2025-02-01"
  }'

# 2. Listar
curl -X GET \
  "http://api.contador.com/api/v1/companies/f47ac10b-58cc-4372-a567-0e02b2c3d479/recurring-transactions?status=active" \
  -H "Authorization: Bearer seu_token_aqui"

# 3. Ver histórico
curl -X GET \
  "http://api.contador.com/api/v1/companies/f47ac10b-58cc-4372-a567-0e02b2c3d479/recurring-transactions/a1b2c3d4-e5f6-4789-abcd-ef1234567890/executions" \
  -H "Authorization: Bearer seu_token_aqui"

# 4. Desativar
curl -X PATCH \
  "http://api.contador.com/api/v1/companies/f47ac10b-58cc-4372-a567-0e02b2c3d479/recurring-transactions/a1b2c3d4-e5f6-4789-abcd-ef1234567890" \
  -H "Authorization: Bearer seu_token_aqui" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

---

## ✅ Checklist para Usar

- [ ] Tenho as UUIDs das contas (débito e crédito)
- [ ] Contas estão ativas e pertencem à minha empresa
- [ ] Descrição é clara e tem até 255 caracteres
- [ ] Valor é positivo
- [ ] Frequência é DIARIO, MENSAL ou ANUAL
- [ ] Data início é no futuro (ou hoje)
- [ ] Data fim (se tiver) é após a data início
- [ ] Posso testar com um pequeno valor primeiro
- [ ] Vou monitorar o histórico de execuções

---

**Pronto! Seus lançamentos agora se repetem automaticamente! 🎉**

Dúvidas? Ver documentação técnica em: `RECURRING-TRANSACTIONS-IMPLEMENTATION.md`
