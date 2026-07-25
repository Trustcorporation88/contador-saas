# Relatório de Revisão e Correções — 25/07/2026

## Contexto

Revisão completa de todos os serviços, automações e integrações do site
**procontador.com.br**, motivada pela exigência de zero erros em um sistema de
contabilidade em produção. O trabalho foi feito em duas fases:

1. **Descoberta**: 17 agentes de revisão especializados, cada um auditando uma
   área do sistema (DAS, impostos, NF-e, contas a pagar/receber, conciliação
   bancária, OCR, EFD, copiloto de IA, relatórios, auditoria, backup,
   infraestrutura multi-tenant).
2. **Correção**: todos os problemas reais encontrados foram corrigidos —
   críticos e não críticos — em 4 commits, com verificação de compilação
   (`tsc --noEmit`) a cada etapa, sem nenhum erro remanescente.

**Repositório**: `github.com/Trustcorporation88/contador-saas`
**Commits**: `81ae33c` → `5aefd7f` → `e3d3057` → `05f4e5b`
**Deploy**: automático via Vercel a cada push em `master`

---

## 1. Vazamentos de dados entre empresas (multi-tenant) — CRÍTICO

O problema mais grave possível para um SaaS multiempresa: um cliente
conseguindo ver ou alterar dados de outro cliente.

| Onde | Problema | Correção |
|---|---|---|
| `middleware/companyContext.ts` | Header `X-Company-Id` trocava a empresa ativa checando só se ela existia — nunca se o usuário tinha vínculo real com ela | Passa a validar o vínculo via `TenantService.validateUserAccess` antes de aceitar a troca |
| `services/companyService.ts` | `getById()`: a checagem de acesso (`if (!hasAccess)`) sempre era falsa por erro de tipo — o acesso NUNCA era negado | Corrigido para checar `!hasAccess.isValid` |
| `services/companyService.ts` | `getById()`: query com `.orWhere('id', companyId)` mal formada podia devolver a empresa errada | Removida a cláusula `orWhere` incorreta |
| `services/companyService.ts` | `update()`: não validava em nenhum momento se o usuário tinha acesso à empresa que estava editando | Adicionada validação de tenant antes de qualquer alteração |
| `routes/fiscalCapture.ts`, `routes/nfeOcr.ts`, `routes/nfe.ts`, `routes/das.ts`, `routes/efd.ts` | Rotas sensíveis (certificado digital, OCR de nota fiscal, emissão de NF-e, DAS, EFD) protegidas só por login — sem checar se a empresa da URL pertencia ao usuário | Adicionado `validateTenantAccess` em todas |
| `services/chatHistoryService.ts` + `controllers/copilotoController.ts` | Sessões do Copiloto de IA não tinham dono — qualquer usuário logado podia ler o histórico financeiro e baixar o PDF de análise de **qualquer outra empresa** | Sessões agora exigem `ownerUserId`; toda leitura/exportação valida o dono |
| `routes/copilotoRoutes.ts` | Arquivo de rotas duplicado, sem autenticação nenhuma, coexistindo como "código morto perigoso" | Removido |
| `services/efdBuilderService.ts` + `controllers/efdController.ts` | Download, validação, cancelamento e consulta de EFD buscavam só pelo ID do documento, sem checar a que empresa ele pertence | Todas as consultas agora filtram por `company_id` |

---

## 2. Automação de EFD (Escrituração Fiscal Digital) — estava 100% inoperante

A automação mais crítica do sistema (gera o arquivo obrigatório enviado à
Receita Federal) nunca funcionava de verdade:

- **O agendador nunca era inicializado** — faltava a chamada em `server.ts`.
  Corrigido: `EFDSchedulerService.initializeSchedules()` agora roda no boot.
- **As tabelas do banco nunca eram criadas** — a migration existia em
  `add_efd_tables.ts` mas não estava conectada ao sistema de migrations
  automático do projeto. Corrigido: registrada em `migrationRunner.ts`.
- **A geração sempre quebrava com erro** — o código referenciava
  `company.company_name`, campo que não existe (o campo real é `legal_name`).
  Corrigido.
- **Bug de numeração (off-by-one)** corrompia a sequência de registros no
  arquivo `.txt` final, o que causaria rejeição pela Receita.
- **Campos obrigatórios do layout SPED estavam faltando** (data/hora de
  geração, natureza da conta, indicador de balanceamento) — arquivo ficaria
  incompleto mesmo quando "gerado com sucesso".
- **Erros de banco durante a geração eram engolidos silenciosamente**,
  permitindo que uma EFD vazia ou incompleta fosse marcada como válida.
- **Nome do arquivo baixado sempre era `EFD_UNKNOWN_...`** porque os metadados
  nunca eram preenchidos.
- **Não era possível regenerar uma EFD após cancelá-la** — trava de unicidade
  no banco impedia. Corrigido com índice parcial que ignora EFDs canceladas.
- **Falha na geração automática podia passar despercebida** se a notificação
  por e-mail estivesse desligada — corrigido para sempre notificar em caso de
  erro (compliance tem prioridade sobre preferência de notificação).
