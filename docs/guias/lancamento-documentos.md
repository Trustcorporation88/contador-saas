# Guia de Uso: Lançamento de Documentos Fiscais

## O que é

O módulo de Documentos Fiscais centraliza o cadastro dos documentos que alimentam a operação contábil: NF-e, boletos, recibos e cupons fiscais. Ele existe para evitar lançamentos soltos, reduzir retrabalho e preparar o dado para diário, contas a pagar/receber e relatórios.

## Quando usar

Use este fluxo sempre que um documento entrar ou sair da rotina da empresa.

- Compra com nota fiscal de fornecedor
- Emissão de documento para cliente
- Recebimento de boleto ou recibo
- Registro de cupom fiscal de despesa operacional

## O que dá para fazer no Beta

- Criar documento fiscal com múltiplos itens
- Consultar CNPJ da contraparte para preencher dados automaticamente
- Filtrar por tipo, status e busca textual
- Editar documento em rascunho
- Registrar documento para travar a edição operacional
- Cancelar documento sem apagar o histórico lógico
- Ver indicadores rápidos de valor total e volume registrado

## Passo a passo

### 1. Abrir o módulo

No menu lateral, acesse `Documentos Fiscais`.

### 2. Criar um novo documento

Clique em `Novo documento`.

Preencha os campos principais:

- `Tipo`: NF-e, Boleto, Recibo ou Cupom fiscal
- `Número`: número do documento
- `Série`: série fiscal ou identificador de emissão
- `Data de emissão`: data oficial do documento
- `Descrição`: resumo operacional para busca posterior

### 3. Informar a contraparte

Selecione se a contraparte é `Cliente` ou `Fornecedor`.

Depois:

- Digite o CNPJ
- Clique em `Consultar CNPJ`
- Revise os campos preenchidos automaticamente

Campos complementares:

- Nome da contraparte
- E-mail
- Telefone
- Data de vencimento, quando houver

### 4. Adicionar itens

Cada documento deve ter pelo menos um item.

Para cada item, informe:

- Descrição
- Quantidade
- Valor unitário

O sistema recalcula o valor total automaticamente a partir desses itens.

### 5. Revisar valores

Se necessário, preencha:

- `Impostos`
- `Desconto`

O card de total mostra o valor consolidado do documento.

### 6. Salvar

Clique em `Criar documento`.

O documento entra como `rascunho`.

### 7. Registrar

Quando o documento estiver conferido, clique em `Registrar` na listagem.

Depois disso:

- o status muda para `registrado`
- a edição operacional deixa de ser permitida
- o documento fica pronto para compor fluxos contábeis subsequentes

## Status do documento

- `rascunho`: ainda pode ser ajustado
- `registrado`: conferido e travado para operação
- `cancelado`: retirado do fluxo ativo, sem remoção física do histórico

## Campos obrigatórios

- Tipo
- Número
- Série
- Descrição
- Data de emissão
- Nome da contraparte
- Pelo menos 1 item

## Boas práticas

- Padronize a descrição com um verbo e a natureza do documento
- Sempre consulte o CNPJ antes de digitar dados manualmente
- Revise itens antes de registrar; o registro deve ser tratado como fechamento operacional
- Use `rascunho` enquanto o documento estiver aguardando validação interna

## Erros comuns

### Documento duplicado

O backend impede duplicidade por empresa combinando tipo, série e número.

### CNPJ não completa dados

Isso normalmente indica indisponibilidade temporária da consulta externa ou CNPJ inválido.

### Documento não edita mais

Documentos registrados deixam de ser editáveis por regra de negócio.

### Total diferente do esperado

Verifique quantidade e valor unitário de cada item. O total é calculado a partir deles.

## Exemplo prático

### Compra de material de escritório

- Tipo: `NF-e`
- Número: `18452`
- Série: `1`
- Contraparte: `Fornecedor`
- CNPJ: `12.345.678/0001-90`
- Item 1: Papel A4, quantidade 10, valor unitário 28,90
- Item 2: Toner, quantidade 2, valor unitário 179,90

Resultado:

- total consolidado automaticamente
- documento salvo em rascunho
- registro final após conferência fiscal

## Checklist operacional

- Documento criado com tipo correto
- Contraparte conferida
- Itens revisados
- Total validado
- Status final definido

## Próxima conexão do fluxo

Este módulo prepara o terreno para:

- Diário contábil
- Contas a pagar
- Contas a receber
- Fluxo de caixa
- Relatórios gerenciais