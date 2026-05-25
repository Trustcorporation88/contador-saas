# SPED Fiscal (EFD ICMS/IPI)

## 📋 O que é?

O **SPED Fiscal**, oficialmente chamado de **EFD ICMS/IPI (Escrituração Fiscal Digital)**, é um arquivo digital padronizado que substitui a escrituração em papel dos livros fiscais (Registro de Entradas, Saídas, Apuração de ICMS e IPI, Inventário e CIAP). É transmitido mensalmente para a Receita Federal e SEFAZ por empresas dos regimes Lucro Real e Lucro Presumido, principalmente.

## 🎯 Quando usar?

- **Mensalmente, até o dia 20** (varia por estado) do mês seguinte ao período de apuração.
- **Empresas obrigadas:** contribuintes de ICMS/IPI nos regimes Lucro Real e Lucro Presumido. Simples Nacional, em regra, é dispensado (exceto quando excede sublimite estadual).
- **Encerramento de atividades:** envio da EFD da competência final com indicador de situação especial.
- **Cisão, fusão ou incorporação:** arquivo extraordinário deve ser entregue na competência do evento.

## 📝 Variáveis Necessárias

### CNPJ e IE do Estabelecimento
- **Label:** Identificação do estabelecimento
- **Descrição:** CNPJ e Inscrição Estadual do estabelecimento que está sendo escriturado. Cada estabelecimento entrega seu próprio arquivo.
- **Exemplo:** `34.567.890/0001-12` / IE `123.456.789.000`
- **Obrigatório:** Sim
- **Tipo:** cnpj

### Período de Apuração
- **Label:** Competência
- **Descrição:** Mês e ano da escrituração. Datas iniciais e finais devem coincidir com o mês civil.
- **Exemplo:** `01/03/2025 a 31/03/2025`
- **Obrigatório:** Sim
- **Tipo:** date

### Notas Fiscais de Entrada
- **Label:** Documentos de entrada
- **Descrição:** Todas as notas recebidas no período (compras, devoluções de venda, transferências de entrada).
- **Exemplo:** `145 notas de entrada, totalizando R$ 320.500,00`
- **Obrigatório:** Sim
- **Tipo:** number

### Notas Fiscais de Saída
- **Label:** Documentos de saída
- **Descrição:** Todas as notas emitidas (vendas, devoluções de compra, transferências de saída).
- **Exemplo:** `210 notas de saída, totalizando R$ 580.300,00`
- **Obrigatório:** Sim
- **Tipo:** number

### Inventário (Bloco H)
- **Label:** Estoque em 31/12
- **Descrição:** Posição de estoque no encerramento do exercício, com item, quantidade, custo unitário e total.
- **Exemplo:** `Bloco H entregue na EFD de fevereiro do ano seguinte`
- **Obrigatório:** Sim, anualmente (na competência de fevereiro)
- **Tipo:** currency

### Apuração de ICMS
- **Label:** Apuração de ICMS
- **Descrição:** Débitos por saídas, créditos por entradas, saldo a recolher ou credor a transportar.
- **Exemplo:** `Débito R$ 45.000 − Crédito R$ 32.000 = Saldo devedor R$ 13.000`
- **Obrigatório:** Sim
- **Tipo:** currency

### Plano de Contas Contábil Referenciado
- **Label:** Conta contábil
- **Descrição:** Vinculação do item/operação ao plano de contas (registro 0500).
- **Exemplo:** `1.1.03.01 – Estoque de mercadorias`
- **Obrigatório:** Sim, para Lucro Real
- **Tipo:** text

### Certificado Digital
- **Label:** Certificado A1/A3
- **Descrição:** Certificado e-CNPJ válido para assinatura do arquivo antes da transmissão pelo PVA.
- **Exemplo:** `e-CNPJ A1, validade 12/2025`
- **Obrigatório:** Sim
- **Tipo:** text

## 💡 Dicas Práticas

- Reconcilie o **total das notas escrituradas** com o **total transmitido à SEFAZ** antes de gerar o arquivo. Divergências geram intimação.
- Mantenha o cadastro de produtos com NCM e código de item estável; alterações exigem registro 0205 (alteração de descrição).
- Para empresas Lucro Real, garanta que o **Bloco K (controle de produção e estoque)** esteja preenchido conforme o porte exigido.
- Use o **Programa Validador e Assinador (PVA)** da Receita Federal para validar o arquivo antes da transmissão.
- Faça backup do arquivo `.txt` e do recibo gerado pelo PVA por pelo menos **5 anos**.

## ⚠️ Erros Comuns

- **Erro:** "Registro C100 com chave de acesso duplicada" → **Solução:** verifique se a mesma nota foi importada duas vezes do XML; remova a duplicidade na base.
- **Erro:** "Saldo de ICMS divergente da GIA/DAPI" → **Solução:** confira ajustes do registro E111 (estornos, outros débitos/créditos) e os valores informados nas obrigações estaduais.
- **Erro:** "NCM inválido" → **Solução:** atualize a tabela TIPI; NCMs revogados precisam ser substituídos no cadastro do produto.
- **Erro:** Esquecer o **Bloco H (inventário)** na EFD de fevereiro → **Solução:** retificar a EFD com o bloco preenchido; sem retificação, há multa por descumprimento de obrigação acessória.

## ❓ FAQ

### Empresa do Simples Nacional precisa entregar SPED Fiscal?
Em regra, **não**. A exceção ocorre quando o estado obriga contribuintes do Simples a entregar EFD para fins de controle de ICMS-ST ou diferencial de alíquota.

### Posso retificar a EFD após transmitida?
Sim, sem necessidade de autorização, **até o último dia do terceiro mês subsequente** ao encerramento do período. Após esse prazo, exige pedido formal à SEFAZ.

### O que é o Bloco K?
É o bloco de **controle da produção e do estoque**, obrigatório para indústrias e atacadistas. Detalha movimentações internas de produção, perdas e consumos.

### Qual a multa por não entregar a EFD no prazo?
A multa varia por estado, mas em geral é **R$ 500,00 por mês de atraso**, podendo chegar a 2% da receita bruta para empresas obrigadas no nível federal.

### O SPED Fiscal substitui a GIA?
Em alguns estados sim (ex.: SP descontinuou a GIA para a maioria dos contribuintes), em outros as duas obrigações coexistem. Consulte a legislação estadual.

## 📊 Tempo Estimado

**1-4 horas** mensais, dependendo do volume de notas e da maturidade do sistema ERP.

## 🔗 Referências

- [Portal SPED – Receita Federal](http://sped.rfb.gov.br/)
- [Guia Prático da EFD ICMS/IPI](http://sped.rfb.gov.br/pasta/show/1573)
- [Ajuste SINIEF 02/2009](https://www.confaz.fazenda.gov.br/legislacao/ajustes/2009/aj_002_09) — institui a EFD
- [PVA EFD ICMS/IPI](http://sped.rfb.gov.br/pasta/show/1569)
