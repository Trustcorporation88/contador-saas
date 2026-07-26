# Catálogo de Serviços — ProContador (procontador.com.br)

> **Atualizado em**: 2026 · **Público-alvo**: Contadores, gestores financeiros e clientes finais
>
> Este documento lista **todos os serviços** oferecidos pela plataforma e o que cada um entrega.
> Para o passo a passo de uso campo a campo dos fluxos principais, ver [`GUIA-COMPLETO-SERVICOS.md`](./GUIA-COMPLETO-SERVICOS.md).

**Total: 33 serviços**, organizados em 9 categorias. 8 deles são módulos "camada inteligente" (marcados com ✦ na barra de navegação) e funcionam como diferencial competitivo frente a concorrentes como Dootax, Jettax e Visma.

---

## 1. Fundação Contábil

| Serviço | Rota | O que entrega |
|---|---|---|
| **Dashboard / Início** | `/dashboard`, `/` | KPIs financeiros, resumo de transações e visão geral das empresas em cards de acesso rápido. |
| **Plano de Contas** | `/contas` | Estrutura hierárquica de 5 níveis (padrão COSIF), contas analíticas com códigos fiscais, conforme Lei 6.404/76. |
| **Lançador de Partidas Dobradas** | `/lancamentos` | Escrituração contábil por partida dobrada, validação em tempo real, fluxo rascunho→lançado, hash SHA-256 de imutabilidade, estornos. |
| **Documentos Fiscais** | `/documentos` | Hub central para todos os tipos e fluxos de documentos fiscais. |

## 2. Fiscal Autopilot (Emissão e Captura de NF-e)

| Serviço | Rota | O que entrega |
|---|---|---|
| **Emissão de NF-e/NFC-e** | `/documentos/nfe` | Emissão, autorização e cancelamento de notas (modelo 55/65) com integração direta à SEFAZ, download de XML. |
| **OCR de NF-e** | API `/nfe/ocr/*` | Extração automática de dados de PDF/imagem de nota fiscal via OCR, validação na SEFAZ e lançamento contábil automático. |
| **Captura Fiscal (DistDFe)** | API `/fiscalCapture/*` | Upload de certificado A1 (.pfx), sincronização automática com a SEFAZ para captura de NF-e recebidas, reprocessamento. |

## 3. Contas a Pagar/Receber

| Serviço | Rota | O que entrega |
|---|---|---|
| **Contas a Receber** | `/contas-receber` | Controle de faturas de clientes, registro de recebimentos, relatório de inadimplência, lançamento contábil automático. |
| **Contas a Pagar** | `/contas-pagar` | Gestão de faturas de fornecedores, agendamento de pagamentos, lançamentos automáticos no razão. |
| **Lançamentos Recorrentes** | API `/recurring-transactions/*` | Agendamento automático de lançamentos (folha, aluguel, contas) com histórico e trilha de auditoria. |

## 4. Relatórios Obrigatórios

| Serviço | Rota | O que entrega |
|---|---|---|
| **Balanço Patrimonial** | `/relatorios/balanco` | Ativo/Passivo/PL com filtro de datas, exportação XLSX/PDF, formatação Lei 6.404/76. |
| **DRE** | `/relatorios/dre` | Receitas, despesas e lucro líquido com períodos comparativos. |
| **Balancete de Verificação** | API `/reports/trial-balance` | Saldos de contas antes do fechamento, colunas débito/crédito. |
| **Livro Razão** | API `/reports/ledger/:accountId` | Histórico de transações por conta com saldo corrente e trilha de auditoria. |
| **Fluxo de Caixa** | `/relatorios/fluxo-caixa` | Projeção de atividades operacionais/investimento/financiamento com tendências mensais. |
| **Outros Relatórios** | `/relatorios/outros` | Relatórios gerenciais adicionais (resumos mensais/anuais para clientes). |

## 5. Apuração e Compliance Fiscal

