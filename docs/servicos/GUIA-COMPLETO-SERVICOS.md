# Guia Completo de Serviços — Contador SaaS

> **Versão**: 1.0 · **Atualizado em**: 2025 · **Público-alvo**: Contadores e gestores financeiros brasileiros

Este guia cobre todos os 18 fluxos disponíveis no Contador SaaS. Cada seção explica **o que é**, **quando usar**, **quais campos preencher** e **como evitar os erros mais comuns** — com exemplos do dia a dia da contabilidade brasileira.

---

## Sumário

| # | Serviço | Tempo estimado |
|---|---------|---------------|
| 1 | [Emissão de NF-e](#1-emissão-de-nf-e) | 5–15 min |
| 2 | [Lançamento Contábil](#2-lançamento-contábil) | 5–10 min |
| 3 | [Contas a Receber](#3-contas-a-receber) | 3–8 min |
| 4 | [Contas a Pagar](#4-contas-a-pagar) | 3–8 min |
| 5 | [Fluxo de Caixa](#5-fluxo-de-caixa) | 2–5 min |
| 6 | [Apuração de Impostos](#6-apuração-de-impostos) | 15–30 min |
| 7 | [DAS Mensal (Simples Nacional)](#7-das-mensal-simples-nacional) | 5–10 min |
| 8 | [Balanço Patrimonial](#8-balanço-patrimonial) | 30–60 min |
| 9 | [DRE — Demonstração do Resultado](#9-dre--demonstração-do-resultado) | 20–40 min |
| 10 | [Balancete de Verificação](#10-balancete-de-verificação) | 10–20 min |
| 11 | [Livro Razão](#11-livro-razão) | 5–15 min |
| 12 | [Cadastro de Empresa](#12-cadastro-de-empresa) | 10–20 min |
| 13 | [Cadastro de Usuários](#13-cadastro-de-usuários) | 5–10 min |
| 14 | [Plano de Contas](#14-plano-de-contas) | 10–30 min |
| 15 | [Conciliação Bancária](#15-conciliação-bancária) | 15–45 min |
| 16 | [SPED Contábil](#16-sped-contábil) | 60–120 min |
| 17 | [Auditoria e Logs](#17-auditoria-e-logs) | 5–15 min |
| 18 | [Relatório de Vendas](#18-relatório-de-vendas) | 5–15 min |

---

## 1. Emissão de NF-e

### O que é?
A **Nota Fiscal Eletrônica (NF-e)** é o documento fiscal obrigatório para registrar operações de compra e venda de mercadorias entre empresas (B2B) e para consumidor final (NFC-e). O arquivo XML é assinado digitalmente e transmitido à SEFAZ antes de a mercadoria sair do estabelecimento.

### Quando usar
- Ao vender produtos para outra empresa (CNPJ)
- Ao realizar operações interestaduais de mercadorias
- Ao devolver mercadorias ao fornecedor

> **Não confundir**: NF-e é para mercadorias. Para serviços, use **NFS-e** (Nota Fiscal de Serviços Eletrônica), emitida pela prefeitura do município do prestador.

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Número da NF-e | ✅ | Sequencial automático; nunca repita | `000001` |
| CFOP | ✅ | Código Fiscal de Operações e Prestações | `5101` (venda dentro do estado) |
| Destinatário (CNPJ/CPF) | ✅ | Comprador da mercadoria | `12.345.678/0001-99` |
| Endereço do destinatário | ✅ | Completo; CEP obrigatório | `Rua das Flores, 100 – SP/SP` |
| Produto (código + descrição) | ✅ | Cadastrado no NCM correto | `Notebook Dell Inspiron` |
| NCM | ✅ | Nomenclatura Comum do Mercosul | `8471.30.12` |
| CST / CSOSN | ✅ | Código de Situação Tributária | `400` (Tributada sem ST) |
| Valor unitário | ✅ | Preço de venda | `R$ 3.499,00` |
| Quantidade | ✅ | Unidades vendidas | `2` |
| Natureza da operação | ✅ | Texto descritivo do CFOP | `Venda de mercadoria` |
| Transporte | ⭕ | Modalidade do frete | `CIF` / `FOB` |
| Informações complementares | ⭕ | Observações fiscais | `Pedido nº 2025-007` |

### Exemplo prático
> **Cenário**: Uma distribuidora em São Paulo vende 50 caixas de produto alimentício para um supermercado em Minas Gerais.
>
> - **CFOP**: `6101` (venda interestadual para contribuinte)
> - **ICMS**: alíquota de 12% (operação SP→MG)
> - **CST**: `000` (tributada integralmente)
> - **Chave DIFAL**: necessária porque o destinatário é consumidor final em outra UF

### 💡 Dicas
- Sempre valide o CNPJ do destinatário na Receita Federal antes de emitir
- Configure os dados do certificado digital A1 ou A3 antes do primeiro uso
- Emita no **modo contingência** (DPEC) se a SEFAZ estiver fora do ar — o prazo para regularização é 24h
- Mantenha o XML e o DANFE por **5 anos** (prazo de prescrição fiscal)

### ⚠️ Erros comuns
- **Rejeição 539**: CNPJ do emitente não habilitado para emissão de NF-e — solicite habilitação na SEFAZ do seu estado
- **Rejeição 204**: NCM inválido — consulte a tabela vigente em [tipi.receita.fazenda.gov.br](https://tipi.receita.fazenda.gov.br)
- **Chave de acesso duplicada**: o número da nota já foi usado — avance o contador e emita novamente
- **Certificado vencido**: renove com 15 dias de antecedência para evitar interrupção

---

## 2. Lançamento Contábil

### O que é?
O lançamento contábil é o registro formal de um fato patrimonial ou financeiro nas contas do Plano de Contas da empresa, seguindo o princípio do **débito e crédito** (partidas dobradas). Todo lançamento deve ter débito igual ao crédito.

### Quando usar
- Para registrar compras, vendas, pagamentos e recebimentos
- Para provisões e depreciações
- Para ajustes de balanço no encerramento do mês

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Data do lançamento | ✅ | Data de competência do fato | `15/05/2025` |
| Conta débito | ✅ | Conta que recebe o débito | `1.1.01 — Caixa` |
| Conta crédito | ✅ | Conta que recebe o crédito | `3.1.01 — Receita de Vendas` |
| Valor | ✅ | Valor em R$ com 2 casas decimais | `R$ 1.500,00` |
| Histórico | ✅ | Descrição do fato gerador | `Venda à vista — NF-e 000123` |
| Número do documento | ⭕ | NF-e, recibo, boleto etc. | `NF-e 000123` |
| Centro de custo | ⭕ | Para rateio gerencial | `CC-03 Comercial` |

### Exemplo prático
> **Cenário**: Empresa recebe R$ 5.000,00 de um cliente via PIX, referente à NF-e 000456.
>
> ```
> D — 1.1.02 Banco c/c .............. R$ 5.000,00
> C — 1.1.03 Clientes ............... R$ 5.000,00
> Histórico: Recebimento NF-e 000456 — Cia ABC
> ```

### 💡 Dicas
- Use históricos padronizados (ex: "Pgto NF" + número) para facilitar a conciliação posterior
- Em lançamentos de provisão, use sempre a data do **último dia do mês de competência**
- Configure modelos de lançamento para operações repetitivas (folha, depreciação)

### ⚠️ Erros comuns
- Débito ≠ Crédito: o sistema não deve aceitar lançamentos desequilibrados
- Usar conta sintética (grupo) em vez de conta analítica (filha)
- Data de lançamento diferente da competência — gera distorção no DRE

---

## 3. Contas a Receber

### O que é?
Módulo de gestão de valores que terceiros devem à sua empresa — clientes, cheques a compensar, duplicatas. Permite acompanhar o prazo, gerar cobrança e registrar o recebimento.

### Quando usar
- Ao vender a prazo (boleto, pix com vencimento, cheque pré-datado)
- Para acompanhar inadimplência e tomar decisões de crédito
- Para gerar o relatório de aging (carteira por faixa de vencimento)

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Cliente | ✅ | Devedor; CNPJ ou CPF | `Supermercado Bom Preço LTDA` |
| Valor | ✅ | Valor original da cobrança | `R$ 2.340,00` |
| Data de vencimento | ✅ | Data limite de pagamento | `30/06/2025` |
| Número do documento | ✅ | NF-e ou número interno | `NF-e 000789` |
| Forma de recebimento | ✅ | Boleto, PIX, cartão, cheque | `Boleto Bancário` |
| Data de emissão | ✅ | Data da venda/serviço | `31/05/2025` |
| Categoria | ⭕ | Para análise gerencial | `Vendas Produto A` |
| Desconto | ⭕ | Se acordado para pagamento antecipado | `2%` |
| Juros/Multa | ⭕ | Para cobrança de atraso | `1% a.m. + 2% multa` |

### Exemplo prático
> **Cenário**: Emitida NF-e de R$ 4.200,00 em 3 parcelas mensais para o cliente "Metalúrgica Silva".
>
> - Parcela 1: R$ 1.400,00 — venc. 10/06/2025
> - Parcela 2: R$ 1.400,00 — venc. 10/07/2025
> - Parcela 3: R$ 1.400,00 — venc. 10/08/2025

### 💡 Dicas
- Configure a régua de cobrança automática: e-mail D-5, D-1, D+1, D+3 e D+7
- Categorize os recebíveis por produto/serviço para análise de rentabilidade
- Títulos vencidos há mais de 90 dias devem ser analisados para provisão de devedores duvidosos

### ⚠️ Erros comuns
- Registrar o recebimento na conta errada (caixa em vez de banco)
- Esquecer de baixar o título após o pagamento — distorce o saldo de inadimplência
- Não calcular juros de mora em títulos vencidos antes de emitir o boleto de renegociação

---

## 4. Contas a Pagar

### O que é?
Controle de obrigações financeiras da empresa com fornecedores, prestadores de serviços, tributos e outras despesas. Permite programar pagamentos e evitar atrasos e multas.

### Quando usar
- Ao receber uma nota fiscal de fornecedor
- Para programar pagamento de tributos (DAS, GPS, DARF, ISS)
- Para controlar folha de pagamento e 13º salário

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Fornecedor/Credor | ✅ | Quem receberá o pagamento | `Fornecedor Eletro Peças LTDA` |
| Valor | ✅ | Valor original da obrigação | `R$ 8.750,00` |
| Data de vencimento | ✅ | Prazo para pagamento | `20/06/2025` |
| Categoria de despesa | ✅ | Para DRE e controle gerencial | `Compra de Matéria-Prima` |
| Número do documento | ✅ | NF, guia, contrato | `NF 004521` |
| Forma de pagamento | ✅ | Boleto, TED, PIX, cheque | `PIX` |
| Data de emissão | ✅ | Data da nota/guia | `05/06/2025` |
| Centro de custo | ⭕ | Rateio por área | `CC-01 Produção` |
| Observação | ⭕ | Instruções para o pagador | `Pagar somente com NF em mãos` |

### Exemplo prático
> **Cenário**: Pagamento de aluguel do galpão industrial, R$ 6.500,00, no dia 10 de cada mês via débito automático.
>
> Cadastre como **despesa recorrente** para gerar automaticamente a parcela todo mês.

### 💡 Dicas
- Use o **aprovação em dois fatores** (maker/checker) para pagamentos acima de determinado valor
- Programe alertas para vencimentos com 5 dias de antecedência
- Negocie sempre pagar no **vencimento** — pagamento antecipado consome caixa sem necessidade

### ⚠️ Erros comuns
- Pagar duplicata sem validar se a NF já foi lançada — duplicidade de pagamento
- Não registrar o rateio por centro de custo — perde a análise de custos por área
- Esquecer de provisionar 13º e férias mensalmente (1/12 por mês)

---

## 5. Fluxo de Caixa

### O que é?
Demonstrativo que apresenta todas as entradas e saídas de caixa e equivalentes de caixa em um período. Permite antecipar necessidades de capital de giro e tomar decisões de investimento.

### Quando usar
- Para projetar o saldo bancário dos próximos 30/60/90 dias
- Antes de assumir novos compromissos financeiros
- Para identificar sazonalidades e picos de necessidade de caixa

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Período | ✅ | Data inicial e final | `01/06/2025 a 30/06/2025` |
| Saldo inicial | ✅ | Saldo bancário no início do período | `R$ 45.000,00` |
| Entradas previstas | ✅ | Recebimentos esperados | `Contas a Receber: R$ 28.000,00` |
| Saídas previstas | ✅ | Pagamentos programados | `Fornecedores: R$ 18.500,00` |
| Conta bancária | ⭕ | Para fluxo por conta | `Bradesco Conta Corrente 1234-5` |
| Categoria | ⭕ | Tipo de receita/despesa | `Operacional / Financeiro / Investimento` |

### Exemplo prático
> **Projeção de junho/2025 — Empresa Comercial:**
>
> | Data | Descrição | Entrada | Saída | Saldo |
> |------|-----------|---------|-------|-------|
> | 01/06 | Saldo inicial | | | R$ 45.000 |
> | 05/06 | Receb. NF 0045 | R$ 12.000 | | R$ 57.000 |
> | 10/06 | Aluguel galpão | | R$ 6.500 | R$ 50.500 |
> | 15/06 | DAS Simples Mai | | R$ 3.200 | R$ 47.300 |

### 💡 Dicas
- Separe o fluxo em **operacional**, **investimento** e **financiamento** (método indireto do CFC)
- Atualize o realizado diariamente com as movimentações bancárias
- Se o saldo projetado ficar negativo em algum dia, acione a linha de crédito com antecedência

### ⚠️ Erros comuns
- Confundir lucro (DRE) com caixa — uma empresa pode ter lucro e quebrar por falta de caixa
- Não incluir tributos com vencimento no período
- Ignorar receitas/despesas sazonais (férias, 13º, Imposto de Renda)

---

## 6. Apuração de Impostos

### O que é?
Cálculo dos tributos devidos pela empresa no período, com base no regime tributário (Simples Nacional, Lucro Presumido ou Lucro Real). Gera as guias de pagamento e os registros contábeis correspondentes.

### Quando usar
- No fechamento de cada mês (ou trimestre, no caso do IRPJ/CSLL no Lucro Presumido)
- Antes do prazo de entrega das obrigações acessórias (EFD, ECF, etc.)

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Regime tributário | ✅ | Simples, Presumido ou Real | `Lucro Presumido` |
| Período de apuração | ✅ | Mês/ano ou trimestre | `05/2025` |
| Receita bruta do período | ✅ | Total das notas emitidas | `R$ 120.000,00` |
| CNAE principal | ✅ | Atividade econômica predominante | `4711-3/01 — Comércio varejista` |
| Deduções | ⭕ | Devoluções, cancelamentos, descontos | `R$ 3.500,00` |
| Créditos de ICMS/PIS/COFINS | ⭕ | Entradas com direito a crédito | `R$ 8.200,00` |

### Exemplo prático
> **Apuração PIS/COFINS — Lucro Presumido (cumulativo):**
>
> - Receita bruta: R$ 120.000,00
> - PIS (0,65%): R$ 780,00 → DARF código 8109
> - COFINS (3%): R$ 3.600,00 → DARF código 2172
> - Vencimento: último dia útil do mês seguinte

### 💡 Dicas
- No **Lucro Real**, a apuração de PIS/COFINS é não-cumulativa (9,25%) com crédito nas entradas — muito mais complexo
- Verifique se há **Substituição Tributária (ICMS-ST)** nas notas de entrada — o imposto já foi recolhido pelo fornecedor
- Utilize o sistema de **EFD-Contribuições** para cruzar com o que será entregue ao SPED

### ⚠️ Erros comuns
- Não segregar receitas de serviços e mercadorias (CSTs diferentes)
- Esquecer de compensar créditos de períodos anteriores
- Apurar IRPJ/CSLL em base presumida diferente da atividade (serviços ≠ comércio ≠ indústria)

---

## 7. DAS Mensal (Simples Nacional)

### O que é?
O **DAS (Documento de Arrecadação do Simples Nacional)** é a guia unificada que recolhe todos os tributos federais, estaduais e municipais das empresas optantes pelo **Simples Nacional** em uma única guia. Emitida mensalmente pelo PGDAS-D no Portal do Simples.

### Quando usar
- Todo mês até o dia 20 (ou próximo dia útil) para empresas ativas no Simples
- Após a apuração da receita bruta do mês anterior

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| CNPJ | ✅ | Raiz do CNPJ do estabelecimento | `12.345.678/0001-99` |
| Período de apuração | ✅ | Mês/ano de referência | `05/2025` |
| Receita bruta acumulada (12 meses) | ✅ | Base para a faixa da tabela | `R$ 480.000,00` |
| Receita bruta do mês | ✅ | Notas emitidas no período | `R$ 42.000,00` |
| Segregação por atividade | ✅ | Comércio, serviço ou indústria | `Comércio: R$ 35.000 / Serviços: R$ 7.000` |
| Benefício fiscal | ⭕ | Isenção de ISS por município | `ISS isento para serviço X` |

### Exemplo prático
> **Empresa no Anexo I (Comércio), 3ª faixa (R$ 360k–R$ 720k/ano):**
>
> - Receita bruta do mês: R$ 42.000,00
> - Alíquota efetiva: ~9,5% (após dedução da parcela)
> - DAS a recolher: ≈ R$ 3.990,00
>
> Gerado automaticamente pelo PGDAS-D — o sistema calcula a alíquota efetiva conforme a faixa.

### 💡 Dicas
- Atraso gera multa de 2% + 0,33% ao dia (máx. 20%) + SELIC — nunca deixe vencer
- O DAS pode ser parcelado em até 60 meses pelo PERT-SN em caso de dificuldade financeira
- Mantenha o histórico de apuração para conferir com a ECF e o DEFIS no ano seguinte

### ⚠️ Erros comuns
- Não informar a receita de todos os estabelecimentos (matriz + filiais)
- Segregar incorretamente comércio e serviços — muda o anexo e o valor do DAS
- Omitir receitas de substituição tributária — devem ser declaradas separadamente no PGDAS

---

## 8. Balanço Patrimonial

### O que é?
Demonstração contábil que apresenta a **posição financeira da empresa em uma data específica** — o que a empresa possui (Ativo), o que deve a terceiros (Passivo) e o capital dos sócios (Patrimônio Líquido). É obrigatória para todos os regimes tributários.

### Quando usar
- No encerramento do exercício (31/12)
- Em encerramento intermediário (semestrais/trimestrais)
- Para fins de financiamento bancário ou análise de crédito

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Data de referência | ✅ | Geralmente 31/12 do exercício | `31/12/2024` |
| Empresa | ✅ | CNPJ e razão social | `Cia Exemplo LTDA` |
| Plano de contas | ✅ | Deve estar completo e conciliado | Conforme estrutura CFC |
| Saldos contábeis | ✅ | Extraídos após todos os lançamentos | Balancete zerado |
| Período comparativo | ⭕ | Exercício anterior para comparação | `31/12/2023` |

### Exemplo prático (estrutura resumida)

```
ATIVO                          PASSIVO + PL
Ativo Circulante               Passivo Circulante
  Caixa/Bancos  R$ 45.000        Fornecedores   R$ 28.000
  Clientes      R$ 62.000        Tributos        R$ 9.500
  Estoques      R$ 38.000        Salários        R$ 15.000
Ativo Não Circulante           Passivo NC
  Imóveis      R$ 250.000        Financiamento  R$ 85.000
  Móveis        R$ 18.000      Patrimônio Líquido
  (-)Depr.      (R$ 24.000)     Capital        R$ 200.000
                                 Lucros Acum.    R$ 51.500
TOTAL          R$ 389.000   TOTAL              R$ 389.000
```

### 💡 Dicas
- O balanço **deve estar zerado**: Ativo = Passivo + PL (se não fechar, há lançamento faltando)
- Aplique os **ajustes de avaliação a valor justo (AVJ)** nos investimentos antes de fechar
- Gere o **LALUR** (Lucro Real) ou **FCont** antes de fechar o balanço fiscal

### ⚠️ Erros comuns
- Deixar contas transitórias com saldo (ex: conta "a classificar")
- Não registrar a depreciação do exercício
- Não segregar circulante de não-circulante (prazo de 12 meses a partir da data do balanço)

---

## 9. DRE — Demonstração do Resultado

### O que é?
A **DRE (Demonstração do Resultado do Exercício)** apresenta se a empresa teve **lucro ou prejuízo** em um período, partindo da receita bruta e deduzindo todos os custos e despesas até chegar ao resultado líquido.

### Quando usar
- Mensalmente (DRE gerencial) para acompanhar desempenho
- Anualmente (DRE contábil obrigatória)
- Para apresentar resultados a sócios, investidores ou banco

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Período | ✅ | Mês, trimestre ou ano | `Jan–Dez/2024` |
| Receita Bruta | ✅ | Total das vendas/serviços antes de impostos | `R$ 1.200.000,00` |
| Deduções da Receita | ✅ | Impostos sobre vendas, devoluções | `(R$ 180.000,00)` |
| CPV / CSV | ✅ | Custo do produto vendido ou serviço prestado | `(R$ 620.000,00)` |
| Despesas Operacionais | ✅ | Vendas, G&A, depreciação | `(R$ 215.000,00)` |
| Resultado Financeiro | ⭕ | Juros ativos e passivos | `(R$ 28.000,00)` |
| IRPJ/CSLL | ⭕ | Tributação sobre o lucro (Lucro Real) | `(R$ 37.000,00)` |

### Exemplo prático

```
Receita Bruta de Vendas              R$ 1.200.000,00
(-) Devoluções e Cancelamentos          (R$ 25.000,00)
(-) Impostos sobre Vendas (ICMS/ISS)   (R$ 155.000,00)
= Receita Líquida                    R$ 1.020.000,00
(-) CPV                               (R$ 620.000,00)
= Lucro Bruto                          R$ 400.000,00
(-) Despesas de Vendas                (R$ 115.000,00)
(-) Despesas Administrativas          (R$ 100.000,00)
= EBIT (LAJIR)                         R$ 185.000,00
(-) Despesas Financeiras               (R$ 28.000,00)
= EBT                                  R$ 157.000,00
(-) IRPJ/CSLL (34%)                    (R$ 53.380,00)
= Lucro Líquido                        R$ 103.620,00
```

### 💡 Dicas
- A **margem EBITDA** (LAJIDA) é o indicador mais usado por investidores — calcule sempre
- Compare com o período anterior e com o orçado para identificar desvios
- No Lucro Real, o IRPJ/CSLL do balanço pode ser diferente do DARF (diferenças temporárias → LALUR)

### ⚠️ Erros comuns
- Incluir receitas financeiras na receita operacional — distorce a margem bruta
- Não lançar a provisão de férias e 13º como despesa do mês de competência
- Misturar resultados de exercícios diferentes (competência vs. caixa)

---

## 10. Balancete de Verificação

### O que é?
O balancete é uma **listagem de todas as contas** do plano de contas com seus saldos devedores e credores, gerada antes do fechamento definitivo. Serve para verificar se os lançamentos estão corretos e os saldos fazem sentido.

### Quando usar
- No fim de cada mês, antes de gerar o Balanço e a DRE
- Para auditar contas suspeitas durante o mês
- Para conciliar saldos com os extratos bancários

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Período | ✅ | Data inicial e final | `01/05/2025 a 31/05/2025` |
| Empresa | ✅ | CNPJ da empresa | `12.345.678/0001-99` |
| Nível de detalhamento | ⭕ | Analítico ou sintético | `Analítico` |
| Filtro por grupo de contas | ⭕ | Para análise por segmento | `Apenas contas de resultado` |

### Exemplo prático
> **Verificação de divergência**: O saldo da conta `1.1.03 Clientes` no balancete é R$ 85.000, mas o relatório de contas a receber mostra R$ 87.400. A diferença de R$ 2.400 indica um lançamento faltante — provavelmente uma NF-e emitida mas não contabilizada.

### 💡 Dicas
- Gere o balancete **antes e depois** de cada fechamento para ver o impacto dos ajustes
- A soma dos saldos devedores deve ser igual à soma dos saldos credores (partidas dobradas)
- Use o balancete sintético para visão executiva e o analítico para auditoria

### ⚠️ Erros comuns
- Gerar o balancete antes de contabilizar todos os lançamentos do período
- Ignorar contas com saldo zero que deveriam ter saldo (ex: estoques zerados sem inventário)
- Não comparar com o balancete do mês anterior para identificar variações atípicas

---

## 11. Livro Razão

### O que é?
O **Livro Razão** apresenta todos os lançamentos de uma conta específica em ordem cronológica, mostrando a movimentação detalhada (débitos, créditos e saldo acumulado). É o ponto de partida para a conciliação e auditoria de qualquer conta.

### Quando usar
- Para conciliar uma conta específica (ex: rastrear todos os movimentos em "Caixa")
- Para responder questionamentos da Receita Federal sobre uma conta
- Para identificar um lançamento incorreto

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Conta contábil | ✅ | Código + descrição da conta | `1.1.03 — Clientes` |
| Período | ✅ | Data de início e fim | `01/01/2025 a 31/05/2025` |
| Empresa | ✅ | CNPJ | `12.345.678/0001-99` |
| Tipo de saída | ⭕ | Tela, PDF ou SPED | `PDF` |

### Exemplo prático
> **Razão da conta Caixa (1.1.01) — Maio/2025:**
>
> | Data | Histórico | Débito | Crédito | Saldo |
> |------|-----------|--------|---------|-------|
> | 01/05 | Saldo anterior | | | R$ 5.800 |
> | 03/05 | Venda à vista NF 123 | R$ 1.200 | | R$ 7.000 |
> | 10/05 | Pgto aluguel | | R$ 3.000 | R$ 4.000 |

### 💡 Dicas
- O Razão do **Caixa Geral** deve bater com o **Fluxo de Caixa Realizado**
- No SPED Contábil, o Livro Razão é gerado automaticamente nos Registros I150/I155
- Filtre por **partida** para ver o lançamento completo (débito + crédito + histórico)

### ⚠️ Erros comuns
- Analisar o razão sem filtrar pelo período correto — traz lançamentos de outros exercícios
- Não conferir o saldo inicial com o saldo final do período anterior
- Ignorar lançamentos de estorno — aparecem como débito e crédito no mesmo período

---

## 12. Cadastro de Empresa

### O que é?
Registro das informações cadastrais, fiscais e contábeis da empresa no sistema. É a base de todos os documentos fiscais emitidos — um erro aqui se propaga para todas as NF-e, declarações e relatórios.

### Quando usar
- Na configuração inicial do sistema
- Ao abrir uma filial
- Ao alterar dados junto à Receita Federal (mudança de endereço, sócio, atividade)

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| CNPJ | ✅ | 14 dígitos; valide o dígito verificador | `12.345.678/0001-99` |
| Razão Social | ✅ | Conforme consta no cartão CNPJ | `Empresa Exemplo Comércio LTDA` |
| Nome Fantasia | ⭕ | Marca comercial | `ExemploShop` |
| Inscrição Estadual | ✅ | Para contribuintes de ICMS | `111.222.333.444` |
| Inscrição Municipal | ⭕ | Para prestadores de serviços | `00123456` |
| CNAE Principal | ✅ | Atividade econômica primária | `4711-3/01` |
| Regime Tributário | ✅ | Simples, Presumido ou Real | `Simples Nacional` |
| Endereço Completo | ✅ | CEP + Logradouro + Número + UF | `Av. Paulista, 1000 – SP/SP` |
| Responsável Contábil | ✅ | CRC do contador responsável | `CRC/SP 123456/O-3` |
| Certificado Digital | ✅ | Série A1 (arquivo) ou A3 (token) | `A1 — vence em 15/03/2026` |

### 💡 Dicas
- Cadastre também o **código do banco**, **agência** e **conta corrente** para geração de boletos
- O **CRT (Código de Regime Tributário)** no XML da NF-e deve refletir o regime aqui cadastrado
- Atualize o certificado digital com pelo menos 30 dias de antecedência

### ⚠️ Erros comuns
- CNPJ digitado sem os pontos e barra — o sistema deve aceitar ambos os formatos
- CNAE diferente do real — pode impactar o cálculo do Simples Nacional (anexos)
- Regime tributário desatualizado após mudança no início do ano

---

## 13. Cadastro de Usuários

### O que é?
Gerenciamento dos usuários que têm acesso ao sistema, seus perfis de permissão e os módulos que podem acessar. Garante segurança e rastreabilidade das ações.

### Quando usar
- Ao contratar um novo funcionário ou estagiário
- Ao conceder acesso temporário a um auditor externo
- Ao revogar acesso após demissão

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Nome completo | ✅ | Para identificação nos logs | `João Pedro Santos` |
| E-mail corporativo | ✅ | Login e recuperação de senha | `joao.santos@empresa.com.br` |
| CPF | ✅ | Identificação fiscal do usuário | `123.456.789-00` |
| Perfil de acesso | ✅ | Nível de permissão | `Contador`, `Financeiro`, `Somente leitura` |
| Empresa(s) | ✅ | A quais CNPJs terá acesso | `Empresa A + Empresa B` |
| Data de expiração | ⭕ | Para acessos temporários | `31/07/2025` |
| 2FA obrigatório | ⭕ | Autenticação de dois fatores | `Sim (recomendado)` |

### Exemplo prático
> **Perfis recomendados:**
>
> | Perfil | Pode emitir NF-e? | Acessa DRE? | Pode excluir? |
> |--------|:-----------------:|:-----------:|:-------------:|
> | Admin | ✅ | ✅ | ✅ |
> | Contador | ✅ | ✅ | ⭕ |
> | Financeiro | ⭕ | ✅ | ❌ |
> | Vendas | ✅ | ❌ | ❌ |
> | Auditor Externo | ❌ | ✅ (leitura) | ❌ |

### 💡 Dicas
- Ative o **2FA obrigatório** para todos os perfis com acesso financeiro ou de emissão fiscal
- Revise os acessos a cada 3 meses (controle de acesso periódico)
- Nunca compartilhe senha — cada usuário deve ter seu próprio login para rastreabilidade

### ⚠️ Erros comuns
- Deixar usuários de ex-funcionários ativos — risco de segurança crítico
- Dar perfil de Admin para todos por comodidade — viola o princípio do menor privilégio
- Não registrar motivo/aprovador na criação de acesso — dificulta auditorias

---

## 14. Plano de Contas

### O que é?
O **Plano de Contas** é a estrutura hierárquica de todas as contas contábeis que a empresa utiliza para registrar seus fatos patrimoniais e financeiros. Segue o padrão do **CFC (Conselho Federal de Contabilidade)** e da NBC TG 26 (IFRS).

### Quando usar
- Na configuração inicial do sistema
- Ao iniciar uma nova atividade econômica que exige novas contas
- Para adequar ao padrão SPED/ECD

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Código | ✅ | Hierárquico com pontos | `1.1.01.001` |
| Descrição | ✅ | Nome da conta | `Caixa — Sede` |
| Tipo | ✅ | Ativo / Passivo / PL / Receita / Despesa | `Ativo` |
| Natureza do saldo | ✅ | Devedora ou Credora | `Devedora` |
| Analítica/Sintética | ✅ | Analítica (recebe lançamentos) ou Sintética (grupo) | `Analítica` |
| Conta redutora | ⭕ | Subtrai de outra conta (ex: depreciação) | `Sim — da conta 1.2.01` |
| Código SPED | ⭕ | Mapeamento para o ECD | `1.01.01.01.01` |

### Exemplo prático (estrutura resumida)

```
1 ATIVO
  1.1 ATIVO CIRCULANTE
    1.1.01 Disponibilidades
      1.1.01.001 Caixa — Sede
      1.1.01.002 Banco Bradesco CC 1234-5
    1.1.02 Clientes
      1.1.02.001 Duplicatas a Receber
      1.1.02.002 (-) Provisão p/ Devedores Duvidosos
  1.2 ATIVO NÃO CIRCULANTE
    1.2.01 Imobilizado
      1.2.01.001 Máquinas e Equipamentos
      1.2.01.002 (-) Depreciação Acumulada — Máquinas
```

### 💡 Dicas
- O sistema já vem com o **Plano de Contas Padrão CFC** — customize apenas o que for necessário
- Nunca exclua contas que já receberam lançamentos — **inative** em vez de excluir
- Mantenha o mapeamento para o **SPED ECD** atualizado para facilitar a entrega obrigatória

### ⚠️ Erros comuns
- Criar contas analíticas dentro de grupos errados (ex: conta de despesa em ativo)
- Usar contas genéricas como "Diversas" — inviabiliza análise futura
- Não configurar a natureza do saldo corretamente — causa relatórios com valores negativos errados

---

## 15. Conciliação Bancária

### O que é?
Processo de **comparar e ajustar** os lançamentos contábeis da conta bancária com o extrato emitido pelo banco. Identifica diferenças (depósitos em trânsito, cheques pendentes, tarifas não lançadas) e corrige divergências.

### Quando usar
- Toda semana (recomendado) ou ao menos uma vez por mês
- Antes do fechamento contábil do mês
- Após a importação do extrato bancário (OFX)

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Conta bancária | ✅ | Banco + agência + conta | `Bradesco 1234 / CC 56789-0` |
| Período | ✅ | Data inicial e final | `01/05/2025 a 31/05/2025` |
| Saldo inicial (extrato) | ✅ | Saldo do banco na data inicial | `R$ 28.450,00` |
| Saldo final (extrato) | ✅ | Saldo do banco na data final | `R$ 31.700,00` |
| Arquivo OFX | ⭕ | Para importação automática de movimentos | `bradesco_mai25.ofx` |

### Exemplo prático
> **Diferença encontrada na conciliação:**
>
> | | Saldo banco | Saldo contábil |
> |-|------------|---------------|
> | Saldo final | R$ 31.700,00 | R$ 30.950,00 |
> | Diferença | | **(R$ 750,00)** |
>
> **Causa identificada**: tarifa bancária de R$ 750,00 lançada pelo banco em 29/05, não registrada na contabilidade.
> **Solução**: Criar lançamento D — Despesas Bancárias / C — Banco R$ 750,00

### 💡 Dicas
- Importe o arquivo **OFX** diretamente do internet banking para evitar erro de digitação
- Configure a **regra de conciliação automática** para PIX e transferências por valor + data
- Concilie diariamente nos períodos de alto movimento (fim/início de mês, datas de folha)

### ⚠️ Erros comuns
- Conciliar com base no regime de **caixa** em vez do de **competência** — os saldos nunca batem
- Não registrar juros e IOF de aplicações financeiras
- Esquecer de estornar cheques devolvidos que foram contabilizados como recebidos

---

## 16. SPED Contábil

### O que é?
O **SPED ECD (Escrituração Contábil Digital)** é a entrega eletrônica obrigatória dos Livros Diário e Razão ao fisco, via arquivo TXT com estrutura definida pelo LEIAUTE ECD. Substitui a autenticação dos livros físicos em papel na Junta Comercial.

### Quando usar
- Anualmente até o último dia útil de junho (ano-base anterior)
- Somente para empresas obrigadas (Lucro Real obrigatório; Presumido e Simples conforme regime)

> **Verificar obrigatoriedade**: MEI e Simples Nacional com receita abaixo de R$ 78 milhões **geralmente não** são obrigados ao SPED ECD — confirme na legislação vigente.

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Ano-calendário | ✅ | Exercício de referência | `2024` |
| CNPJ | ✅ | Matriz — inclui todas as filiais | `12.345.678/0001-99` |
| Versão do leiaute | ✅ | Publicado pela Receita Federal | `Versão 9` |
| Certificado digital | ✅ | A1 ou A3 para assinatura | `Válido` |
| Indicador de situação especial | ⭕ | Fusão, cisão, extinção | `Normal` |
| Auditores independentes | ⭕ | Para S.A. ou empresa de grande porte | `CVM obrigatório` |

### Campos do arquivo ECD (principais registros)

| Registro | Descrição |
|----------|-----------|
| `0000` | Abertura do arquivo + identificação da empresa |
| `0150` | Cadastro de participantes (clientes/fornecedores) |
| `I010` | Identificação do livro (Diário, Razão, Auxiliar) |
| `I050` | Plano de Contas (referencial + analítico) |
| `I100` | Saldos das contas por período |
| `I150/I155` | Lançamentos do Livro Razão |
| `I200/I250` | Lançamentos do Livro Diário |
| `9001` | Encerramento + hash de integridade |

### Exemplo prático
> **Checklist antes de transmitir o ECD:**
>
> - [ ] Balancete zerado (Ativo = Passivo + PL)
> - [ ] Todos os lançamentos com histórico preenchido
> - [ ] Plano de contas mapeado para o referencial analítico CFC
> - [ ] Certificado digital válido (A1 ou A3)
> - [ ] Validação no PVA (Programa Validador e Assinador) sem erros críticos
> - [ ] Backup do arquivo `.sped` antes da transmissão

### 💡 Dicas
- Utilize o **PVA do SPED** (disponível em sped.receita.fazenda.gov.br) para validar o arquivo antes de transmitir
- Empresas com filiais em múltiplos estados devem consolidar tudo em **um único ECD** pela matriz
- Guarde o recibo de entrega (protocolo) por 5 anos

### ⚠️ Erros comuns
- Código do plano de contas não mapeado para o **referencial analítico** — gera erro crítico no PVA
- Certificado digital diferente do responsável legal — assinatura rejeitada
- Não transmitir a **retificação** após corrigir um erro — a entrega original permanece no sistema da Receita

---

## 17. Auditoria e Logs

### O que é?
Registro imutável de todas as ações realizadas no sistema — quem fez, o que fez, quando fez e de onde acessou. Essencial para conformidade com a **LGPD**, rastreabilidade de alterações e investigação de incidentes.

### Quando usar
- Para investigar uma alteração suspeita em um documento fiscal
- Durante auditoria interna ou externa
- Para cumprir exigências de conformidade (SOC 2, LGPD, ISO 27001)

### Campos de pesquisa nos logs

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Período | ✅ | Faixa de datas para busca | `01/05/2025 a 31/05/2025` |
| Usuário | ⭕ | Filtrar por login específico | `joao.santos@empresa.com` |
| Ação | ⭕ | Tipo de operação | `DELETE`, `UPDATE`, `LOGIN_FAIL` |
| Módulo | ⭕ | Área do sistema | `NF-e`, `Usuários`, `Lançamentos` |
| IP de origem | ⭕ | Para rastrear acesso não autorizado | `189.40.xx.xx` |

### Exemplo prático
> **Investigação**: Uma NF-e foi cancelada fora do horário comercial.
>
> Pesquisa nos logs:
> - **Período**: 01/05/2025 21h00 – 02/05/2025 06h00
> - **Módulo**: NF-e
> - **Ação**: CANCEL
>
> Resultado: usuário `financeiro02` cancelou a NF 001234 às 23h47 via IP `189.40.10.55` (acesso remoto) — encaminhar para RH e TI.

### 💡 Dicas
- Configure **alertas automáticos** para ações críticas: exclusão de NF-e, criação de usuário, alteração de senha de admin
- Logs devem ser armazenados por pelo menos **5 anos** (legislação fiscal) e **2 anos** para fins de LGPD
- Exporte os logs regularmente para armazenamento externo — nunca confie só no banco de dados da aplicação

### ⚠️ Erros comuns
- Não ativar os logs de acesso de leitura — somente mudanças não são suficientes para uma auditoria completa
- Permitir que administradores editem os próprios logs — viola a imutabilidade exigida
- Não correlacionar logs da aplicação com os logs de acesso à infraestrutura (servidor/nuvem)

---

## 18. Relatório de Vendas

### O que é?
Consolidação das vendas realizadas em um período, com quebras por produto, cliente, vendedor, região e canal de venda. Subsidia decisões comerciais, metas e comissões.

### Quando usar
- Para acompanhar o desempenho comercial semanal/mensal
- Para calcular comissões de vendedores
- Para identificar produtos com queda ou crescimento de vendas

### Campos

| Campo | Obrigatório | Descrição | Exemplo |
|-------|:-----------:|-----------|---------|
| Período | ✅ | Data inicial e final | `01/05/2025 a 31/05/2025` |
| Agrupamento | ✅ | Como consolidar os dados | `Por vendedor` / `Por produto` |
| Empresa/Filial | ✅ | Escopo do relatório | `Matriz` |
| Status das NF-e | ✅ | Incluir canceladas? | `Somente autorizadas` |
| Cliente | ⭕ | Para análise por conta-chave | `Supermercado Bom Preço` |
| Categoria de produto | ⭕ | Filtro por linha | `Eletrônicos` |
| Formato de saída | ⭕ | Tela, PDF ou Excel | `Excel (.xlsx)` |

### Exemplo prático
> **Relatório de vendas — maio/2025 por vendedor:**
>
> | Vendedor | Qtd NF-e | Valor Bruto | Ticket Médio | Meta | % Meta |
> |----------|:--------:|------------|:------------:|:----:|:------:|
> | Ana Lima | 28 | R$ 84.500 | R$ 3.018 | R$ 80.000 | 105% ✅ |
> | Carlos Melo | 19 | R$ 52.300 | R$ 2.753 | R$ 70.000 | 75% ⚠️ |
> | Total | 47 | R$ 136.800 | R$ 2.911 | R$ 150.000 | 91% |

### 💡 Dicas
- Compare sempre com o **mesmo período do ano anterior** (YoY) para filtrar sazonalidade
- Exclua NF-e canceladas do faturamento para não inflar os números
- Cruze com o **fluxo de caixa** para ver quanto das vendas já foi recebido vs. a receber

### ⚠️ Erros comuns
- Incluir NF-e de devolução como venda positiva — distorce o faturamento
- Não considerar o **prazo médio de recebimento** ao analisar crescimento de vendas
- Analisar somente valor total sem olhar para **margem por produto** — volume alto com margem baixa pode ser prejudicial

---

## Glossário Rápido

| Sigla | Significado |
|-------|-------------|
| CFOP | Código Fiscal de Operações e Prestações |
| CNAE | Classificação Nacional de Atividades Econômicas |
| CPV | Custo do Produto Vendido |
| CRC | Conselho Regional de Contabilidade |
| DAS | Documento de Arrecadação do Simples Nacional |
| DARF | Documento de Arrecadação de Receitas Federais |
| DRE | Demonstração do Resultado do Exercício |
| ECD | Escrituração Contábil Digital |
| EBIT | Earnings Before Interest and Taxes (LAJIR) |
| EBITDA | EBIT + Depreciação + Amortização (LAJIDA) |
| GPS | Guia da Previdência Social |
| IRPJ | Imposto de Renda Pessoa Jurídica |
| ISS | Imposto Sobre Serviços |
| LALUR | Livro de Apuração do Lucro Real |
| LGPD | Lei Geral de Proteção de Dados |
| NBC TG | Norma Brasileira de Contabilidade — Técnica Geral |
| NCM | Nomenclatura Comum do Mercosul |
| NF-e | Nota Fiscal Eletrônica (mercadorias) |
| NFS-e | Nota Fiscal de Serviços Eletrônica |
| OFX | Open Financial Exchange (formato de extrato bancário) |
| PERT-SN | Programa Especial de Regularização Tributária do Simples |
| PGDAS-D | Programa Gerador do Documento de Arrecadação do Simples |
| PIX | Sistema de pagamentos instantâneos do Banco Central |
| PL | Patrimônio Líquido |
| SEFAZ | Secretaria da Fazenda Estadual |
| SPED | Sistema Público de Escrituração Digital |
| ST | Substituição Tributária |

---

## Precisa de ajuda?

- 📞 **Suporte técnico**: Entre em contato pelo chat do sistema (ícone 💬 no canto inferior direito)
- 📚 **Base de conhecimento**: [help.contadorsaas.com.br](https://help.contadorsaas.com.br)
- 🎓 **Tutoriais em vídeo**: Disponíveis em cada serviço (botão "Ver tutorial")
- 🐛 **Reportar bug**: Use o botão "Reportar problema" no menu do usuário

---

*Este guia é atualizado a cada nova versão do sistema. Última revisão: v1.0 — 2025.*
