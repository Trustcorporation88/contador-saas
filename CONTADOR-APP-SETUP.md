# 📊 Especificação Inicial - Aplicativo de Contador Comercial Brasileiro

**Data**: Maio 2026  
**Status**: Rascunho Inicial  
**Plataformas**: Desktop (Windows/macOS/Linux) + Mobile (iOS/Android)

---

## 1. Visão Geral

Aplicativo de contador que permite gerenciar a contabilidade de empresas brasileiras regidas pela Lei 6.404/76 (Lei das Sociedades Anônimas) e leis tributárias complementares.

**Objetivo Principal**: Oferecer uma solução integrada de escrituração contábil, cálculo de impostos e geração de relatórios conformes com regulamentações brasileiras (SPED, EFD, NF-e).

---

## 2. Requisitos Funcionais Core

### 2.1 Gestão de Empresas
- [ ] Cadastro de empresa com CNPJ, razão social, endereço
- [ ] Múltiplas empresas em um único aplicativo (multi-tenant)
- [ ] Seleção de regime tributário (Simples Nacional, Lucro Real, Lucro Presumido)
- [ ] Configuração de centro de custos (opcional)
- [ ] Período fiscal configurável (12 meses contínuos)

### 2.2 Plano de Contas
- [ ] Estrutura padrão (ativo, passivo, PL, receita, despesa)
- [ ] Customização de contas (adição/exclusão de contas analíticas)
- [ ] Associação de contas a centros de custo
- [ ] Marcação de contas com código de imposto relacionado (ICMS, ISS, IRPJ, etc.)

### 2.3 Lançamentos Contábeis
- [ ] Entrada de lançamentos em partidas dobradas (débito/crédito)
- [ ] Registro de documentos origem (NF, RPA, cheque, etc.)
- [ ] Validação de saldos devedores/credores
- [ ] Histórico imutável (trilha de auditoria)
- [ ] Attachment de documentos (PDF, imagem)

### 2.4 Apuração de Impostos
- **IRPJ** (cálculo trimestral/anual)
- **CSLL** (cálculo trimestral/anual)
- **PIS** (cálculo mensal)
- **COFINS** (cálculo mensal)
- **ICMS** (se aplicável, cálculo mensal)
- **ISS** (se aplicável, cálculo mensal)
- Justificativas de ajustes fiscais

### 2.5 Relatórios Obrigatórios
- [ ] **Balanço Patrimonial**: ativos, passivos, PL em data específica
- [ ] **DRE**: receitas, despesas, resultado no período
- [ ] **Livro Razão**: detalhes por conta no período
- [ ] **Balancete de Verificação**: saldos de todas contas
- [ ] **Livro Diário** (em formato compatível com SPED)
- Exportação: PDF, Excel, XML (SPED)

### 2.6 Integração com Órgãos Públicos
- [ ] Validação CNPJ (Receita Federal)
- [ ] Consulta de situação cadastral
- [ ] Integração mock com SEFAZ para NF-e (fase inicial)
- [ ] Preparação para geração de EFD-ICMS e EFD-PIS/COFINS

### 2.7 Segurança & Auditoria
- [ ] Autenticação por email/senha + MFA (opcional)
- [ ] Controle de acesso por perfil (admin, contador, visualizador)
- [ ] Log de cada operação (quem, quando, o quê)
- [ ] Backup automático (diário, encrypted)
- [ ] Bloqueio de período contábil encerrado
- [ ] Assinatura digital para documentos críticos (futuro)

---

## 3. Arquitetura & Stack Tecnológico

### 3.1 Backend
```
Linguagem: Node.js (TypeScript) ou Python FastAPI
Framework: Express.js ou FastAPI
Banco de Dados: PostgreSQL 14+ (dados contábeis)
Cache: Redis (sessões, cálculos)
Fila: Bull/RabbitMQ (processamento background)
Autenticação: JWT + MFA (TOTP/Email)
```

