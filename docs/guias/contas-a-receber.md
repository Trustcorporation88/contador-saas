# Guia de Uso: Contas a Receber

## O que é

Contas a Receber é o módulo que acompanha tudo o que a empresa ainda precisa receber dos clientes: boletos, duplicatas, promissórias, cobranças por Pix e outros títulos.

## Por que isso é crítico

Sem controle de recebimento, a empresa perde previsibilidade de caixa. O objetivo do módulo é mostrar:

- quanto ainda está em aberto
- o que já foi recebido
- o que está vencido
- o que vence nos próximos 7, 14 e 30 dias

## O que o Beta já entrega

- cadastro de títulos a receber
- consulta de CNPJ do cliente para preenchimento automático
- filtros por cliente, status, categoria e atraso
- registro de recebimentos parciais ou totais
- cálculo de saldo em aberto
- sinalização de atraso por dias vencidos
- cancelamento lógico de títulos

## Conceitos principais

### Título

É a obrigação financeira do cliente com a empresa.

### Saldo em aberto

É o valor original menos tudo o que já foi recebido.

### Recebimento parcial

Quando o cliente paga só uma parte do título. O sistema mantém o restante em aberto.

### Vencido

Quando o prazo passou e ainda existe saldo a receber.

## Como usar

### 1. Abrir o módulo

No menu lateral, acesse `Contas a Receber`.

Você verá indicadores rápidos:

- total em aberto
- total já recebido
- total vencido
- valores previstos para os próximos 7 dias

### 2. Criar um novo título

Clique em `Novo título`.

Preencha os campos principais:

- categoria do título
- número do título
- descrição
- cliente
- emissão
- vencimento
- valor original

Opcionalmente, informe juros, multa, desconto previsto e observações.

### 3. Consultar CNPJ do cliente

Se o CNPJ estiver disponível:

- digite o CNPJ
- clique em `Consultar CNPJ`
- revise os dados preenchidos automaticamente

### 4. Acompanhar a carteira

Na lista principal, cada linha mostra:

- número do título
- cliente
- vencimento
- valor original
- saldo em aberto
- status atual

### 5. Registrar recebimento

Quando o cliente pagar, clique em `Receber`.

Informe:

- data do recebimento
- valor recebido
- forma do recebimento
- juros, multa e desconto se aplicável
- observações

O sistema recalcula o saldo automaticamente.

### 6. Interpretar status

- `pendente`: ainda sem recebimento
- `parcial`: recebeu parte do valor
- `recebido`: saldo zerado
- `vencido`: passou do vencimento e ainda há saldo aberto
- `cancelado`: retirado do fluxo ativo

## Boas práticas

- cadastre o título no mesmo dia em que a venda ou cobrança for gerada
- use descrições claras para identificar a origem do recebimento
- registre todo recebimento parcial no dia em que ocorrer
- trate atraso com filtro de vencidos antes que o problema cresça

## Erros comuns

### Registrar valor maior que o saldo real

Isso distorce a carteira e precisa ser conferido antes de confirmar o recebimento.

### Deixar o cliente sem identificação adequada

Sem nome claro e número do título, a cobrança futura fica difícil de rastrear.

### Usar cancelamento quando o fluxo correto é recebimento parcial

Cancelamento serve para retirar o título da carteira, não para registrar negociação parcial.

## Exemplo prático

### Venda faturada para cliente com vencimento em 15 dias

- Categoria: boleto
- Número do título: `BOL-2026-0048`
- Cliente: `Cliente Exemplo Ltda`
- Emissão: 18/05/2026
- Vencimento: 02/06/2026
- Valor: R$ 8.500,00

Cenário:

- cliente paga R$ 5.000,00 hoje
- o título passa a status `parcial`
- o saldo em aberto continua visível para acompanhamento

## Checklist operacional

- título cadastrado com vencimento correto
- cliente validado
- valor original revisado
- recebimentos registrados no dia certo
- vencidos acompanhados continuamente