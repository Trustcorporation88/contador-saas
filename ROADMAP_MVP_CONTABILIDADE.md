# MVP: TOP 5 Funcionalidades de Contabilidade Comercial
**Estratégia**: Lançar COMPLETO com documentação, não com features incompletas

---

## 🎯 PRIORIDADE 1: Lançamento de Documentos
### O que é?
Registro de entrada/saída de documentos fiscais (NFe, Boletos, Recibos, Cupom Fiscal)

### Por que é crítico?
- É a entrada de TODOS os dados contábeis
- Sem isso, não há o que registrar

### Implementação Necessária:
- [ ] **Backend**: Modelo DocumentoFiscal + API de CRUD
- [ ] **Frontend**: Formulário de lançamento com:
  - Campo para número da nota/boleto
  - Valor total e parcelas
  - Tipo de documento (NFe, Boleto, Recibo, Cupom)
  - Descrição de itens
  - Data de emissão/vencimento
  - Integração CNPJ do fornecedor/cliente (auto-preenchimento)
- [ ] **Documentação**: 
  - Como lançar um documento
  - Tipos de documentos suportados
  - Campos obrigatórios vs opcionais
  - Exemplos com screenshots
- [ ] **Vídeo**: 30seg demonstrando lançamento completo

**Status**: ⏳ Pronto para implementar

---

## 🎯 PRIORIDADE 2: Diário Contábil
### O que é?
Registro de TODAS as transações em ordem cronológica (débito/crédito)

### Por que é crítico?
- É a Lei: Receita Federal exige Livro Diário
- Mostra movimento completo da empresa
- Base para auditoria

### Implementação Necessária:
- [ ] **Backend**: 
  - Tabela journal_entries com débito/crédito
  - Vinculação automática de documentos
  - Filtros por período/conta
- [ ] **Frontend**: 
  - Visualização em tabela do diário
  - Opção de lançamento manual (complementar)
  - Filtros: data, conta, descrição
  - Botão "Baixar PDF" para impressão
- [ ] **Documentação**:
  - O que é Diário Contábil (para iniciantes)
  - Como ler/interpretar o diário
  - Diferença entre lançamento automático vs manual
- [ ] **Vídeo**: 2 min explicando estrutura do diário

**Status**: ⏳ Pronto para implementar

---

## 🎯 PRIORIDADE 3: Contas a Receber
### O que é?
Controle de pagamentos pendentes de clientes (boletos, duplicatas, promissórias)

### Por que é crítico?
- 80% das pequenas empresas falham por falta de controle de recebimento
- Impacta fluxo de caixa direto

### Implementação Necessária:
- [ ] **Backend**:
  - Modelo ContasReceber (cliente, valor, vencimento, status)
  - Tabela de pagamentos recebidos
  - Cálculo de atraso/juros
- [ ] **Frontend**:
  - Dashboard de contas a vencer (próximos 7/14/30 dias)
  - Lista de clientes com saldo pendente
  - Botão "Registrar Recebimento"
  - Opção de gerar boleto (ou integração)
  - Visualização de atraso com juros
- [ ] **Documentação**:
  - Como adicionar cliente
  - Como registrar boleto/duplicata
  - Como marcar como recebido
  - Como visualizar atraso
- [ ] **Vídeo**: 2 min mostrando workflow completo

**Status**: ⏳ Pronto para implementar

---

## 🎯 PRIORIDADE 4: Contas a Pagar
### O que é?
Controle de pagamentos a fornecedores/despesas pendentes

### Por que é crítico?
- Evita perder prazos de pagamento
- Controla cash flow de saídas

### Implementação Necessária:
- [ ] **Backend**:
  - Modelo ContasPagar (fornecedor, valor, vencimento, status)
  - Registro de pagamentos efetuados
- [ ] **Frontend**:
  - Dashboard de contas a pagar (vencimento próximo)
  - Lista de fornecedores
  - Botão "Registrar Pagamento"
  - Aviso de boletos vencidos
