# Contas a Receber

## 📋 O que é?

**Contas a Receber** é o controle de todos os valores que a empresa tem direito a receber de clientes, em decorrência de vendas ou prestação de serviços a prazo. Inclui o cadastro do título, acompanhamento do vencimento, baixa por pagamento e tratamento da inadimplência. É a principal fonte de previsão de entradas no fluxo de caixa.

## 🎯 Quando usar?

- **Após cada venda a prazo:** registro do título assim que a NFe ou contrato é emitido.
- **No fechamento diário:** baixa dos títulos pagos no dia conforme extrato bancário.
- **Régua de cobrança:** envio automatizado de lembretes antes e após o vencimento.
- **Provisão de PCLD:** identificação de títulos vencidos há mais de 180 dias para provisão de devedores duvidosos.
- **Relatórios gerenciais:** aging list (idade dos recebíveis) para tomada de decisão.

## 📝 Variáveis Necessárias

### Cliente
- **Label:** Cliente devedor
- **Descrição:** Pessoa física ou jurídica responsável pelo pagamento.
- **Exemplo:** `Comércio Silva Ltda – CNPJ 45.678.901/0001-23`
- **Obrigatório:** Sim
- **Tipo:** text

### Número do Documento
- **Label:** Documento de origem
- **Descrição:** Identificação da NFe, contrato ou pedido que gerou o título.
- **Exemplo:** `NFe 001234`
- **Obrigatório:** Sim
- **Tipo:** text

### Valor Original
- **Label:** Valor do título
- **Descrição:** Valor a ser recebido na data de vencimento, sem juros nem multa.
- **Exemplo:** `R$ 3.250,00`
- **Obrigatório:** Sim
- **Tipo:** currency

### Data de Vencimento
- **Label:** Vencimento
- **Descrição:** Data limite para pagamento sem encargos.
- **Exemplo:** `15/04/2025`
- **Obrigatório:** Sim
- **Tipo:** date

### Forma de Recebimento
- **Label:** Meio de pagamento
- **Descrição:** Como o cliente vai pagar o título.
- **Exemplo:** `Boleto bancário`, `PIX`, `Cartão de crédito 3x`, `Transferência`
- **Obrigatório:** Sim
- **Tipo:** select

### Centro de Resultado
- **Label:** Centro de custo/receita
- **Descrição:** Vínculo do recebimento a um setor, produto ou projeto para análise gerencial.
- **Exemplo:** `Filial Centro – Loja 02`
- **Obrigatório:** Não
- **Tipo:** select

### Juros e Multa
- **Label:** Encargos por atraso
- **Descrição:** Percentuais aplicados após o vencimento (multa fixa + juros diários).
- **Exemplo:** `Multa 2% + juros 1% a.m.`
- **Obrigatório:** Não
- **Tipo:** number

### Conta Bancária de Recebimento
- **Label:** Banco recebedor
- **Descrição:** Conta em que o valor será creditado, usada na conciliação.
- **Exemplo:** `Banco do Brasil – Ag 1234 / CC 56789-0`
- **Obrigatório:** Sim
- **Tipo:** select

## 💡 Dicas Práticas

- Configure uma **régua de cobrança automática**: lembrete 3 dias antes, no vencimento, +5 dias, +15 dias e +30 dias.
- Use o **PIX com QR Code dinâmico** nos boletos — reduz drasticamente o tempo de baixa.
- Concentre o vencimento dos clientes em poucos dias do mês (ex.: dia 5, 15 e 25) para facilitar a operação de cobrança.
- Antes de protestar, faça contato amigável: muitas vezes o atraso é falha operacional do cliente, não inadimplência.
- Reconcilie o **CR x extrato bancário** diariamente; deixar acumular gera divergência difícil de rastrear.

## ⚠️ Erros Comuns

- **Erro:** Baixar título com valor divergente do recebido → **Solução:** registre a diferença como desconto, juros recebidos ou diferença a investigar; nunca "arredonde" no manual.
- **Erro:** Duplicidade de título (mesma NFe lançada duas vezes) → **Solução:** crie validação por número de documento + cliente no cadastro do título.
- **Erro:** Esquecer de baixar título pago em dinheiro → **Solução:** mantenha rotina diária de conferência do caixa físico + sangria.
- **Erro:** Aplicar juros sobre juros (anatocismo) → **Solução:** juros incidem apenas sobre o valor original; multa é única e fixa.

## ❓ FAQ

### Quando devo considerar um cliente inadimplente?
Tecnicamente, **no primeiro dia útil após o vencimento**. Para fins de provisão contábil (PCLD), o critério mais usado é vencidos há mais de **90 ou 180 dias**.

### Posso negativar o cliente direto?
Sim, após **comunicação prévia** (carta com AR ou notificação extrajudicial) com prazo mínimo de 10 dias. A negativação é feita via SPC, Serasa ou cartório de protesto.

### Como contabilizar desconto concedido para pagamento antecipado?
Débito em "Descontos Concedidos" (despesa financeira) e crédito no cliente pelo valor total do título. A receita original permanece intacta.

### O que é factoring e quando faz sentido?
**Factoring** é a venda de recebíveis para uma empresa especializada com deságio. Faz sentido quando o custo do deságio é menor que o custo de capital próprio e há urgência de caixa.

### Qual prazo para cobrar judicialmente?
O título de crédito (duplicata, cheque) prescreve em **3 anos**; cobranças contratuais em geral prescrevem em **5 anos**. Não deixe vencer o prazo.

## 📊 Tempo Estimado

**5-10 minutos** por título no cadastro; **30-60 minutos diários** para conferência e baixas em uma operação típica.

## 🔗 Referências

- [Lei nº 5.474/1968](http://www.planalto.gov.br/ccivil_03/leis/l5474.htm) — Lei das Duplicatas
- [Código Civil – Arts. 389 a 405](http://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm) — Inadimplemento das obrigações
- [Resolução CMN nº 4.966/2021](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20CMN&numero=4966) — Provisão para perdas (PCLD)
- [Manual SPB – PIX](https://www.bcb.gov.br/estabilidadefinanceira/pix)
