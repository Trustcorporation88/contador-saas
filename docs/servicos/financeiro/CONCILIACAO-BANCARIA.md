# Conciliação Bancária

## 📋 O que é?

A **Conciliação Bancária** é o processo de comparar os lançamentos do **extrato bancário** com os registros internos do sistema financeiro (contas a pagar, a receber e movimentos manuais), identificando diferenças e corrigindo divergências. O objetivo é garantir que o saldo contábil reflita exatamente o saldo bancário disponível.

## 🎯 Quando usar?

- **Diariamente:** conciliação dos movimentos do dia útil anterior assim que o extrato é disponibilizado.
- **No fechamento mensal:** validação completa antes do fechamento contábil.
- **Após operações atípicas:** estornos, devoluções, tarifas extras ou rendimentos de aplicação.
- **Investigação de divergência:** quando o saldo do sistema diverge do extrato, mesmo após movimentações comuns.
- **Auditoria:** preparação dos papéis de trabalho mostrando saldo conciliado por conta.

## 📝 Variáveis Necessárias

### Conta Bancária
- **Label:** Banco / Agência / Conta
- **Descrição:** Identificação da conta a ser conciliada.
- **Exemplo:** `Itaú – Ag 0234 / CC 12345-6`
- **Obrigatório:** Sim
- **Tipo:** select

### Período da Conciliação
- **Label:** Data inicial e final
- **Descrição:** Intervalo do extrato que está sendo conciliado.
- **Exemplo:** `01/03/2025 a 31/03/2025`
- **Obrigatório:** Sim
- **Tipo:** date

### Saldo Inicial do Extrato
- **Label:** Saldo de abertura (banco)
- **Descrição:** Saldo do banco no primeiro dia do período.
- **Exemplo:** `R$ 28.450,30`
- **Obrigatório:** Sim
- **Tipo:** currency

### Saldo Inicial do Sistema
- **Label:** Saldo de abertura (sistema)
- **Descrição:** Saldo registrado no sistema na mesma data. Deve coincidir com o do banco se a conciliação anterior fechou.
- **Exemplo:** `R$ 28.450,30`
- **Obrigatório:** Sim
- **Tipo:** currency

### Arquivo OFX/Extrato
- **Label:** Extrato bancário
- **Descrição:** Arquivo em OFX, CSV ou PDF importado do banco com todos os lançamentos do período.
- **Exemplo:** `extrato_itau_marco2025.ofx`
- **Obrigatório:** Sim
- **Tipo:** text

### Movimentos do Sistema
- **Label:** Lançamentos internos
- **Descrição:** Pagamentos e recebimentos baixados no período, com data de liquidação.
- **Exemplo:** `145 movimentos – R$ 320.500,00 entradas e R$ 295.200,00 saídas`
- **Obrigatório:** Sim
- **Tipo:** currency

### Pendências Identificadas
- **Label:** Itens não conciliados
- **Descrição:** Lançamentos que existem em apenas um dos lados (banco ou sistema).
- **Exemplo:** `Tarifa de manutenção R$ 89,00 não lançada no sistema`
- **Obrigatório:** Sim, se houver
- **Tipo:** text

### Responsável pela Conciliação
- **Label:** Conciliado por
- **Descrição:** Profissional que executou e validou a conciliação.
- **Exemplo:** `Analista Financeiro – Maria Souza`
- **Obrigatório:** Sim
- **Tipo:** text

## 💡 Dicas Práticas

- Use **importação automática via OFX ou Open Finance**: digitação manual é fonte de erro e perda de tempo.
- Trate cada lançamento como **um match único** entre banco e sistema; nunca agrupe vários títulos em um único valor sem rastreabilidade.
- Crie categorias automáticas para **tarifas, IOF, juros recebidos e rendimentos** — eles aparecem mensalmente.
- Faça a conciliação **diariamente**, não mensalmente. Quanto mais tempo passa, mais difícil rastrear divergências antigas.
- Documente o **saldo conciliado** em ata ou planilha assinada para auditoria.

## ⚠️ Erros Comuns

- **Erro:** Conciliar pelo valor sem conferir a data → **Solução:** dois títulos do mesmo valor em datas diferentes geram match incorreto; sempre confronte data + valor + histórico.
- **Erro:** Esquecer de lançar tarifas e IOF → **Solução:** crie regras automáticas no sistema para essas categorias recorrentes.
- **Erro:** Sangrias do caixa físico não registradas → **Solução:** padronize um documento de sangria assinado a cada movimento do caixa para o banco.
- **Erro:** Diferença de centavos acumulando → **Solução:** investigue arredondamentos em parcelamentos e juros calculados; nunca "force" o fechamento.

## ❓ FAQ

### O saldo do banco diverge do sistema em R$ 0,01. O que faço?
Investigue primeiro — geralmente é arredondamento. Se confirmado, faça um ajuste manual lançando a diferença em conta de "Ajustes de Conciliação" para fechar o saldo.

### Posso conciliar contas de aplicação financeira?
Sim, mas use uma conta separada do C/C. Aplicações têm IOF e IR retidos na fonte que precisam ser lançados separadamente.

### O que é a "data de processamento" no extrato?
É a data em que o banco processou o lançamento, que pode ser diferente da **data de movimento** (data efetiva da operação). Para conciliação contábil, use sempre a data de movimento.

### Como conciliar pagamentos em lote (CNAB)?
Concilie o **valor total do lote** com o débito único no extrato, e abra o lote internamente para conciliar título a título contra a relação enviada ao banco.

### E quando o banco lança um valor que eu não reconheço?
Registre temporariamente em conta de **"Lançamentos a Identificar"** e abra ocorrência no banco. Nunca apague o valor — ele afeta o saldo real.

## 📊 Tempo Estimado

**10-30 minutos diários** por conta; **1-3 horas** no fechamento mensal para revisão completa.

## 🔗 Referências

- [Resolução CFC nº 1.330/2011](https://cfc.org.br/) — ITG 2000 (Escrituração Contábil)
- [Padrão OFX (Open Financial Exchange)](https://www.ofx.net/)
- [Open Finance Brasil](https://openfinancebrasil.org.br/)
- [FEBRABAN – Layouts de retorno bancário](https://portal.febraban.org.br/)
