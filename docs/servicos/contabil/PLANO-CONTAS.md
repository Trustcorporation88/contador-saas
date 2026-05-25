# Plano de Contas

## 📋 O que é?

O **Plano de Contas** é a estrutura hierárquica de todas as contas contábeis utilizadas pela empresa para registrar seus fatos patrimoniais e de resultado. Funciona como o "índice" do livro contábil, organizando as contas em grupos (Ativo, Passivo, Patrimônio Líquido, Receitas, Despesas) e níveis (sintéticas e analíticas). É a base que sustenta a consistência de todos os relatórios contábeis e fiscais.

## 🎯 Quando usar?

- **Na abertura da empresa:** definição inicial baseada no porte, atividade e regime tributário.
- **Na adoção de um novo sistema contábil:** importação ou parametrização da estrutura.
- **Na expansão do negócio:** novas filiais, linhas de produto ou centros de custo exigem novas contas.
- **Em mudança de regime tributário:** Simples → Presumido → Real demandam ajustes (PIS/COFINS não-cumulativos, ECF detalhada).
- **Manutenção anual:** revisão de contas inativas, padronização de nomenclatura, alinhamento com a ECD.

## 📝 Variáveis Necessárias

### Código da Conta
- **Label:** Código
- **Descrição:** Sequência numérica hierárquica que identifica unicamente a conta.
- **Exemplo:** `1.1.01.02` (Ativo > Circulante > Disponível > Bancos)
- **Obrigatório:** Sim
- **Tipo:** text

### Descrição
- **Label:** Nome da conta
- **Descrição:** Nome claro e específico da conta. Deve permitir identificação sem ambiguidade.
- **Exemplo:** `Banco Conta Movimento – Itaú Ag 0234`
- **Obrigatório:** Sim
- **Tipo:** text

### Natureza
- **Label:** Natureza
- **Descrição:** Classificação patrimonial da conta.
- **Exemplo:** `Ativo`, `Passivo`, `Patrimônio Líquido`, `Receita`, `Despesa`, `Custo`
- **Obrigatório:** Sim
- **Tipo:** select

### Tipo
- **Label:** Sintética ou analítica
- **Descrição:** Sintética = agrupa subcontas e não recebe lançamentos; Analítica = recebe lançamentos diretamente.
- **Exemplo:** `Analítica`
- **Obrigatório:** Sim
- **Tipo:** select

### Nível Hierárquico
- **Label:** Nível
- **Descrição:** Profundidade da conta na árvore (1 = grupo, 2 = subgrupo, 3 = conta, 4 = subconta etc.).
- **Exemplo:** `Nível 4`
- **Obrigatório:** Sim
- **Tipo:** number

### Conta Referencial (SPED)
- **Label:** Conta de aglutinação ECD
- **Descrição:** Vínculo com a conta-padrão da Receita Federal usada na ECD (Escrituração Contábil Digital).
- **Exemplo:** `1.01.01.01.02 – Bancos conta movimento` (referencial RFB)
- **Obrigatório:** Sim, para empresas obrigadas à ECD
- **Tipo:** select

### Centro de Custo Vinculado
- **Label:** Centros de custo permitidos
- **Descrição:** Lista de centros de custo aos quais a conta pode ser alocada nos lançamentos.
- **Exemplo:** `Todos os CCs administrativos`
- **Obrigatório:** Não
- **Tipo:** select

### Situação
- **Label:** Ativa/Inativa
- **Descrição:** Indica se a conta pode receber novos lançamentos.
- **Exemplo:** `Ativa`
- **Obrigatório:** Sim
- **Tipo:** boolean

## 💡 Dicas Práticas

- Adote desde o início a **estrutura de aglutinação da ECD** — facilita a entrega anual e evita retrabalho.
- Mantenha **um nível de detalhe consistente**: não crie 50 contas analíticas em "Despesas com viagens" se outras categorias têm apenas 2 contas.
- Use **centros de custo** para detalhamentos gerenciais em vez de criar dezenas de subcontas — a estrutura fica mais limpa.
- **Inative** contas em desuso (não exclua); a contabilidade precisa preservar o histórico de movimentação.
- Reserve **lacunas numéricas** entre grupos para futuras inclusões (ex.: pule de 1.1.01 para 1.1.05).

## ⚠️ Erros Comuns

- **Erro:** Criar contas duplicadas (ex.: "Tarifas bancárias" e "Tarifas de banco") → **Solução:** padronize via dicionário de termos antes de cadastrar; faça revisão anual.
- **Erro:** Lançar em conta sintética → **Solução:** o sistema deve bloquear; configure todas as sintéticas como "não permite movimentação".
- **Erro:** Esquecer de vincular conta referencial ECD → **Solução:** a validação do PVA da ECD aponta — não deixe para o último dia da entrega.
- **Erro:** Misturar conta de despesa com conta de custo → **Solução:** revise os critérios: custo se relaciona à produção/revenda; despesa, à estrutura administrativa/comercial.

## ❓ FAQ

### Existe um plano de contas único obrigatório no Brasil?
**Não** para empresas em geral. Cada empresa define seu plano, desde que respeite a Lei 6.404/76 e o CPC. Setores específicos (bancos, seguradoras, entidades públicas) têm planos padronizados obrigatórios.

### Posso ter um plano para gestão e outro para fiscal?
Sim, é prática comum. O **plano gerencial** detalha conforme necessidade interna; o **plano contábil-fiscal** segue padrões da ECD. Ambos devem ser conciliáveis via "de-para".

### Quantos níveis hierárquicos são ideais?
**4 a 6 níveis** é a faixa mais usada. Menos de 4 limita análise; mais de 6 dificulta manutenção e relatórios.

### Como tratar contas em moeda estrangeira?
Crie contas específicas (ex.: "Caixa em USD") e registre em reais com base na taxa do dia, com ajuste de variação cambial mensal contra conta de resultado.

### O que muda no plano com a mudança de regime tributário?
No **Lucro Real**, é necessário detalhar PIS/COFINS não-cumulativos (créditos e débitos), provisões, IR e CSLL diferidos. No **Simples**, a estrutura pode ser mais enxuta.

## 📊 Tempo Estimado

**4-16 horas** na criação inicial; **15-30 minutos** por nova conta na manutenção pontual.

## 🔗 Referências

- [Plano de Contas Referencial – ECD](http://sped.rfb.gov.br/pasta/show/1644)
- [Lei nº 6.404/1976](http://www.planalto.gov.br/ccivil_03/leis/l6404compilada.htm) — Arts. 178 a 188 (Demonstrações Financeiras)
- [Resolução CFC nº 1.282/2010](https://cfc.org.br/) — Princípios de Contabilidade
- [Manual de Orientação da ECD](http://sped.rfb.gov.br/pasta/show/1569)
