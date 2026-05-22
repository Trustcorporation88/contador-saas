# ✅ Checklist de Deploy — O Contador SaaS

> Use este checklist a cada ciclo de deploy. Marque cada item conforme executa.
> Nunca pule itens — cada um existe porque algo já falhou sem ele.

---

## 0. Pré-requisitos

- [ ] Acesso ao Render Dashboard confirmado
- [ ] Acesso ao Vercel Dashboard confirmado
- [ ] Acesso ao banco de produção confirmado
- [ ] Slack/Discord do time disponível para comunicar status

---

## 1. Pré-Deploy (Staging / CI)

| # | Item | Responsável |
|---|------|-------------|
| 1 | CI verde em `main` (todos os jobs passando) | Automático |
| 2 | Build backend sem erros TypeScript | Automático |
| 3 | Build frontend sem erros TypeScript/Vite | Automático |
| 4 | Testes Jest do backend com cobertura ≥ 70% | Automático |
| 5 | Testes E2E Playwright passando | Automático |
| 6 | `npm audit --audit-level=high` limpo (backend) | Automático |
| 7 | `npm audit --audit-level=high` limpo (frontend) | Automático |
| 8 | Performance: Lighthouse score ≥ 90 em staging | Manual |
| 9 | Smoke tests em staging executados | Manual |
| 10 | Code review aprovado (≥ 1 aprovação) | Manual |

---

## 2. Deploy Banco de Dados

> ⚠️ **Fazer SEMPRE antes de qualquer outro deploy**

- [ ] **Backup do banco de produção executado e validado**
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Migration script testado em staging sem erros
- [ ] Rollback plan documentado (qual migration reverter)
- [ ] Janela de manutenção comunicada ao time
- [ ] Executar migrations em produção:
  ```bash
  npm run migrate
  ```
- [ ] Verificar tabelas criadas/alteradas:
  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  ```
- [ ] Verificar índices criados:
  ```sql
  SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
  ```
- [ ] Verificar dados de seed (se aplicável)

---

## 3. Deploy Backend (Render)

- [ ] Variáveis de ambiente de produção configuradas no Render Dashboard
- [ ] `JWT_SECRET` tem ≥ 64 caracteres aleatórios
  ```bash
  # Gerar: openssl rand -base64 64
  ```
- [ ] `REFRESH_TOKEN_SECRET` diferente do `JWT_SECRET`
- [ ] `DATABASE_URL` apontando para o banco de produção correto
- [ ] `REDIS_URL` apontando para Redis de produção
- [ ] `CORS_ORIGIN` configurado com a URL do frontend de produção
- [ ] Deploy iniciado (via CI ou manual no Dashboard)
- [ ] Health check respondendo com HTTP 200:
  ```bash
  curl -I https://api.ocontador.app/api/v1/health
  ```
- [ ] Logs de startup sem erros críticos
- [ ] Tempo de resposta do health check < 500ms

---

## 4. Deploy Frontend (Vercel)

- [ ] `VITE_API_BASE_URL` apontando para o backend de produção
  ```
  VITE_API_BASE_URL=https://api.ocontador.app/api/v1
  ```
- [ ] Build de produção sem erros
- [ ] Deploy promovido para produção no Vercel
- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Testar em mobile (375px) — responsividade OK
- [ ] Testar em desktop (1440px) — layout OK
- [ ] SSL/HTTPS funcionando (cadeado verde)

---

## 5. Pós-Deploy — Verificação Funcional

> Execute em ordem. Se qualquer item falhar, iniciar rollback.

- [ ] Health check API:
  ```bash
  curl https://api.ocontador.app/api/v1/health
  # Esperado: {"status":"ok","uptime":...}
  ```
- [ ] Login de usuário funcionando (testar manualmente)
- [ ] Dashboard principal carregando sem erros
- [ ] **Fluxo crítico completo:**
  1. Login → 2. Criar empresa → 3. Lançamento contábil → 4. Relatório
- [ ] Cache Redis funcionando (verificar métricas de hit rate)
- [ ] Logs de erro no Render/Sentry limpos (0 erros críticos)
- [ ] Monitoramento ativo (alertas configurados)
- [ ] Notificar time: deploy concluído com sucesso ✅

---

## 6. Rollback (Se necessário)

> Execute imediatamente se qualquer etapa da verificação funcional falhar.

### Backend (Render)
- [ ] Acessar Render Dashboard → serviço → "Deploys"
- [ ] Clicar "Rollback" para o deploy anterior estável
- [ ] Aguardar health check voltar ao verde
- [ ] Verificar logs pós-rollback

### Frontend (Vercel)
- [ ] Acessar Vercel Dashboard → projeto → "Deployments"
- [ ] Promover deploy anterior para produção
- [ ] Verificar frontend carregando corretamente

### Banco de Dados (se migration foi aplicada)
- [ ] Executar rollback da migration:
  ```bash
  npm run migrate:rollback
  ```
- [ ] Verificar integridade dos dados
- [ ] Restaurar backup se necessário:
  ```bash
  psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
  ```

### Comunicação
- [ ] Comunicar time sobre o rollback (o que falhou, impacto, prazo para correção)
- [ ] Abrir issue/ticket com root cause analysis
- [ ] Documentar no histórico de deploys

---

## 7. Histórico de Deploys

| Data | Versão | Responsável | Status | Notas |
|------|--------|-------------|--------|-------|
| YYYY-MM-DD | v1.0.0 | @dev | ✅ OK | Deploy inicial |

---

*Última atualização: criado automaticamente pela configuração CI/CD*
