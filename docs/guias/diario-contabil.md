# Guia de Uso: Diário Contábil

## O que é

O Diário Contábil é o registro cronológico de todos os lançamentos da empresa. Cada movimento precisa respeitar partidas dobradas: a soma dos débitos deve ser igual à soma dos créditos.

## Para quem serve

- Contador interno
- Escritório contábil
- Financeiro que prepara lançamentos para conferência
- Gestão que precisa rastrear origem, referência e status de cada movimento

## O que o módulo já entrega

- Listagem com busca, filtros por período e status
- Criação de lançamentos em rascunho
- Postagem de lançamento após conferência
- Estorno de lançamentos postados
- Exclusão de rascunhos
- Indicadores rápidos para leitura operacional do período atual

## Conceitos essenciais

### Rascunho

É o lançamento ainda em revisão. Pode ser editado ou excluído.

### Postado

É o lançamento já fechado operacionalmente. Depois de postado, ele não deve mais ser alterado.

### Estorno

É a reversão de um lançamento já postado. Em vez de editar o histórico, cria-se um novo movimento com sinal inverso.

## Como usar

### 1. Abrir o Diário

No menu lateral, acesse `Lançamentos`.

Na tela você verá:

- total de lançamentos encontrados
- volume financeiro da página atual
- quantidade de lançamentos postados
- data do fechamento mais recente visível

### 2. Filtrar a operação

Use os filtros para reduzir a visualização:

- busca textual por histórico ou documento
- status: todos, rascunho ou postado
- período inicial e final

Isso ajuda a conferir um lote específico antes do fechamento.

### 3. Criar novo lançamento

Clique em `Novo Lançamento`.

Preencha:

- data do lançamento
- histórico ou descrição
- referência documental, quando existir
- contas de débito e crédito
- valores correspondentes

Regra central:

- total de débitos = total de créditos

### 4. Revisar o rascunho

Antes de postar, confirme:

- se as contas usadas estão corretas
- se a referência do documento está coerente
- se o histórico explica a operação
- se os valores fecham sem diferença

### 5. Postar

Na listagem, clique em `Postar`.

Após isso:

- o lançamento fica travado
- ele passa a contar como fechamento operacional
- não pode mais ser editado diretamente

### 6. Estornar quando necessário

Se um lançamento já postado estiver incorreto, use `Estornar`.

Esse fluxo preserva auditoria e histórico contábil.

## Leitura da tabela

- `Data`: competência do movimento
- `Histórico`: resumo do fato contábil
- `Doc.`: referência usada para rastrear origem
- `Débito`: valor total a débito
- `Crédito`: valor total a crédito
- `Status`: rascunho ou postado

## Boas práticas

- Poste só depois de conferir contas e valores
- Use histórico claro e consistente
- Evite abreviações ambíguas em descrições
- Não exclua o que já deveria virar estorno
- Filtre por período antes de fechar o mês

## Erros comuns

### Débito e crédito diferentes

O lançamento não respeita partidas dobradas e deve ser corrigido antes da postagem.

### Lançamento postado tentando ser editado

Depois da postagem, o fluxo correto é estorno, não edição.

### Histórico genérico demais

Descrições como `ajuste` ou `lançamento` sem contexto prejudicam auditoria e leitura futura.

### Exclusão de movimento que já deveria estar fechado

Rascunho pode ser excluído. Postado deve ser estornado.

## Exemplo prático

### Pagamento de aluguel

- Data: 05/05/2026
- Histórico: Pagamento de aluguel da sede administrativa
- Débito: Despesa com aluguel
- Crédito: Banco conta movimento
- Valor: R$ 4.500,00

Resultado:

- lançamento salvo em rascunho
- conferido pelo responsável
- postado no Diário para compor o fechamento do período

## Checklist rápido de fechamento

- Período filtrado corretamente
- Rascunhos revisados
- Lançamentos postados conferidos
- Estornos aplicados onde houve erro
- Históricos legíveis para auditoria futura