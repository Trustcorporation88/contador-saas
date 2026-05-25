# Lançamentos Contábeis

## 📋 O que é?

O **Lançamento Contábil** é o registro formal de um **fato contábil** (qualquer evento que altera o patrimônio da empresa) no livro Diário, obedecendo ao método das **partidas dobradas**: para cada débito existe um crédito de igual valor. É a unidade fundamental da escrituração e a base de todas as demonstrações contábeis posteriores.

## 🎯 Quando usar?

- **Diariamente, após cada fato contábil:** vendas, compras, pagamentos, recebimentos, folha, depreciações.
- **Apropriações mensais:** despesas de competência (energia, aluguel, juros) ainda não pagas; receitas auferidas e não recebidas.
- **Ajustes de fechamento:** depreciação, amortização, provisões, impostos a recolher.
- **Lançamentos de encerramento:** transferência dos saldos das contas de resultado para apuração do lucro/prejuízo.
- **Correções e estornos:** quando um lançamento anterior foi feito incorretamente.

## 📝 Variáveis Necessárias

### Data do Lançamento
- **Label:** Data
- **Descrição:** Data do fato contábil. No regime de competência, é a data em que o evento ocorreu, não a do pagamento.
- **Exemplo:** `15/03/2025`
- **Obrigatório:** Sim
- **Tipo:** date

### Conta Debitada
- **Label:** Débito
- **Descrição:** Conta do plano que recebe o lançamento a débito. Em ativo, aumenta; em passivo/PL/receita, diminui.
- **Exemplo:** `1.1.01.02 – Banco Conta Movimento – Itaú`
- **Obrigatório:** Sim
- **Tipo:** select

### Conta Creditada
- **Label:** Crédito
- **Descrição:** Conta que recebe o lançamento a crédito. Em ativo, diminui; em passivo/PL/receita, aumenta.
- **Exemplo:** `3.1.01.01 – Receita de Vendas de Mercadorias`
- **Obrigatório:** Sim
- **Tipo:** select

### Valor
- **Label:** Valor (R$)
- **Descrição:** Valor monetário do lançamento. Débito e crédito devem ser exatamente iguais.
- **Exemplo:** `R$ 5.430,00`
- **Obrigatório:** Sim
- **Tipo:** currency

### Histórico
- **Label:** Histórico padrão ou complementar
- **Descrição:** Descrição do fato. Histórico padronizado facilita análise; complementar descreve a particularidade.
- **Exemplo:** `Venda de mercadorias conforme NFe 1234 – Cliente Silva Ltda`
- **Obrigatório:** Sim
- **Tipo:** text

### Documento Fonte
- **Label:** Documento de origem
- **Descrição:** Referência ao documento físico/digital que suporta o lançamento.
- **Exemplo:** `NFe 1234 / Boleto 098765 / Recibo 045`
- **Obrigatório:** Sim
- **Tipo:** text

### Centro de Custo
- **Label:** Centro de custo/resultado
- **Descrição:** Vínculo gerencial do lançamento a uma unidade, departamento ou projeto.
- **Exemplo:** `CC 020 – Loja Centro`
- **Obrigatório:** Não (depende da estrutura da empresa)
- **Tipo:** select

### Tipo de Lançamento
- **Label:** Natureza
- **Descrição:** Classificação do lançamento (normal, ajuste, estorno, encerramento).
- **Exemplo:** `Ajuste de depreciação mensal`
- **Obrigatório:** Sim
- **Tipo:** select

## 💡 Dicas Práticas

- Padronize **históricos** em um catálogo: facilita pesquisa e relatórios. Use IDs (ex.: "H001 – Recebimento de cliente").
- Para lançamentos complexos, use o **modelo de partidas múltiplas** (1 débito x N créditos ou vice-versa) em vez de criar vários lançamentos isolados.
- Nunca **apague** um lançamento errado — faça **estorno** (lançamento inverso) e refaça o correto. Isso preserva a trilha de auditoria.
- Concilie mensalmente o saldo das contas de **clientes, fornecedores, bancos e estoque** com os controles auxiliares.
- Antes do fechamento, gere a **razão analítica** das principais contas e revise saldos com natureza atípica (ex.: ativo com saldo credor).

## ⚠️ Erros Comuns

- **Erro:** Débito ≠ Crédito → **Solução:** o sistema deve impedir o salvamento; nunca faça "ajustes manuais" para fechar.
- **Erro:** Lançar pelo valor bruto incluindo impostos quando deveria ser líquido (ou vice-versa) → **Solução:** revise a apuração de ICMS/PIS/COFINS na nota e segregue conforme regime tributário.
- **Erro:** Confundir competência e caixa → **Solução:** receita de venda é reconhecida na **emissão da nota**, não no recebimento; despesa de aluguel no **mês de uso**, não no pagamento.
- **Erro:** Histórico genérico tipo "Pagamento" ou "Recebimento" → **Solução:** sempre identifique a contraparte e o documento; isso evita horas de investigação posterior.

## ❓ FAQ

### Posso fazer lançamento manual em data retroativa?
Sim, dentro do período **não fechado contabilmente**. Após o fechamento mensal/anual, retroagir exige reabertura formal e gera retificação de obrigações (ECD, ECF, SPED).

### O que é lançamento de "transferência"?
É o lançamento entre duas contas patrimoniais sem afetar resultado — ex.: transferência entre contas bancárias (Banco A débito, Banco B crédito).

### Qual a diferença entre Diário e Razão?
O **Diário** é cronológico (todos os lançamentos por data). O **Razão** é por conta (todos os movimentos de uma conta ao longo do tempo). Ambos são gerados a partir dos mesmos lançamentos.

### Como tratar arredondamentos em rateios?
Concentre o ajuste de centavos em **uma única conta predefinida** (geralmente a maior do rateio). Nunca deixe centavos pendurados entre as parcelas do rateio.

### Lançamento manual ainda é necessário com integração automática?
Sim, para **ajustes, provisões, depreciações e correções**. A integração cobre o transacional; o contador agrega o "olhar de competência" via lançamentos manuais.

## 📊 Tempo Estimado

**2-5 minutos** por lançamento manual; lançamentos em lote ou integrados são instantâneos.

## 🔗 Referências

- [Lei nº 6.404/1976](http://www.planalto.gov.br/ccivil_03/leis/l6404compilada.htm) — Lei das S.A. (Arts. 177 a 188)
- [ITG 2000 (R1) – CFC](https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/) — Escrituração Contábil
- [CPC 00 (R2)](http://www.cpc.org.br/CPC/Documentos-Emitidos/Pronunciamentos) — Estrutura Conceitual
- [Decreto nº 9.580/2018 (RIR)](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9580.htm) — Regulamento do Imposto de Renda
