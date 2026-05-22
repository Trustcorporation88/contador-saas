# Sistema de Variáveis Explicativas e Onboarding Contextual

## 🎯 Objetivo
Criar um sistema completo de onboarding e educação inline que explica cada serviço contábil, suas variáveis e como usá-los corretamente, reduzindo confusão e acelerando a adoção.

## 📋 Contexto Atual
- ✅ Já existe `ServiceGuidePanel` que mostra "Como funciona", "Dados a inserir" e "Melhor uso"
- ✅ Já existe `serviceCatalog.ts` com definições básicas de serviços
- ✅ Já existe `services.ts` com 22 serviços mapeados (NFe, DAS, Contas a Receber/Pagar, etc)
- ❌ Falta: mapeamento detalhado de variáveis de cada campo de formulário
- ❌ Falta: tooltips educativos inline nos inputs
- ❌ Falta: wizard de onboarding para primeiro uso
- ❌ Falta: página de detalhes do serviço antes de ir ao formulário
- ❌ Falta: documentação markdown completa por serviço

---

## 🏗️ Arquitetura da Solução

### Estrutura de Dados
```
frontend/src/config/
├── services.ts (já existe - lista de serviços)
├── serviceCatalog.ts (já existe - definições operacionais)
└── servicesHelp.ts (NOVO - mapeamento completo de variáveis)

docs/servicos/ (NOVO - documentação markdown)
├── README.md
├── fiscal/
│   ├── NFE-EMISSAO.md
│   ├── DAS-APURACAO.md
│   └── SPED-FISCAL.md
├── financeiro/
│   ├── CONTAS-RECEBER.md
│   ├── CONTAS-PAGAR.md
│   └── FLUXO-CAIXA.md
└── contabil/
    ├── LANCAMENTOS.md
    └── PLANO-CONTAS.md
```

### Componentes React
```
frontend/src/components/
├── SmartTooltip/ (NOVO)
│   ├── SmartTooltip.tsx
│   └── __tests__/SmartTooltip.test.tsx
├── ServiceWizard/ (NOVO)
│   ├── ServiceWizard.tsx
│   ├── WizardStep.tsx
│   └── __tests__/ServiceWizard.test.tsx
├── HelpCenter/ (NOVO)
│   ├── InlineHelp.tsx
│   ├── QuickTip.tsx
│   └── FAQ.tsx
└── ui/
    └── Disclosure.tsx (NOVO)
```

---

## 📝 Tarefas Detalhadas

### ✅ FASE 1: Mapeamento de Variáveis (2-3h)

#### 1.1. Criar `servicesHelp.ts`
**Arquivo:** `frontend/src/config/servicesHelp.ts`

**Interface TypeScript:**
```typescript
interface ServiceVariable {
  name: string;
  label: string;
  description: string;
  example: string;
  required: boolean;
  type: 'text' | 'number' | 'date' | 'select' | 'currency';
  helpText: string;
  validationRules?: string[];
}

interface ServiceHelp {
  title: string;
  whatIs: string;
  whenToUse: string;
  variables: ServiceVariable[];
  tips: string[];
  estimatedTime: string;
  videoUrl?: string;
  commonErrors?: Array<{ error: string; solution: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}
```

**Serviços prioritários (15+):**
1. Emissão de NFe
2. Lançamento Contábil
3. Contas a Receber
4. Contas a Pagar
5. Fluxo de Caixa
6. Apuração de Impostos (DAS)
7. Balanço Patrimonial
8. DRE
9. SPED Contábil
10. Conciliação Bancária
11. Cadastro de Clientes
12. Cadastro de Fornecedores
13. Plano de Contas
14. Relatório de Vendas
15. Obrigações Acessórias

**Exemplo de mapeamento completo:**
```typescript
'nfe-emission': {
  title: 'Emissão de NFe',
  whatIs: 'Nota Fiscal Eletrônica para vendas de produtos. Documento obrigatório para formalizar vendas.',
  whenToUse: 'Sempre que vender produtos para clientes (pessoa física ou jurídica).',
  variables: [
    {
      name: 'cliente',
      label: 'Cliente (CPF/CNPJ)',
      description: 'Identificação do comprador. Pode ser CPF para pessoa física ou CNPJ para empresa.',
      example: '12.345.678/0001-90',
      required: true,
      type: 'text',
      helpText: 'Digite o CNPJ sem pontos e traços. O sistema formata automaticamente.',
    },
    // ... mais 10-15 campos
  ],
  tips: [
    'Tenha o CNPJ do cliente em mãos antes de começar',
    'Confira os dados do produto no seu cadastro',
    'A natureza da operação mais comum é "Venda"',
  ],
  estimatedTime: '5-10 minutos',
}
```