| Serviço | Rota | O que entrega |
|---|---|---|
| **DAS — Simples Nacional** | `/impostos/das` | Cálculo mensal (Anexo I ou III), geração automática, agendamento, registro de pagamento, fluxo Pendente→Aprovado→Pago. |
| **Apuração de Impostos** | `/impostos` | Cálculo de IRPJ, CSLL, PIS, COFINS, Simples e Lucro Presumido com status (Pendente→Aprovado→Entregue). |
| **EFD — SPED Contábil** | API `/efd/*` | Geração automática mensal do arquivo digital (ECF/ECD) para envio ao fisco, com validação e agendamento. |

## 6. Camada Inteligente (diferenciais ✦)

| Serviço | Rota | O que entrega |
|---|---|---|
| **Copiloto IA** | `/copiloto` | Assistente conversacional para dúvidas contábeis, análise de lançamentos e orientação regulatória, com exportação de análises em PDF. |
| **Simulador da Reforma Tributária (CBS/IBS)** | `/reforma-tributaria` | Comparação do impacto da Reforma Tributária ano a ano (2026-2033), projeção de CBS/IBS por regime. |
| **Simulador Fiscal** | `/simulador` | Comparação entre Lucro Presumido, Lucro Real e Simples Nacional com análise custo-benefício. |
| **Saúde Financeira** | `/saude` | Liquidez, capital de giro, burn rate e indicadores com sinalização (semáforo). |
| **Benchmark Setorial** | `/benchmark` | Comparação dos indicadores da empresa com médias do setor. |
| **Risco Fiscal SPED** | `/risco-fiscal` | Validação de conformidade SPED, detecção de inconsistências, score de exposição a fiscalização. |
| **Open Finance** | `/open-finance` | Integração de contas e extratos bancários via padrão brasileiro Open Finance. |
| **Prova Criptográfica (Hash)** | `/prova-hash` | Verificação de hash SHA-256 dos lançamentos — prova de imutabilidade para disputas legais. |

## 7. Gestão de Usuários e Empresas

| Serviço | Rota | O que entrega |
|---|---|---|
| **Gerenciamento de Empresas** | `/empresas` | Administração multiempresa, validação de CNPJ, atribuição de usuários. |
| **Portal do Cliente** | `/cliente` | Dashboard restrito para o cliente da contabilidade acompanhar seus dados, relatórios e status do DAS. |

## 8. Administração e Auditoria

| Serviço | Rota | O que entrega |
|---|---|---|
| **Auditoria & Logs** | `/auditoria` | Logs imutáveis de acesso, histórico de alterações, estatísticas de ações, hashes SHA-256 de auditoria. |
| **Configurações** | `/configuracoes` | Dados da empresa, perfil, MFA (TOTP/Authy), preferências de segurança. |
| **Central de Serviços** | `/servicos/hub` | Catálogo com todos os serviços do produto, cartões e acesso guiado. |

## 9. Reconciliação

| Serviço | Rota | O que entrega |
|---|---|---|
| **Reconciliação Bancária** | API `/reconciliation/*` | Upload de extrato (CSV), matching automático de transações, relatório de divergências. |

---

## Posicionamento

O produto se apoia em 3 diferenciais competitivos ("moats") frente a concorrentes brasileiros e internacionais (Dootax, Jettax, Visma, TaxDome, Karbon):

1. **Fiscal Autopilot** — emissão, captura e OCR de NF-e totalmente automatizados (Seção 2).
2. **Firm OS + Client OS** — gestão completa do escritório contábil e portal dedicado para o cliente final (Seções 1, 3, 4, 7, 8).
3. **Reforma-ready (CBS/IBS)** — único simulador com projeção ano a ano (2026-2033) da Reforma Tributária, com motor de cálculo versionado por lei vigente (Seção 6).

**Stack técnico**: React 18 SPA, Node.js/Express, PostgreSQL, JWT + MFA TOTP, hashes SHA-256 de auditoria, OpenAPI 3.0.
