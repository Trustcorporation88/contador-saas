# Emissão de NFe

## 📋 O que é?

A **Nota Fiscal Eletrônica (NFe)**, modelo 55, é o documento fiscal digital usado para registrar operações de circulação de mercadorias (vendas, transferências, devoluções, remessas). Substitui a antiga nota fiscal em papel e é validada pela SEFAZ do estado de origem antes de ter validade jurídica. O resultado da emissão é uma chave de acesso de 44 dígitos, um XML autorizado e um DANFE (representação em PDF) para acompanhar a mercadoria.

## 🎯 Quando usar?

- **Venda de mercadoria para outra empresa (B2B):** sempre que houver saída de produto físico do estoque para um cliente PJ.
- **Venda para consumidor final (B2C) acima do limite:** quando a operação não puder ser representada por NFC-e ou cupom fiscal.
- **Transferência entre filiais:** movimentação de estoque entre estabelecimentos do mesmo CNPJ raiz.
- **Devolução de compra:** ao devolver mercadoria adquirida de um fornecedor.
- **Remessa para conserto, demonstração ou industrialização:** operações sem fim comercial direto, mas que exigem nota.

## 📝 Variáveis Necessárias

### CNPJ do Destinatário
- **Label:** CNPJ do cliente
- **Descrição:** Identificação fiscal do destinatário da mercadoria. Deve estar ativo na Receita Federal.
- **Exemplo:** `12.345.678/0001-95`
- **Obrigatório:** Sim (CPF é aceito quando o destinatário é pessoa física)
- **Tipo:** cnpj

### Natureza da Operação
- **Label:** Natureza da operação
- **Descrição:** Descrição curta da finalidade da nota, vinculada ao CFOP.
- **Exemplo:** `Venda de mercadoria adquirida de terceiros`
- **Obrigatório:** Sim
- **Tipo:** text

### CFOP
- **Label:** CFOP
- **Descrição:** Código Fiscal de Operações e Prestações. Define se a operação é interna, interestadual, de entrada ou saída.
- **Exemplo:** `5102` (venda dentro do estado) ou `6102` (venda interestadual)
- **Obrigatório:** Sim
- **Tipo:** select

### Itens da Nota
- **Label:** Produtos/serviços
- **Descrição:** Lista de itens contendo código, descrição, NCM, CST, quantidade, valor unitário e total.
- **Exemplo:** `1x Cadeira escritório – NCM 9401.30.10 – R$ 850,00`
- **Obrigatório:** Sim
- **Tipo:** text

### Valor Total da Nota
- **Label:** Valor total
- **Descrição:** Soma dos produtos mais frete, seguro e outras despesas, menos descontos.
- **Exemplo:** `R$ 2.450,00`
- **Obrigatório:** Sim
- **Tipo:** currency

### Regime Tributário do Emitente
- **Label:** Regime tributário
- **Descrição:** Regime no qual a empresa está enquadrada, afeta o cálculo de tributos.
- **Exemplo:** `Simples Nacional`
- **Obrigatório:** Sim
- **Tipo:** select

### Data e Hora de Emissão
- **Label:** Data de emissão
- **Descrição:** Momento em que a nota é gerada. Deve ser igual ou anterior à saída da mercadoria.
- **Exemplo:** `15/03/2025 14:30`
- **Obrigatório:** Sim
- **Tipo:** date

### Modalidade de Frete
- **Label:** Frete por conta
- **Descrição:** Quem é o responsável pelo transporte (emitente, destinatário, terceiros ou sem frete).
- **Exemplo:** `0 – Por conta do emitente`
- **Obrigatório:** Sim
- **Tipo:** select

## 💡 Dicas Práticas

- Valide o cadastro do destinatário no portal da SEFAZ antes de emitir; CNPJ baixado gera rejeição automática.
- Mantenha o certificado digital A1 ou A3 dentro da validade — sem ele a nota não é assinada.
- Confira o NCM e o CEST de cada produto a cada início de ano: mudanças na TIPI são comuns.
- Use a numeração sequencial sem pular números. Se um número for inutilizado, faça o evento de "Inutilização" para evitar pendências no SPED.
- Sempre que possível, emita a nota antes da mercadoria sair do estabelecimento — circular sem nota é infração grave.

## ⚠️ Erros Comuns

- **Erro:** "Rejeição 539 – Duplicidade de NF-e" → **Solução:** verifique se a nota já foi transmitida; consulte pela chave de acesso antes de reenviar.
- **Erro:** "Rejeição 233 – IE do destinatário não cadastrada" → **Solução:** confirme a Inscrição Estadual no SINTEGRA do estado do cliente; se ele for isento, marque o campo correspondente.
- **Erro:** Valor de ICMS divergente do esperado → **Solução:** revise a alíquota interna/interestadual, CST e benefícios fiscais aplicáveis ao produto.
- **Erro:** Nota emitida com data retroativa → **Solução:** o prazo máximo é o do envio em até 24h; notas antigas exigem carta de correção ou cancelamento + reemissão.

## ❓ FAQ

### Posso cancelar uma NFe depois de autorizada?
Sim, desde que dentro de **24 horas** da autorização e que a mercadoria ainda não tenha circulado. Após esse prazo, é necessário emitir uma nota de devolução.

### O que é Carta de Correção (CC-e)?
É um evento usado para corrigir informações **não substanciais** da nota (ex.: razão social, endereço, natureza da operação). Não pode ser usada para alterar valores, quantidades, CNPJ do destinatário ou data de emissão. Prazo: até 30 dias após a autorização.

### Qual a diferença entre NFe e NFC-e?
A **NFe (modelo 55)** é para operações entre empresas ou de maior valor, com DANFE em A4. A **NFC-e (modelo 65)** é exclusiva para venda ao consumidor final no varejo, com impressão em bobina.

### Preciso emitir NFe para serviço?
Não. Serviços são documentados pela **NFS-e (Nota Fiscal de Serviços Eletrônica)**, emitida pela prefeitura do município prestador.

### O que faço se a SEFAZ estiver fora do ar?
Utilize o modo de **Contingência (SVC-AN ou SVC-RS)**. A nota é autorizada por um servidor alternativo e deve ser regularizada na SEFAZ de origem assim que o serviço normalizar.

## 📊 Tempo Estimado

**5-15 minutos** por nota, considerando cadastro do destinatário já existente.

## 🔗 Referências

- [Portal Nacional da NFe](https://www.nfe.fazenda.gov.br/)
- [Manual de Orientação do Contribuinte (MOC) – NFe](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=33ol5hhSYZk=)
- [Ajuste SINIEF 07/2005](https://www.confaz.fazenda.gov.br/legislacao/ajustes/2005/aj_007_05) — institui a NFe
- [Tabela de CFOP](https://www.confaz.fazenda.gov.br/legislacao/ajustes/sinief/cfop_cvsn_70_vigente)