---

### ✅ FASE 2: Componentes de UI (3-4h)

#### 2.1. SmartTooltip Component
**Arquivo:** `frontend/src/components/SmartTooltip/SmartTooltip.tsx`

**Features:**
- Tooltip rico em hover/focus
- Modo "pinned" (clique para manter aberto)
- Suporta markdown/rich content
- Reposicionamento automático
- Keyboard accessible (Esc, Tab)
- Ícone de ajuda (?)

**Props:**
```typescript
interface SmartTooltipProps {
  content: {
    description: string;
    example?: string;
    helpText?: string;
  };
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  pinnable?: boolean;
}
```

#### 2.2. ServiceWizard Component
**Arquivo:** `frontend/src/components/ServiceWizard/ServiceWizard.tsx`

**Features:**
- Modal responsivo / fullscreen mobile
- Navegação (Próximo/Anterior/Pular)
- Progress indicator (step 1 de 3)
- "Não mostrar novamente" checkbox
- Persistir preferência em localStorage

**Steps padrão:**
1. O que você vai fazer
2. O que você precisa
3. Quanto tempo leva

#### 2.3. QuickTip Component
**Arquivo:** `frontend/src/components/HelpCenter/QuickTip.tsx`

Avisos contextuais inline.

**Tipos:**
- 💡 Dica (azul)
- ⚠️ Atenção (amarelo)
- ✅ Sucesso (verde)
- ❌ Erro (vermelho)

#### 2.4. Disclosure Component
**Arquivo:** `frontend/src/components/ui/Disclosure.tsx`

Progressive disclosure para campos avançados.

```tsx
<Form>
  <BasicFields />
  <Disclosure label="Mostrar opções avançadas">
    <AdvancedFields />
  </Disclosure>
</Form>
```

---

### ✅ FASE 3: Service Detail Page (2h)

#### 3.1. Criar ServiceDetailPage
**Arquivo:** `frontend/src/pages/ServiceDetail/ServiceDetailPage.tsx`

Página intermediária ServiceCard → Formulário.

**Estrutura:**
```tsx
<ServiceDetailPage serviceId={serviceId}>
  <Header>
    <Breadcrumb />
    <ServiceIcon />
    <ServiceTitle />
  </Header>
  
  <Tabs>
    <Tab label="O que é?">
      {SERVICE_HELP[serviceId].whatIs}
    </Tab>
    <Tab label="O que preciso?">
      <VariablesList />
    </Tab>
    <Tab label="Como usar?">
      <StepByStepGuide />
    </Tab>
  </Tabs>
  
  <Actions>
    <Button onClick={openWizard}>Wizard Guiado</Button>
    <Button onClick={goToForm}>Ir ao Formulário</Button>
  </Actions>
</ServiceDetailPage>
```

#### 3.2. Integrar navegação
- ServiceCard → `/servicos/:id` (detail)
- Detail → Formulário real

---

### ✅ FASE 4: Tracking e Persistência (1h)

#### 4.1. Hook useFirstUse
**Arquivo:** `frontend/src/hooks/useFirstUse.ts`

```typescript
export function useFirstUse(serviceId: string) {
  const [isFirstUse, setIsFirstUse] = useState(false);
  
  useEffect(() => {
    const hasUsed = localStorage.getItem(`firstUse_${serviceId}`);
    setIsFirstUse(!hasUsed);
  }, [serviceId]);
  
  const markAsUsed = () => {
    localStorage.setItem(`firstUse_${serviceId}`, 'true');
    setIsFirstUse(false);
  };
  
  return { isFirstUse, markAsUsed };
}
```

---

### ✅ FASE 5: Melhorar Validação (1-2h)

#### 5.1. Feedback educativo
**Arquivo:** `frontend/src/utils/validationMessages.ts`

```typescript
export const validationMessages = {
  required: (field: string, example?: string) => 
    `${field} é obrigatório. ${example ? `Exemplo: ${example}` : ''}`,
  
  invalid: (field: string, hint?: string) =>
    `${field} inválido. ${hint || 'Verifique o formato.'}`,
};
```