- **Cálculo do "mês anterior" usava o fuso horário do servidor**, podendo
  gerar a EFD do mês errado perto da virada de mês — corrigido para usar o
  fuso configurado da empresa via Luxon.
- **Não existiam endpoints para configurar o agendamento automático por
  empresa** — adicionados `GET/PUT /efd/schedule` e `POST /efd/schedule/disable`.

---

## 3. Cálculos fiscais e contábeis incorretos

| Onde | Problema | Impacto |
|---|---|---|
| Simulador de regime tributário (Lucro Real) | Lucro líquido exibido não descontava PIS/COFINS | Lucro superestimado em toda simulação de Lucro Real |
| Simulador (Lucro Presumido) | CSLL sempre calculada com base de 32%, mesmo para comércio/indústria (deveria ser 12%) | Carga tributária do Lucro Presumido aparecia ~2,7x maior que a real |
| Simulador (Simples Nacional) | Despesas informadas pelo usuário eram ignoradas (sempre assumia 70% fixo) | Comparação entre regimes tributários não era "maçã com maçã" |
| Livro Razão (`reportService.ts`) | Saldo de abertura sempre retornava zero ao filtrar por data | Saldo de contas com movimentação anterior ao filtro ficava incorreto |
| Lançamentos contábeis (`journalService.ts`) | Um lançamento postado podia ser estornado **mais de uma vez** | Duplicação de valores na contabilidade |
| Dashboard / Risco Fiscal | Campos de custo e impostos vinham zerados do relatório simplificado, mas eram tratados como valor real | Alerta de "carga tributária suspeita" disparava para praticamente qualquer empresa lucrativa |
| Score de Saúde Financeira | Empresa sem dívida de curto prazo recebia a **pior nota possível** em liquidez, em vez da melhor | Score distorcido para empresas financeiramente saudáveis |
| `services/taxCalculationService.ts` | Sobretaxa do IRPJ contada em dobro ao salvar a apuração no banco | Valor de imposto salvo maior que o calculado |

---

## 4. DAS (Documento de Arrecadação do Simples Nacional)

- Cálculo automático do DAS usava coluna e campos que não existem na tabela
  de apurações — a geração automática nunca funcionava de fato.
- **Número de nota fiscal informado manualmente** (quando o cliente usa mais
  de um sistema) não verificava **ordem cronológica** — era possível informar
  um número menor que o último já emitido sem nenhum aviso, o que a SEFAZ
  rejeitaria ou geraria inconsistência fiscal grave. Corrigido: o sistema
  agora bloqueia números fora de ordem e avisa sobre lacunas na numeração
  (que exigem inutilização perante a SEFAZ).
- Rota de agendamento (`/das/agendamento/:regime`) nunca era alcançada por
  erro de ordem de rotas — corrigido.
- Validação de `valor_original` aceitava texto (`"abc"`) sem rejeitar,
  por causa de comparação numérica implícita do JavaScript.

---

## 5. Conciliação bancária e OCR de Nota Fiscal

**Conciliação bancária:**
- Buscar sugestões de conciliação (`GET`) duplicava os registros no banco a
  cada chamada — um simples F5 na tela inflava os dados.
- Contagem de transações conciliadas podia ficar **negativa**.
- Heurística de comparação de descrição zerava a pontuação só porque a
  primeira palavra das duas strings era diferente, mesmo com alta
  similaridade no restante do texto.
- Certificado digital armazenado sem criptografia (base64 puro) no banco —
  corrigido para usar criptografia AES-256-GCM com chave dedicada.
- Race condition no arquivo de configuração usado pela sincronização
  automática — corrigido com nome de arquivo único por execução.

**OCR de Nota Fiscal (extração automática de dados):**
- Regex da série da nota **nunca capturava o valor** (erro de agrupamento no
  regex) — o campo ficava sempre vazio.
- Regex do valor total não reconhecia o rótulo padrão do DANFE
  ("VALOR TOTAL DA NOTA") — extração falhava na maioria dos documentos reais.
- Lançamento contábil era criado mesmo quando o sistema classificava a
  própria extração como "baixa confiança" — corrigido para bloquear.
- Tipo de lançamento (compra ou venda) sempre fixo como "entrada" mesmo para
  notas emitidas pela própria empresa — agora compara o CNPJ do emitente.
- Nenhuma validação de que o arquivo enviado era realmente um PDF/imagem
  (só confiava no `Content-Type` do navegador, facilmente falsificável) —
  adicionada verificação de assinatura binária do arquivo.
- Nenhuma validação de que as contas contábeis usadas no lançamento
  realmente existem no plano de contas da empresa.

---

## 6. Copiloto de IA (assistente contábil)

- **O backend confiava cegamente nos números financeiros enviados pelo
  cliente** para gerar análises e PDFs — permitindo fabricar relatórios com
  aparência oficial e dados falsos. Corrigido: o backend agora busca o
  balanço e DRE reais da empresa autenticada, ignorando o que o cliente
  envia no corpo da requisição.
