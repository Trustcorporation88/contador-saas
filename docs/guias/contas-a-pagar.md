# Guia de Uso: Contas a Pagar

## O que é

Contas a Pagar é o módulo que organiza todas as saídas previstas da empresa: fornecedores, boletos, impostos, salários, aluguel e outras obrigações.

## Por que isso importa

Sem controle de pagamentos, a empresa perde prazo, paga multa sem necessidade e toma decisões de caixa no escuro. O módulo existe para mostrar:

- o que ainda está em aberto
- o que já foi pago
- o que já venceu
- o que vence nos próximos 7, 14 e 30 dias

## O que o Beta já entrega

- cadastro de contas a pagar
- consulta de CNPJ do fornecedor para preenchimento automático
- filtros por fornecedor, status, categoria e atraso
- registro de pagamentos parciais ou totais
- cálculo de saldo em aberto
- aviso de títulos vencidos
- cancelamento lógico de obrigações

## Conceitos principais

### Obrigação

É qualquer valor que a empresa precisa pagar a um fornecedor ou compromisso operacional.

### Saldo em aberto

É o valor original menos tudo o que já foi pago.

### Pagamento parcial

Quando a empresa paga só uma parte da obrigação e o restante continua pendente.

### Vencido

Quando a data de vencimento passou e ainda existe saldo a pagar.

## Como usar

### 1. Abrir o módulo

No menu lateral, acesse `Contas a Pagar`.

Você verá indicadores rápidos:

- total em aberto
- total pago
- total vencido
- valores previstos para os próximos 7 dias

### 2. Criar uma nova obrigação

Clique em `Nova obrigação`.

Preencha os campos principais:

- categoria
- número do título
- descrição
- fornecedor
- emissão
- vencimento
- valor original

Opcionalmente, informe juros, multa, desconto e observações.

### 3. Consultar CNPJ do fornecedor

Se o CNPJ estiver disponível:

- digite o CNPJ
- clique em `Consultar CNPJ`
- revise os dados preenchidos automaticamente

### 4. Ler a carteira de pagamentos

Na lista principal, cada linha mostra:

- número do título
- fornecedor
- vencimento
- valor original
- saldo em aberto
- status atual

### 5. Registrar pagamento

Quando a obrigação for paga, clique em `Pagar`.

Informe:

- data do pagamento
- valor pago
- forma de pagamento
- juros, multa e desconto quando existirem
- observações

O sistema recalcula o saldo automaticamente.

### 6. Entender os status

- `pendente`: sem pagamento ainda
- `parcial`: parte da obrigação já foi quitada
- `pago`: saldo zerado
- `vencido`: passou do prazo e ainda há saldo
- `cancelado`: obrigação retirada da carteira ativa

## Boas práticas

- cadastre a conta a pagar no momento em que a obrigação nascer
- use descrições específicas para facilitar conferência financeira
- registre pagamentos parciais no mesmo dia em que ocorrerem
- monitore o filtro de vencidas diariamente

## Erros comuns

### Pagar fora do sistema e registrar depois

Isso reduz a confiabilidade da carteira e atrasa a leitura real do caixa.

### Misturar fornecedor sem nome claro

Sem fornecedor bem identificado, a conciliação futura fica lenta.

### Cancelar obrigação em vez de registrar pagamento parcial

Cancelamento não substitui pagamento parcial. Use cada ação com o significado correto.

## Exemplo prático

### Boleto de fornecedor de insumos

- Categoria: fornecedor
- Número do título: `FORN-2026-0091`
- Fornecedor: `Insumos Brasil Ltda`
- Emissão: 18/05/2026
- Vencimento: 25/05/2026
- Valor: R$ 4.250,00

Cenário:

- a empresa paga R$ 2.000,00 hoje
- a conta passa a status `parcial`
- o saldo restante continua visível até a quitação total

## Checklist operacional

- obrigação cadastrada com vencimento correto
- fornecedor validado
- valor original conferido
- pagamento registrado no dia certo
- vencidas revisadas antes de gerar multa desnecessária