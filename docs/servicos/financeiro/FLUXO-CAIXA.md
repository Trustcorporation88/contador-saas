# Fluxo de Caixa

## 📋 O que é?

O **Fluxo de Caixa** é o instrumento que projeta e controla todas as **entradas e saídas de dinheiro** da empresa ao longo do tempo. Diferente do regime de competência usado na contabilidade, o fluxo de caixa trabalha no **regime de caixa**: o que importa é quando o dinheiro efetivamente entra ou sai. É a principal ferramenta de gestão de liquidez e capital de giro.

## 🎯 Quando usar?

- **Diariamente:** atualização do saldo realizado e da projeção dos próximos dias.
- **Planejamento semanal:** revisão do fluxo das próximas 4-13 semanas para antecipar gargalos.
- **Decisão de investimento:** antes de qualquer compra de imobilizado, simular o impacto no fluxo.
- **Tomada de crédito:** instituições financeiras pedem o fluxo projetado como base para aprovar limite.
- **Análise de variação:** comparar projetado vs. realizado para calibrar a precisão das projeções futuras.

## 📝 Variáveis Necessárias

### Saldo Inicial
- **Label:** Saldo de abertura
- **Descrição:** Posição consolidada de todas as contas bancárias e caixa físico no início do período.
- **Exemplo:** `R$ 45.200,00 em 01/04/2025`
- **Obrigatório:** Sim
- **Tipo:** currency

### Entradas Previstas
- **Label:** Recebimentos
- **Descrição:** Soma dos títulos a receber por data de vencimento, mais entradas previstas (empréstimos, aportes).
- **Exemplo:** `R$ 78.500,00 na semana 01`
- **Obrigatório:** Sim
- **Tipo:** currency

### Saídas Previstas
- **Label:** Pagamentos
- **Descrição:** Soma de fornecedores, folha, tributos, despesas fixas e variáveis na data de vencimento.
- **Exemplo:** `R$ 62.300,00 na semana 01`
- **Obrigatório:** Sim
- **Tipo:** currency

### Horizonte da Projeção
- **Label:** Período projetado
- **Descrição:** Janela temporal coberta pelo fluxo (curto, médio ou longo prazo).
- **Exemplo:** `13 semanas` (modelo rolling forecast)
- **Obrigatório:** Sim
- **Tipo:** select

### Granularidade
- **Label:** Periodicidade
- **Descrição:** Detalhamento por dia, semana ou mês.
- **Exemplo:** `Diária para 30 dias + mensal para 12 meses`
- **Obrigatório:** Sim
- **Tipo:** select

### Categorias de Movimento
- **Label:** Plano financeiro
- **Descrição:** Estrutura de classificação das entradas e saídas (operacional, investimento, financiamento).
- **Exemplo:** `Operacional – Vendas / Investimento – Equipamentos`
- **Obrigatório:** Sim
- **Tipo:** select

### Reserva Mínima de Caixa
- **Label:** Caixa mínimo
- **Descrição:** Valor abaixo do qual o caixa não deve operar — gatilho para ação corretiva.
- **Exemplo:** `R$ 30.000,00` (equivalente a 1 folha de pagamento)
- **Obrigatório:** Sim
- **Tipo:** currency

### Aplicações Financeiras
- **Label:** Saldo aplicado
- **Descrição:** Recursos em CDB, fundos ou poupança com prazo de resgate identificado.
- **Exemplo:** `R$ 120.000,00 em CDB D+1`
- **Obrigatório:** Não, mas recomendado
- **Tipo:** currency

## 💡 Dicas Práticas

- Use o modelo **rolling 13 weeks**: a cada semana que passa, descarta-se a primeira e adiciona-se uma nova ao final.
- Separe o fluxo em três blocos: **operacional, investimento e financiamento** — isso revela se a empresa "queima" caixa na operação ou em decisões pontuais.
- Considere a **sazonalidade**: comércio em dezembro, escolas em janeiro/fevereiro, serviços contábeis em maio/junho.
- Crie cenários **otimista, realista e pessimista** com hipóteses claras (ex.: inadimplência de 5%, 10%, 15%).
- Sempre revise o **projetado vs. realizado** semanalmente; sem essa calibração, o fluxo perde credibilidade.

## ⚠️ Erros Comuns

- **Erro:** Confundir lucro com caixa → **Solução:** lembre que vendas a prazo geram lucro no momento da emissão, mas só viram caixa no recebimento.
- **Erro:** Esquecer 13º salário, férias e impostos sazonais → **Solução:** provisione mensalmente esses valores para evitar surpresas no caixa.
- **Erro:** Não considerar **floating bancário** (tempo entre depósito e disponibilidade) → **Solução:** trabalhe com data de **liquidação**, não de pagamento.
- **Erro:** Misturar caixa pessoal e empresarial → **Solução:** separe contas e estabeleça pró-labore fixo; pixes da PJ para PF distorcem o fluxo e geram problemas fiscais.

## ❓ FAQ

### Qual a diferença entre fluxo direto e indireto?
O **fluxo direto** lista todas as entradas e saídas pela origem (clientes, fornecedores, folha). O **indireto** parte do lucro líquido e ajusta itens não-caixa (depreciação, variações de capital de giro). Para gestão diária, use o direto; para a DFC oficial, o indireto é mais comum.

### Quanto preciso ter de reserva de caixa?
A regra prática é manter entre **2 e 6 meses de custo fixo** como reserva, ajustando conforme o risco da operação e a sazonalidade.

### Como projetar entradas se a empresa vende com cartão?
Considere o **prazo de repasse da adquirente**: débito em D+1, crédito à vista em D+30, parcelado por cada parcela. Negocie antecipações apenas quando a taxa for menor que seu custo de capital.

### O que fazer quando o fluxo aponta saldo negativo no futuro?
Em ordem: (1) antecipar recebíveis, (2) renegociar fornecedores, (3) reduzir despesas variáveis, (4) buscar capital de giro. Não deixe a decisão para a véspera.

### Devo incluir empréstimos no fluxo?
Sim. **Entrada** quando o crédito é liberado, **saídas** nas datas das parcelas (principal + juros separados, idealmente).

## 📊 Tempo Estimado

**15-30 minutos diários** para atualização; **1-2 horas semanais** para revisão e ajuste das projeções.

## 🔗 Referências

- [CPC 03 (R2)](http://www.cpc.org.br/CPC/Documentos-Emitidos/Pronunciamentos) — Demonstração dos Fluxos de Caixa
- [SEBRAE – Fluxo de Caixa para PMEs](https://www.sebrae.com.br/sites/PortalSebrae/artigos/fluxo-de-caixa-o-que-e-e-como-implantar)
- [NBC TG 03 (R3)](https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/) — Norma brasileira equivalente
