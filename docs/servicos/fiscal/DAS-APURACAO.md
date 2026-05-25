# Apuração do DAS

## 📋 O que é?

O **DAS (Documento de Arrecadação do Simples Nacional)** é a guia única mensal paga por empresas optantes pelo **Simples Nacional**. Ele consolida em um só pagamento até 8 tributos federais, estaduais e municipais (IRPJ, CSLL, PIS, COFINS, IPI, CPP, ICMS e ISS). A apuração consiste em calcular a base (receita bruta dos últimos 12 meses), aplicar a alíquota efetiva conforme o Anexo da atividade e gerar o boleto no portal da Receita.

## 🎯 Quando usar?

- **Todo mês 20:** vencimento padrão do DAS referente ao mês anterior.
- **Após o fechamento mensal de vendas:** assim que a receita do mês estiver consolidada no sistema.
- **Quando há atividade em mais de um anexo:** a empresa exerce simultaneamente comércio e serviço, exigindo segregação de receitas.
- **Em caso de regularização:** geração de DAS em atraso com juros e multa via aplicativo "Regularize" ou PGDAS-D.

## 📝 Variáveis Necessárias

### CNPJ da Empresa
- **Label:** CNPJ
- **Descrição:** Identificação da empresa optante. Deve ter situação cadastral ativa e opção pelo Simples vigente.
- **Exemplo:** `23.456.789/0001-04`
- **Obrigatório:** Sim
- **Tipo:** cnpj

### Período de Apuração (PA)
- **Label:** Mês/ano de competência
- **Descrição:** Mês ao qual a apuração se refere (não o mês de pagamento).
- **Exemplo:** `02/2025` para vencimento em 20/03/2025
- **Obrigatório:** Sim
- **Tipo:** date

### Receita Bruta do Mês (RPA)
- **Label:** Receita do período
- **Descrição:** Soma das vendas e serviços emitidos no mês, sem deduções de impostos.
- **Exemplo:** `R$ 85.430,00`
- **Obrigatório:** Sim
- **Tipo:** currency

### Receita Bruta Acumulada (RBT12)
- **Label:** Receita dos últimos 12 meses
- **Descrição:** Soma da receita bruta dos 12 meses anteriores ao PA. Define a faixa de alíquota.
- **Exemplo:** `R$ 920.500,00`
- **Obrigatório:** Sim
- **Tipo:** currency

### Anexo de Tributação
- **Label:** Anexo do Simples
- **Descrição:** Define a tabela de alíquotas aplicável conforme a atividade da empresa.
- **Exemplo:** `Anexo I` (comércio), `Anexo III` (serviços) ou `Anexo V` (serviços com Fator R baixo)
- **Obrigatório:** Sim
- **Tipo:** select

### Segregação de Receitas
- **Label:** Receita por atividade
- **Descrição:** Divisão da receita por tipo de operação (venda mercadoria, prestação serviço, exportação etc.).
- **Exemplo:** `Comércio: R$ 60.000 | Serviço: R$ 25.430`
- **Obrigatório:** Sim, se houver mais de uma atividade
- **Tipo:** currency

### Folha de Pagamento (Fator R)
- **Label:** Folha 12 meses
- **Descrição:** Total da folha (salários + pró-labore + encargos) dos últimos 12 meses. Usado para definir Anexo III ou V em serviços.
- **Exemplo:** `R$ 280.000,00`
- **Obrigatório:** Sim, para atividades sujeitas ao Fator R
- **Tipo:** currency

### Retenções na Fonte
- **Label:** Valores retidos
- **Descrição:** ISS, IRRF ou INSS já retidos por tomadores de serviço, que serão abatidos do DAS.
- **Exemplo:** `R$ 450,00 de ISS retido`
- **Obrigatório:** Não
- **Tipo:** currency

## 💡 Dicas Práticas

- Apure o DAS até o dia 15 para ter folga em caso de inconsistências antes do vencimento (dia 20).
- Confira o **Fator R** mensalmente: se `Folha 12 meses ÷ Receita 12 meses ≥ 28%`, atividades de serviço migram do Anexo V para o III, reduzindo carga tributária.
- Receita de **exportação** não entra na base do ICMS/ISS — segregue corretamente para evitar pagar a mais.
- Guarde o **recibo de transmissão do PGDAS-D**, ele é a prova da declaração mesmo que o pagamento atrase.
- Se o pagamento atrasar, use o próprio PGDAS-D para gerar guia com multa (0,33% ao dia, limitado a 20%) e juros SELIC.

## ⚠️ Erros Comuns

- **Erro:** Lançar receita pelo regime de caixa quando a empresa optou pelo regime de competência → **Solução:** revisar opção no PGDAS-D em janeiro; a mudança vale para o ano-calendário inteiro.
- **Erro:** Esquecer de marcar receita com substituição tributária (ICMS-ST) → **Solução:** identificar produtos com ST na nota e segregar no PGDAS, evitando bitributação.
- **Erro:** Não somar receitas de filiais → **Solução:** o Simples é apurado pelo CNPJ raiz; todas as filiais entram no mesmo DAS.
- **Erro:** Aplicar alíquota nominal em vez da **alíquota efetiva** → **Solução:** use a fórmula `((RBT12 × Aliq) − PD) ÷ RBT12` para chegar à alíquota efetiva.

## ❓ FAQ

### Qual o limite de faturamento do Simples Nacional?
**R$ 4,8 milhões** nos últimos 12 meses para a empresa em geral, e **R$ 81 mil** para o MEI. Ultrapassar exige desenquadramento.

### O que acontece se eu não declarar o PGDAS-D?
Mesmo sem receita, a declaração é obrigatória. A omissão gera **multa mínima de R$ 50,00** por mês, além de impedir a emissão de certidões negativas.

### Posso parcelar o DAS em atraso?
Sim. O parcelamento ordinário do Simples permite dividir em até **60 parcelas** mensais, com parcela mínima de R$ 300,00 (R$ 50,00 para MEI).

### Como funciona o Anexo IV?
O Anexo IV é específico para serviços como construção civil, vigilância e limpeza. Diferente dos outros anexos, ele **não inclui CPP** — a contribuição patronal de 20% é recolhida à parte em GPS.

### Sublimite estadual: o que é?
Alguns estados adotam um **sublimite de R$ 3,6 milhões** para fins de ICMS/ISS. Ao ultrapassá-lo, a empresa continua no Simples para tributos federais mas recolhe ICMS/ISS fora do DAS.

## 📊 Tempo Estimado

**15-40 minutos** mensais, dependendo do volume de notas e da complexidade da segregação.

## 🔗 Referências

- [PGDAS-D e DEFIS](https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgdasd.app/)
- [Lei Complementar nº 123/2006](http://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm)
- [Resolução CGSN nº 140/2018](http://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278)
- [Portal do Simples Nacional](https://www8.receita.fazenda.gov.br/SimplesNacional/)
