# Release Beta com Documentação Completa

## Identificação

- Release: Beta com Documentação Completa
- Status: Aprovada para validação beta
- Data: 2026-05-19
- Escopo: prioridades 1 a 5 do MVP contábil

## Escopo Entregue

### Prioridade 1: Lançamento de documentos

- Captura e organização de documentos fiscais
- Registro operacional para entrada no fluxo contábil
- Guia: [docs/guias/lancamento-documentos.md](docs/guias/lancamento-documentos.md)
- Roteiro: [docs/roteiros/video-lancamento-documentos.md](docs/roteiros/video-lancamento-documentos.md)
- Smoke script: `TAREFA-PRIORIDADE-1-TEST-ENDPOINTS.sh`

### Prioridade 2: Diário contábil

- Lançamentos contábeis com leitura operacional
- Consulta rápida de movimentos registrados
- Guia: [docs/guias/diario-contabil.md](docs/guias/diario-contabil.md)
- Roteiro: [docs/roteiros/video-diario-contabil.md](docs/roteiros/video-diario-contabil.md)
- Smoke script: `TAREFA-PRIORIDADE-2-TEST-ENDPOINTS.sh`

### Prioridade 3: Contas a receber

- Carteira de recebíveis com leitura de aberto, recebido e vencido
- Visão operacional por cliente e status
- Guia: [docs/guias/contas-a-receber.md](docs/guias/contas-a-receber.md)
- Roteiro: [docs/roteiros/video-contas-a-receber.md](docs/roteiros/video-contas-a-receber.md)
- Smoke script: `TAREFA-PRIORIDADE-3-TEST-ENDPOINTS.sh`

### Prioridade 4: Contas a pagar

- Controle de obrigações a pagar com leitura de aberto, pago e vencido
- Visão operacional por fornecedor e status
- Guia: [docs/guias/contas-a-pagar.md](docs/guias/contas-a-pagar.md)
- Roteiro: [docs/roteiros/video-contas-a-pagar.md](docs/roteiros/video-contas-a-pagar.md)
- Smoke script: `TAREFA-PRIORIDADE-4-TEST-ENDPOINTS.sh`

### Prioridade 5: Fluxo de caixa e relatórios básicos

- Resumo executivo do período
- Fluxo mensal com entradas, saídas e saldo
- Exportação de DRE e balanço em PDF e XLSX
- Guia: [docs/guias/fluxo-de-caixa-relatorios.md](docs/guias/fluxo-de-caixa-relatorios.md)
- Roteiro: [docs/roteiros/video-fluxo-de-caixa-relatorios.md](docs/roteiros/video-fluxo-de-caixa-relatorios.md)
- Smoke script: `TAREFA-PRIORIDADE-5-TEST-ENDPOINTS.sh`

## Evidência de QA da Release

### Validação automatizada executada

Comando validado no frontend:

```bash
npm run build
npx playwright test tests/beta-release.spec.ts --project=chromium --config=playwright.release.config.ts
```

Comando validado no backend:

```bash
npm run build
```

### Resultado

- Status final: PASS
- Backend compilando com sucesso
- Frontend compilando com sucesso
- Cobertura funcional validada nas 5 prioridades
- Estratégia: navegação funcional com API mockada para contornar ausência de credenciais reais e massa autenticada de teste
- Ambiente: preview Vite controlado pelo Playwright
- Observação operacional: a suíte de release depende do diretório `dist`, portanto o `npm run build` do frontend é pré-requisito para reexecução local

## Artefatos da Release

- Teste E2E de release: [frontend/tests/beta-release.spec.ts](frontend/tests/beta-release.spec.ts)
- Configuração Playwright da release: [frontend/playwright.release.config.ts](frontend/playwright.release.config.ts)
- Guias funcionais: [docs/guias](docs/guias)
- Roteiros operacionais: [docs/roteiros](docs/roteiros)

## Como validar novamente

### Frontend

```bash
cd frontend
npm install
npm run build
npx playwright install chromium
npx playwright test tests/beta-release.spec.ts --project=chromium --config=playwright.release.config.ts
```

## Observações de empacotamento

- Esta release está pronta para validação beta orientada por documentação.
- O passe automatizado cobre o fluxo principal das cinco prioridades MVP.
- O QA desta release usa mocks de API; a homologação final com credenciais reais e base semeada continua recomendada antes de promover para produção.
