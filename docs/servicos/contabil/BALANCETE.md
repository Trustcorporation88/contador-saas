# Balancete

## 📋 O que é?

O **Balancete de Verificação** é um demonstrativo contábil que lista **todas as contas movimentadas** em determinado período com seus saldos iniciais, débitos, créditos e saldos finais. Serve como instrumento de **verificação da consistência da escrituração** (soma de débitos = soma de créditos) e como base para elaboração de relatórios gerenciais e demonstrações contábeis (Balanço Patrimonial, DRE).

## 🎯 Quando usar?

- **Mensalmente:** acompanhamento gerencial e validação do fechamento do mês.
- **Trimestralmente:** apuração de IRPJ/CSLL nas empresas do Lucro Presumido.
- **Anualmente:** base para elaboração do Balanço Patrimonial, DRE e ECD.
- **Antes de auditorias:** geração do balancete analítico para revisão de saldos.
- **Para análise de crédito:** bancos e investidores frequentemente solicitam balancete recente.

## 📝 Variáveis Necessárias

### Período de Referência
- **Label:** Data de corte
- **Descrição:** Período coberto pelo balancete. Pode ser acumulado desde o início do exercício ou apenas do mês.
- **Exemplo:** `01/01/2025 a 31/03/2025`
- **Obrigatório:** Sim
- **Tipo:** date

### Empresa / Filial
- **Label:** Estabelecimento
- **Descrição:** Empresa (CNPJ raiz) ou filial específica a ser apresentada. Pode ser consolidado.
- **Exemplo:** `Matriz + Filiais (consolidado)`
- **Obrigatório:** Sim
- **Tipo:** select

### Tipo do Balancete
- **Label:** Tipo
- **Descrição:** Analítico (mostra todas as contas) ou Sintético (mostra apenas grupos).
- **Exemplo:** `Analítico nível 4`
- **Obrigatório:** Sim
- **Tipo:** select

### Saldo Inicial por Conta
- **Label:** Saldo de abertura
- **Descrição:** Saldo de cada conta na data inicial do período. Deve coincidir com o balancete anterior.
- **Exemplo:** `1.1.01.01 Caixa – R$ 3.200,00 D`
- **Obrigatório:** Sim
- **Tipo:** currency

### Movimento de Débito
- **Label:** Total de débitos
- **Descrição:** Soma de todos os lançamentos a débito da conta no período.
- **Exemplo:** `R$ 145.300,00`
- **Obrigatório:** Sim
- **Tipo:** currency

### Movimento de Crédito
- **Label:** Total de créditos
- **Descrição:** Soma de todos os lançamentos a crédito da conta no período.
- **Exemplo:** `R$ 142.800,00`
- **Obrigatório:** Sim
- **Tipo:** currency

### Saldo Final
- **Label:** Saldo de fechamento
- **Descrição:** Saldo calculado como `Saldo Inicial + Débitos − Créditos` (para contas de natureza devedora). Indica natureza D ou C.
- **Exemplo:** `R$ 5.700,00 D`
- **Obrigatório:** Sim
- **Tipo:** currency

### Moeda e Forma de Apresentação
- **Label:** Moeda
- **Descrição:** Moeda do balancete (em geral R$) e se está em valores nominais ou ajustados.
- **Exemplo:** `R$ – valores nominais`
- **Obrigatório:** Sim
- **Tipo:** select

## 💡 Dicas Práticas

- Antes de imprimir o balancete oficial, **rode uma revisão de saldos atípicos**: contas de ativo com saldo credor (ou passivo com devedor) geralmente indicam erro de classificação.
- Concilie o **saldo de Caixa, Bancos, Clientes, Fornecedores e Estoque** com os controles auxiliares antes de fechar.
- Mantenha o balancete **comparativo** (mês atual x anterior, ano atual x anterior) — facilita análise de tendências.
- Para análise gerencial, exporte o balancete em **planilha** e construa dashboards com os principais KPIs (margem, liquidez, endividamento).
- Arquive o balancete mensal em **PDF assinado** pelo contador responsável (CRC ativo) — exigido em auditoria.

## ⚠️ Erros Comuns

- **Erro:** Total de débitos ≠ total de créditos no balancete → **Solução:** investigue lançamento manual incompleto; partidas dobradas exigem igualdade. Use o relatório "lançamentos desbalanceados".
- **Erro:** Saldo inicial divergente do balancete anterior → **Solução:** verifique se houve lançamento retroativo entre os dois períodos; refaça o fechamento contábil do período anterior se necessário.
- **Erro:** Conta de receita com saldo devedor (ou despesa com saldo credor) → **Solução:** revise estornos e devoluções; podem ter sido lançados invertidos.
- **Erro:** Esquecer apropriações de competência (depreciação, juros) → **Solução:** crie checklist mensal de provisões e ajustes obrigatórios antes do fechamento.

## ❓ FAQ

### Qual a diferença entre balancete e balanço patrimonial?
O **balancete** é uma listagem de todas as contas com saldos e movimentos, ferramenta de **verificação**. O **balanço patrimonial** é um demonstrativo formal (Ativo = Passivo + PL) elaborado a partir do balancete encerrado, exclusivamente das contas patrimoniais.

### O balancete é obrigatório?
Sim, é parte da **escrituração regular** exigida pela legislação. Para empresas obrigadas à ECD, é gerado mensalmente e a versão de 31/12 compõe o arquivo entregue à Receita Federal.

### Posso fechar o balancete antes do dia 5 do mês seguinte?
Sim, desde que todas as integrações tenham processado e os lançamentos manuais estejam concluídos. O ideal é **5 a 10 dias úteis** após o fim do mês.

### Como tratar uma conta que aparece com saldo de R$ 0,01?
Investigue arredondamentos em rateios ou cálculos de juros. Se confirmado erro de arredondamento, ajuste contra conta de "Ajustes de Arredondamento" para zerar.

### O balancete consolidado precisa eliminar operações entre filiais?
Sim. Vendas, transferências e contratos **intragrupo** devem ser eliminados na consolidação para evitar duplicidade de receita e despesa. Use registro auxiliar de eliminações.

## 📊 Tempo Estimado

**5-15 minutos** para gerar o relatório; **2-4 horas** para revisão crítica e ajustes antes do fechamento mensal.

## 🔗 Referências

- [ITG 2000 (R1) – CFC](https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/) — Escrituração Contábil
- [Lei nº 6.404/1976](http://www.planalto.gov.br/ccivil_03/leis/l6404compilada.htm) — Demonstrações Financeiras
- [CPC 26 (R1)](http://www.cpc.org.br/CPC/Documentos-Emitidos/Pronunciamentos) — Apresentação das Demonstrações Contábeis
- [Manual da ECD – Receita Federal](http://sped.rfb.gov.br/pasta/show/1569)