- [ ] **Documentação**:
  - Como adicionar fornecedor
  - Como registrar despesa/boleto
  - Como marcar como pago
- [ ] **Vídeo**: 1.5 min workflow completo

**Status**: ⏳ Pronto para implementar

---

## 🎯 PRIORIDADE 5: Fluxo de Caixa + Relatórios Básicos
### O que é?
Visualização de entradas x saídas + Relatórios (DRE, Balanço)

### Por que é crítico?
- Mostra saúde financeira da empresa
- Foco de todo empresário: "Quanto ganhei? Quanto perdi?"

### Implementação Necessária:
- [ ] **Backend**:
  - Cálculos de: Total Receita, Total Despesa, Lucro/Prejuízo
  - Filtros por período
  - Relatório DRE (Demonstração de Resultado)
  - Relatório Balanço Patrimonial (versão simplificada)
- [ ] **Frontend**:
  - Dashboard com Cards: Receita Total, Despesa Total, Saldo
  - Gráfico de Fluxo (linhas cruzadas: entrada vs saída)
  - Relatórios em PDF
  - Exportar para Excel
- [ ] **Documentação**:
  - O que é Fluxo de Caixa
  - Como ler os gráficos
  - O que é DRE e Balanço (explicação simples)
  - Como gerar relatório mensal
- [ ] **Vídeo**: 2 min mostrando todos os relatórios

**Status**: ⏳ Pronto para implementar

---

## 📋 FORMATO DE DOCUMENTAÇÃO POR FUNCIONALIDADE

Para cada uma das 5, vou criar:

### 1️⃣ **Guia de Uso** (Markdown + Screenshots)
```
- O que é?
- Para quem?
- Quando usar?
- Passo a Passo (com print screens)
- Dicas e Boas Práticas
- Erros Comuns
```

### 2️⃣ **Vídeo Tutorial** (30seg - 2 min)
- Ação básica demonstrada
- Zoom em campos importantes
- Resultado final

### 3️⃣ **Tooltips na Interface**
- Campos tem ícone "?" que explica

### 4️⃣ **Exemplos Práticos**
- Caso real de lançamento
- Dados fictícios mas realistas

---

## ⏰ TIMELINE ESTIMADA

| Prioridade | Funcionalidade | Backend | Frontend | Docs | Vídeo | Total |
|-----------|----------------|---------|----------|------|-------|-------|
| 1 | Lançamento de Docs | 4h | 6h | 2h | 1h | **13h** |
| 2 | Diário Contábil | 3h | 4h | 1.5h | 1h | **9.5h** |
| 3 | Contas a Receber | 3h | 5h | 1.5h | 1h | **10.5h** |
| 4 | Contas a Pagar | 2h | 4h | 1h | 0.5h | **7.5h** |
| 5 | Fluxo + Relatórios | 4h | 6h | 2h | 1h | **13h** |
| | **TOTAL** | **16h** | **25h** | **8h** | **4.5h** | **53.5h** |

**Versão otimizada** (paralelizando): ~30 horas

---

## 🚀 GO-LIVE STRATEGY

### Fase 1: MVP com Doc (Semana 1-2)
- Implementar Prioridades 1-3
- Lançar como "Beta - Documentado e Testado"
- Feedback de usuários

### Fase 2: Completar (Semana 3)
- Adicionar Prioridades 4-5
- Release completa

### Diferencial de Mercado:
✅ **"Primeiro software contábil que você entende na primeira vez"**
- Cada feature documentada
- Exemplos práticos
- Vídeos passo-a-passo
- Interface intuitiva

---

## 🎬 PRÓXIMOS PASSOS

1. ✅ Aprovar este roadmap
2. ⏳ Começar com **Prioridade 1: Lançamento de Documentos**
3. ⏳ Paralelizar Frontend + Backend
4. ⏳ Documentação durante implementação

**Quer começar agora com Prioridade 1?**