### 3.2 Frontend Desktop
```
Framework: React 18+
Containerização: Electron (Windows, macOS, Linux)
Estado: Redux ou Zustand
HTTP: Axios
Validação: React Hook Form + Zod
Styling: Tailwind CSS
Tabelas: TanStack Table
Gráficos: Recharts
```

### 3.3 Frontend Mobile
```
Framework: React Native
Estado: Redux ou Context API
HTTP: Axios
Validação: Formik + Yup
Sincronização: local SQLite + sync engine
Autenticação: Biometric (fingerprint/Face ID) + senha
```

### 3.4 DevOps & Deployment
```
VCS: Git + GitHub
CI/CD: GitHub Actions
Staging: Railway ou Render
Produção: AWS/DigitalOcean/Heroku (backend)
App Desktop: auto-update via Electron Updater
App Mobile: App Store / Google Play
```

---

## 4. Fases de Desenvolvimento

### Fase 1: MVP (Semanas 1-4)
- [ ] Arquitetura base (backend + BD)
- [ ] Autenticação e multi-empresa
- [ ] Plano de contas padrão
- [ ] Lançamentos simples (débito/crédito)
- [ ] Relatórios básicos (Balanço, DRE)
- [ ] Interface web (React) funcional

### Fase 2: Extensão (Semanas 5-8)
- [ ] Desktop (Electron)
- [ ] Mobile (React Native) básico
- [ ] Apuração de impostos (IRPJ, CSLL)
- [ ] Importação de documentos (CSV/Excel)
- [ ] Auditoria/logs

### Fase 3: Conformidade (Semanas 9-12)
- [ ] Validação SPED
- [ ] Integração com APIs públicas
- [ ] Testes de segurança
- [ ] Documentação técnica

### Fase 4: Production (Semanas 13+)
- [ ] Otimizações de performance
- [ ] Testes E2E
- [ ] Lançamento em app stores
- [ ] Suporte ao cliente

---

## 5. Requisitos Não-Funcionais

| Requisito | Descrição |
|-----------|-----------|
| **Performance** | API responde em <200ms; relatórios em <5s |
| **Disponibilidade** | 99.5% uptime |
| **Segurança** | Criptografia E2E, logs de auditoria, sem falhas de OWASP Top 10 |
| **Conformidade** | 100% compatível com SPED, EFD, NF-e |
| **Escalabilidade** | Suporta até 10.000 empresas, 1M lançamentos/mês |
| **Acessibilidade** | WCAG 2.1 AA (web) |
| **Retenção de Dados** | 10 anos (requisito legal) |

---

## 6. Matriz de Compliance Inicial

| Regulamento | Implementação | Prioridade | Status |
|-----------|-----------|-----------|-----------|
| Lei 6.404/76 (SA) | Balanço, DRE, Livro Razão | 🔴 ALTA | ⏳ |
| Lei 5.172/66 (CTN) | Cálculo de impostos | 🔴 ALTA | ⏳ |
| Lei 9.250/95 (IRPJ) | Cálculo e apuração | 🔴 ALTA | ⏳ |
| SPED Contábil | Geração do arquivo | 🔴 ALTA | ⏳ |
| EFD-ICMS/PISCOFINS | Integração mock | 🟡 MÉDIA | ⏳ |
| NF-e/NFC-e | Validação + SEFAZ | 🟡 MÉDIA | ⏳ |
| Lei Geral de Proteção de Dados (LGPD) | Políticas de privacidade | 🟡 MÉDIA | ⏳ |

---

## 7. Próximos Passos

1. **Aprovação de requisitos** ← Você está aqui
2. Spawn de agente **Contabilidade Brasil** para arquitetura detalhada
3. Design de schema PostgreSQL (plano de contas, lançamentos, auditoria)
4. Scaffold do projeto (backend + frontend)
5. Implementação do MVP

---

## 📞 Contato & Dúvidas

Qualquer dúvida sobre conformidade fiscal, deixe para o **Agente Contador Contabilidade Brasil**:

```
/agents Contabilidade Brasil Contador

Quais são as obrigações contábeis mínimas para uma LTDA 
no regime Lucro Real com faturamento de R$ 5M/ano?
```