- Nome da empresa era interpolado sem sanitização no prompt do sistema do
  LLM — abria brecha de *prompt injection*. Corrigido com sanitização.
- Sem limite de tamanho de mensagem — um usuário podia enviar textos
  gigantes e gerar custo alto de API sem controle.
- Sem limite de requisições dedicado ao endpoint de IA (que tem custo real de
  API) — adicionado rate limit de 10 mensagens/minuto por usuário.
- Bug fazia a tela principal do Copiloto **nunca chamar a API DeepSeek de
  verdade** (faltava criar a sessão antes de enviar a mensagem) — o usuário
  via sempre a resposta do motor local, mesmo com IA configurada e
  disponível.
- Sessões de chat em memória nunca expiravam (vazamento de memória
  progressivo) — agora expiram após 24h de inatividade.

---

## 7. Auditoria e rastreabilidade

- Senhas e outros dados sensíveis (token, segredo de MFA) eram gravados em
  **texto plano** na tabela de logs de auditoria sempre que um login ou troca
  de senha acontecia — corrigido com lista de exclusão de rotas + máscara de
  campos sensíveis.
- A tabela de logs não tinha coluna de empresa — o filtro "auditoria por
  empresa", documentado e usado pela tela, nunca funcionava de fato.
- Nomenclatura dos campos retornados pela API não batia com o que o frontend
  esperava — os cards de estatísticas da tela de Auditoria sempre mostravam
  "—" em vez dos números reais.
- Histórico de alterações de uma entidade e atividade de usuário não tinham
  paginação — corrigido.
- Tela de Auditoria não tratava falha de carregamento (ficava com tabela
  vazia sem nenhum aviso) — corrigido.
- Tela de "Prova Hash" não tinha tratamento de erro — corrigido.

---

## 8. Backup, plano de contas e infraestrutura

- Caminho absoluto do servidor era exposto na resposta da API de backups —
  removido da resposta pública.
- Diretório de backup lido de forma inconsistente entre funções do mesmo
  serviço — centralizado.
- Uma conta contábil podia ser vinculada a um pai já desativado/excluído.
- Contas cujo pai estava inativo **desapareciam silenciosamente** da árvore
  hierárquica do plano de contas, mesmo continuando ativas e com lançamentos
  — corrigido para promovê-las à raiz da árvore em vez de descartá-las.
- Hash de integridade dos lançamentos contábeis não cobria todos os campos
  (só linhas de débito/crédito) e não era recalculado ao editar descrição ou
  referência do lançamento — corrigido, e adicionado método de verificação
  de integridade.
- Query SQL inválida (`DISTINCT` + `COUNT` sem `GROUP BY`) quebrava
  silenciosamente a detecção de troca de empresa suspeita.
- Log de troca de empresa sempre registrava a empresa de origem como
  "indefinida" — corrigido.
- Credenciais de demonstração (login de teste) eram resetadas a cada reinício
  do servidor, revertendo qualquer alteração de senha feita por um admin.

---

## Itens sinalizados como decisão de produto (não bugs de código)

Dois pontos identificados na revisão não são bugs a corrigir, mas
funcionalidades que hoje são apenas protótipos visuais e merecem uma decisão
consciente sobre construí-las de verdade ou deixar claro na interface que são
demonstrações:

1. **Tela de Conciliação Bancária (Open Finance)** — 100% simulada no
   frontend; não persiste nada real, apesar de exibir "lançamento aceito e
   registrado". O motor de verdade já existe no backend (com os bugs já
   corrigidos), mas não está conectado a essa tela.
2. **Prova Hash** — calculada inteiramente no navegador do usuário, sem
   nenhuma contraparte no backend. Hoje não é verificável por terceiros
   (bancos, investidores), apesar de a tela sugerir uma "prova de integridade
   comprovável".

---

## Verificação

- Backend e frontend compilam sem nenhum erro (`npx tsc --noEmit`) após cada
  lote de correções.
- Todas as migrations novas são idempotentes e defensivas — não derrubam o
  deploy caso já existam dados divergentes (ex.: duplicidades anteriores),
  apenas registram aviso em log.
- Compatibilidade com dados já gravados em produção preservada onde
  aplicável (ex.: certificados digitais salvos antes da criptografia do
  `.pfx` continuam sendo lidos corretamente via fallback).

## Resumo numérico

| Métrica | Valor |
|---|---|
| Áreas do sistema auditadas | 12 (DAS, impostos, NF-e, contas a pagar/receber, conciliação, OCR, EFD, copiloto, relatórios, auditoria, backup, infraestrutura) |
| Agentes de revisão especializados | 17 |
| Commits de correção | 4 |
| Arquivos alterados | ~55 (contando arquivos únicos entre os 4 commits) |
| Vazamentos cross-tenant corrigidos | 8 |
| Automação completamente inoperante corrigida | 1 (EFD) |
| Erros de cálculo fiscal/contábil corrigidos | 7 |