**Exemplo em schema:**
```typescript
cnpj: z.string()
  .min(14, validationMessages.required('CNPJ', '12345678000190'))
  .refine(isValidCNPJ, {
    message: 'CNPJ inválido. Verifique os dígitos verificadores.'
  })
```

---

### ✅ FASE 6: Documentação Markdown (2-3h)

#### 6.1. Estrutura de diretórios
```
docs/servicos/
├── README.md (índice)
├── _TEMPLATE.md
├── fiscal/
├── financeiro/
└── contabil/
```

#### 6.2. Template
**Arquivo:** `docs/servicos/_TEMPLATE.md`

```markdown
# [Nome do Serviço]

## 📋 O que é?
[Explicação clara e simples]

## 🎯 Quando usar?
- **Cenário 1:** [...]
- **Cenário 2:** [...]

## 📝 Variáveis Necessárias

### [Variável 1]
- **Label:** [...]
- **Descrição:** [...]
- **Exemplo:** [...]
- **Obrigatório:** Sim/Não

## 💡 Dicas Práticas
- [...]

## ⚠️ Erros Comuns
- **Erro:** [...] → **Solução:** [...]

## ❓ FAQ
### [Pergunta]?
[Resposta]

## 📊 Tempo Estimado
**5-10 minutos**
```

#### 6.3. Criar 15+ documentos
Prioridade:
1. `fiscal/NFE-EMISSAO.md`
2. `contabil/LANCAMENTOS.md`
3. `financeiro/CONTAS-RECEBER.md`
4. `financeiro/CONTAS-PAGAR.md`
5. `fiscal/DAS-APURACAO.md`

---

### ✅ FASE 7: Integração e Testes (2h)

#### 7.1. Integrar SmartTooltip em formulários
- `DocumentoForm.tsx` (NFe)
- `ContaReceberForm.tsx`
- `ContaPagarForm.tsx`

#### 7.2. Adicionar ServiceWizard
- `DocumentosPage.tsx`
- `ContasReceberPage.tsx`
- `LancamentosPage.tsx`

#### 7.3. Testes
- Tooltips em diferentes resoluções
- Wizard flow completo
- localStorage (primeiro uso)
- Acessibilidade (keyboard)

---

## 🎯 Critérios de Sucesso

### Funcionalidade
- ✅ 15+ serviços com variáveis completas
- ✅ SmartTooltip em todos formulários
- ✅ Wizard de onboarding funcionando
- ✅ ServiceDetailPage implementada
- ✅ Validação com feedback educativo
- ✅ Documentação markdown completa

### Qualidade
- ✅ Linguagem simples (sem jargões)
- ✅ Exemplos práticos
- ✅ Acessibilidade (WCAG AA)
- ✅ Responsividade (mobile-first)

---

## 📦 Entregáveis

### Código
1. `frontend/src/config/servicesHelp.ts`
2. `frontend/src/components/SmartTooltip/`
3. `frontend/src/components/ServiceWizard/`
4. `frontend/src/components/HelpCenter/`
5. `frontend/src/pages/ServiceDetail/`
6. `frontend/src/hooks/useFirstUse.ts`
7. `frontend/src/utils/validationMessages.ts`

### Documentação
1. `docs/servicos/README.md`
2. 15+ arquivos markdown
3. `docs/servicos/_TEMPLATE.md`

---

## 🚀 Ordem de Implementação

### Sprint 1 (Dia 1-2)
1. Criar `servicesHelp.ts` com 5 serviços
2. Implementar SmartTooltip
3. Integrar em 1 formulário

### Sprint 2 (Dia 3-4)
4. Implementar ServiceWizard
5. Hook useFirstUse
6. Integrar wizard em 2 páginas
7. Mapear mais 5 serviços

### Sprint 3 (Dia 5-6)
8. ServiceDetailPage
9. Navegação ServiceCard → Detail
10. QuickTip e Disclosure
11. Mapear mais 5 serviços

### Sprint 4 (Dia 7-8)
12. Validação educativa
13. Documentação markdown (15+)
14. InlineHelp component
15. Testes e polimento

---

## 📊 Métricas de Sucesso

### Quantitativas
- Tempo de onboarding: **-50%**
- Taxa de erro em formulários: **-30%**
- Chamados de suporte: **-40%**

### Qualitativas
- NPS: **+10 pontos**
- Feedback: "Agora entendo o que fazer"

---

**Estimativa:** 14-18 horas  
**Timeline:** 1-2 semanas  
**Desenvolvedores:** 1-2 frontend + 1 UX writer
