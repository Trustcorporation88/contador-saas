# Contas a Pagar

## 📋 O que é?

**Contas a Pagar** é o controle de todas as obrigações financeiras da empresa com fornecedores, prestadores, tributos, folha e demais credores. Envolve o registro do título, agendamento do pagamento, aprovação interna, liquidação e baixa. É espelhado em relação ao Contas a Receber e é a principal fonte de previsão de saídas no fluxo de caixa.

## 🎯 Quando usar?

- **No recebimento de cada nota de compra ou boleto:** lançamento imediato para evitar perda de prazos.
- **Programação semanal de pagamentos:** consolidação dos vencimentos da semana para autorização e liberação bancária.
- **Aproveitamento de descontos:** identificar fornecedores que oferecem desconto por antecipação.
- **Renegociação:** quando o fluxo de caixa indica aperto, priorizar renegociação antes do vencimento.
- **Fechamento mensal:** conferência de todos os títulos pagos x apropriados na competência correta.

## 📝 Variáveis Necessárias

### Fornecedor / Credor
- **Label:** Fornecedor
- **Descrição:** Pessoa física ou jurídica que receberá o pagamento.
- **Exemplo:** `Distribuidora Norte Ltda – CNPJ 56.789.012/0001-34`
- **Obrigatório:** Sim
- **Tipo:** text

### Documento de Origem
- **Label:** Nº do documento
- **Descrição:** NFe de compra, boleto, contrato ou recibo que originou a obrigação.
- **Exemplo:** `NFe 5678 / Boleto 0019283746`
- **Obrigatório:** Sim
- **Tipo:** text

### Valor a Pagar
- **Label:** Valor do título
- **Descrição:** Valor bruto da obrigação na data de vencimento.
- **Exemplo:** `R$ 4.780,50`
- **Obrigatório:** Sim
- **Tipo:** currency

### Data de Vencimento
- **Label:** Vencimento
- **Descrição:** Prazo limite para pagamento sem encargos.
- **Exemplo:** `10/04/2025`
- **Obrigatório:** Sim
- **Tipo:** date

### Categoria de Despesa
- **Label:** Plano financeiro
- **Descrição:** Classificação do gasto (matéria-prima, aluguel, energia, impostos etc.) para análise gerencial e DRE.
- **Exemplo:** `3.1.02 – Compra de mercadorias para revenda`
- **Obrigatório:** Sim
- **Tipo:** select

### Centro de Custo
- **Label:** Centro de custo
- **Descrição:** Setor ou unidade que consumiu o recurso.
- **Exemplo:** `Administrativo – Matriz`
- **Obrigatório:** Não, mas recomendado
- **Tipo:** select

### Forma de Pagamento
- **Label:** Meio de pagamento
- **Descrição:** Boleto, PIX, TED, débito automático, cheque etc.
- **Exemplo:** `PIX – chave CNPJ`
- **Obrigatório:** Sim
- **Tipo:** select

### Aprovador
- **Label:** Aprovado por
- **Descrição:** Responsável pela liberação do pagamento, conforme política de alçada.
- **Exemplo:** `Gestor Financeiro – João Pereira`
- **Obrigatório:** Sim para valores acima do limite definido
- **Tipo:** text

## 💡 Dicas Práticas

- Centralize as autorizações em **dois dias fixos da semana** (ex.: terça e sexta) para evitar interrupções diárias do gestor.
- Estabeleça **alçadas claras**: até R$ 1.000 libera o analista, até R$ 10.000 o coordenador, acima disso o diretor.
- Use **PIX agendado** ou pagamento em lote (CNAB 240) para reduzir tempo operacional.
- Sempre confira o **CNPJ no boleto** com o do fornecedor cadastrado — fraudes por boleto adulterado são comuns.
- Negocie prazos com fornecedores estratégicos uma vez por ano; ganhos de 10 dias geram impacto relevante no capital de giro.

## ⚠️ Erros Comuns

- **Erro:** Pagar boleto fraudado (linha digitável adulterada) → **Solução:** valide o **CNPJ do beneficiário** no comprovante antes de confirmar; use QR Code PIX sempre que possível.
- **Erro:** Lançar a nota como despesa quando deveria ser custo (ou vice-versa) → **Solução:** treine a equipe na diferença entre custo (ligado à produção/revenda) e despesa (administrativa/comercial).
- **Erro:** Esquecer de baixar título pago manualmente → **Solução:** rotina de conciliação diária; sem baixa, o título reaparece na próxima programação e pode ser pago em duplicidade.
- **Erro:** Pagar tributo com guia errada → **Solução:** sempre verifique código de receita e período de apuração; correção exige PER/DCOMP, que demora meses.

## ❓ FAQ

### Devo pagar antes do vencimento para garantir desconto?
Depende. Calcule a **taxa equivalente** do desconto: se um desconto de 2% por antecipar 30 dias equivale a ~24% a.a., e seu custo de capital é 15% a.a., vale a pena.

### O que faço com nota de fornecedor recebida com atraso?
Lance a despesa na **competência correta** (data do fato gerador), e o pagamento na data efetiva. Se a competência já está fechada contabilmente, registre como despesa de exercício anterior ou ajuste conforme orientação do contador.

### Como tratar adiantamento a fornecedor?
Registre como **ativo (Adiantamento a fornecedores)**, não como despesa. Na entrega da mercadoria/serviço, faça a apropriação contra a obrigação real.

### Posso pagar boleto vencido sem multa?
Boletos podem ser pagos **após o vencimento** com os encargos calculados automaticamente. Após 60 dias, em muitos casos é necessário solicitar uma 2ª via ao emissor.

### O que é DDA?
**Débito Direto Autorizado** — serviço bancário em que os boletos do CNPJ chegam diretamente ao internet banking, sem necessidade do PDF. Reduz risco de fraude e perda de boletos.

## 📊 Tempo Estimado

**3-7 minutos** por lançamento; **1-2 horas** semanais para programação e liberação de pagamentos em uma operação típica.

## 🔗 Referências

- [FEBRABAN – Padrão CNAB 240](https://portal.febraban.org.br/pagina/3053/33/pt-br/layout-240)
- [Manual do PIX – Banco Central](https://www.bcb.gov.br/estabilidadefinanceira/pix)
- [CPC 00 (R2)](http://www.cpc.org.br/CPC/Documentos-Emitidos/Pronunciamentos) — Estrutura Conceitual Contábil
- [Lei nº 9.492/1997](http://www.planalto.gov.br/ccivil_03/leis/l9492.htm) — Protesto de títulos
