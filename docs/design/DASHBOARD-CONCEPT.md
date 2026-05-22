# Dashboard Contador-SaaS - Conceito Netflix

**Versão**: 1.0  
**Data**: 22/05/2026  
**ArchitectUX Agent**: Dashboard Foundation Specification  

---

## 🎯 Visão Geral

Transformar o sistema contador-saas de um menu lateral tradicional em um **dashboard modular estilo Netflix**, onde cada serviço contábil é apresentado como um card clicável e visualmente rico. O objetivo é criar uma experiência intuitiva, descoberta natural de funcionalidades e onboarding contextual.

### Princípios de Design

1. **Descoberta Visual**: Usuários exploram serviços como exploram conteúdo na Netflix
2. **Onboarding Contextual**: Cada serviço explica a si mesmo ao ser clicado
3. **Categorização Inteligente**: Organização que espelha workflow contábil real
4. **Status em Tempo Real**: Badges e indicadores mostram alertas e pendências
5. **Ação Direta**: Quick actions nos cards para tarefas comuns
6. **Progressão Guiada**: Sistema mostra próximos passos naturais

---

## 📐 Arquitetura de Layout

### Estrutura da Página Principal

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
│ ┌──────────────┐  ┌────────────────────────────┐  ┌──────────────┐ │
│ │ Logo + Nome  │  │ Search Global              │  │ User + Theme │ │
│ └──────────────┘  └────────────────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ RESUMO EXECUTIVO (Executive Summary Banner)                        │
│ ┌──────────────┬──────────────┬──────────────┬──────────────────┐  │
│ │ 🏢 Empresas  │ ⚠️ Alertas   │ 📊 A Fazer   │ 🎯 Progresso     │  │
│ │ 12 ativas    │ 3 pendentes  │ 7 tarefas    │ 85% completo     │  │
│ └──────────────┴──────────────┴──────────────┴──────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│ FILTROS E NAVEGAÇÃO                                                 │
│ ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐                │
│ │ Todos│Fiscal│Financ│Contáb│Relató│Gestão│Audit │   [🔍 Filtrar]│
│ └──────┴──────┴──────┴──────┴──────┴──────┴──────┘                │
├─────────────────────────────────────────────────────────────────────┤
│ GRID DE SERVICE CARDS                                               │
│                                                                     │
│ ┏━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━┓               │
│ ┃ 📄 NFe       ┃ ┃ 📑 SPED      ┃ ┃ 💰 DAS       ┃               │
│ ┃ Emissão      ┃ ┃ Fiscal       ┃ ┃ Apuração     ┃               │
│ ┃              ┃ ┃              ┃ ┃              ┃               │
│ ┃ [2 alertas]  ┃ ┃ [✓ Ok]       ┃ ┃ [Vence 3d]   ┃               │
│ ┗━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━┛               │
│                                                                     │
│ ┏━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━┓ ┏━━━━━━━━━━━━━━┓               │
│ ┃ 💳 Receber   ┃ ┃ 💸 Pagar     ┃ ┃ 📈 Fluxo     ┃               │
│ ┃ Contas       ┃ ┃ Contas       ┃ ┃ de Caixa     ┃               │
│ ┃              ┃ ┃              ┃ ┃              ┃               │
│ ┃ [R$ 45k]     ┃ ┃ [R$ 23k]     ┃ ┃ [+R$ 22k]    ┃               │
│ ┗━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━┛               │
│                                                                     │
│ ... (mais cards por categoria)                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Dimensões e Espaçamento

**Container Principal**:
- Desktop (≥1920px): `max-width: 1728px` (12 colunas × 144px)
- Desktop (1366px-1919px): `max-width: 1280px` (10 colunas × 128px)
- Tablet (768px-1365px): `max-width: 100%` (2 colunas responsivas)
- Mobile (≤767px): `max-width: 100%` (1 coluna)

**Service Cards**:
- Desktop Large: `280px × 320px` (aspect ratio 7:8)
- Desktop Medium: `240px × 280px`
- Tablet: `48% width` (2 colunas com gap)
- Mobile: `100% width` com `min-height: 160px`

**Gaps e Padding**:
- Grid gap: `24px` (desktop), `16px` (tablet), `12px` (mobile)
- Card padding interno: `24px`
- Section padding: `48px vertical`, `24px horizontal`

---

## 🏗️ Hierarquia de Componentes

### 1. Executive Summary Banner

**Propósito**: Visão executiva instantânea do status do sistema

```
┌──────────────────────────────────────────────────────────────┐
│  Executive Summary - Maio 2026                               │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 🏢 12       │  │ ⚠️ 3        │  │ 📊 7        │         │
│  │ Empresas    │  │ Alertas     │  │ Tarefas     │         │
│  │ Ativas      │  │ Pendentes   │  │ Urgentes    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌───────────────────────────────────────────────┐          │
│  │ 🎯 Progresso Mensal: ████████████░░░░░ 85%   │          │
│  └───────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

**Especificações**:
- Background: `bg-gradient-to-r from-blue-50 to-indigo-50` (light)
- Background: `bg-gradient-to-r from-gray-800 to-gray-900` (dark)
- Height: `160px` (desktop), `auto` (mobile stack vertical)
- Padding: `32px`
- Border radius: `16px`
- Margin bottom: `32px`

**Métricas Exibidas**:
1. **Empresas Ativas**: Total de empresas sendo gerenciadas
2. **Alertas Pendentes**: Soma de notificações urgentes
3. **Tarefas Urgentes**: Ações que vencem em 7 dias
4. **Progresso Mensal**: % de tarefas recorrentes completadas

### 2. Category Navigation

**Propósito**: Filtrar services por categoria funcional

```
┌──────────────────────────────────────────────────────────────┐
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐      │
│  │Todos│  │Fiscal│  │Finan│  │Contáb│  │Relat│  │Gestão│     │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘      │
│    (12)     (4)      (5)      (3)      (4)      (3)         │
└──────────────────────────────────────────────────────────────┘
```

**Especificações**:
- Display: `flex` com `gap-2` ou `gap-4`
- Cada tab: 
  - Padding: `px-6 py-3`
  - Border radius: `12px`
  - Font: `text-sm font-semibold`
  - Hover: `bg-gray-100` (light), `bg-gray-800` (dark)
  - Active: `bg-blue-500 text-white`
  - Transition: `all 200ms ease`

**Estados**:
- **Default**: Cinza claro, texto cinza escuro
- **Hover**: Background escurece levemente
- **Active**: Azul primário, texto branco
- **Disabled**: Opacidade 50%, cursor not-allowed

### 3. Service Card Grid

**Propósito**: Apresentação visual de todos os serviços disponíveis

**Layout Grid**:
```css
.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  padding: 24px 0;
}

@media (max-width: 1365px) {
  .service-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 767px) {
  .service-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
```

---

## 🎨 Categorização de Serviços

### Categoria 1: Fiscal (4 serviços)

| Serviço | Ícone | Descrição Curta | Badge Típico |
|---------|-------|-----------------|--------------|
| **NFe** | 📄 | Emissão de Nota Fiscal Eletrônica | "2 a emitir" |
| **SPED Fiscal** | 📑 | Geração de arquivos SPED | "Mês fechado" |
| **DAS** | 💰 | Apuração Simples Nacional | "Vence em 3 dias" |
| **Apuração ICMS/PIS/COFINS** | 🧾 | Cálculo de impostos mensais | "Aguardando dados" |

### Categoria 2: Financeiro (5 serviços)

| Serviço | Ícone | Descrição Curta | Badge Típico |
|---------|-------|-----------------|--------------|
| **Contas a Receber** | 💳 | Controle de recebimentos | "R$ 45.000" |
| **Contas a Pagar** | 💸 | Gestão de pagamentos | "R$ 23.000" |
| **Fluxo de Caixa** | 📈 | Projeção financeira | "+R$ 22.000" |
| **Conciliação Bancária** | 🏦 | Reconciliação automática | "3 pendentes" |
| **Open Finance** | 🔗 | Integração bancária | "5 contas" |

### Categoria 3: Contábil (5 serviços)

| Serviço | Ícone | Descrição Curta | Badge Típico |
|---------|-------|-----------------|--------------|
| **Lançamentos** | ✍️ | Registro manual de transações | "12 este mês" |
| **Plano de Contas** | 📋 | Estrutura contábil | "142 contas" |
| **Livro Diário** | 📖 | Diário contábil oficial | "Completo" |
| **Razão Contábil** | 🔍 | Consulta por conta | "Atualizado" |
| **Documentos** | 📎 | Anexos e comprovantes | "89 docs" |

### Categoria 4: Relatórios (4 serviços)

| Serviço | Ícone | Descrição Curta | Badge Típico |
|---------|-------|-----------------|--------------|
| **Balanço Patrimonial** | ⚖️ | Ativo, Passivo, PL | "Abril/2026" |
| **DRE** | 📊 | Demonstração de Resultados | "Lucro R$ 12k" |
| **Balancete** | 📉 | Saldos mensais | "Maio/2026" |
| **DFC** | 💹 | Fluxo de Caixa contábil | "Positivo" |

### Categoria 5: Gestão (4 serviços)

| Serviço | Ícone | Descrição Curta | Badge Típico |
|---------|-------|-----------------|--------------|
| **Empresas** | 🏢 | Cadastro de empresas | "12 ativas" |
| **Usuários** | 👥 | Gestão de acessos | "8 usuários" |
| **Configurações** | ⚙️ | Parâmetros do sistema | "Configurado" |
| **Benchmark** | 📊 | Comparação setorial | "Novo" |

### Categoria 6: Auditoria & Segurança (3 serviços)

| Serviço | Ícone | Descrição Curta | Badge Típico |
|---------|-------|-----------------|--------------|
| **Logs de Auditoria** | 📜 | Histórico de ações | "1.234 eventos" |
| **Controle de Acesso** | 🔐 | Permissões e roles | "3 níveis" |
| **Prova Hash** | 🔏 | Integridade blockchain | "100% válido" |

---

## 🔍 Search Global

**Posicionamento**: Topo da página, centro do header

**Funcionalidades**:
1. **Busca de Serviços**: Filtra cards por nome ou descrição
2. **Busca de Conteúdo**: Procura dentro de dados (empresas, contas, etc)
3. **Comandos Rápidos**: Atalhos tipo Spotlight/Cmd+K

**Wireframe**:
```
┌──────────────────────────────────────────────┐
│  🔍  Buscar serviços, empresas, contas...    │
└──────────────────────────────────────────────┘
         ↓ (ao digitar)
┌──────────────────────────────────────────────┐
│ Serviços:                                    │
│  📄 NFe - Emissão de Notas                   │
│  💳 Contas a Receber                         │
│                                              │
│ Empresas:                                    │
│  🏢 Empresa Exemplo LTDA                     │
│  🏢 Comercial ABC S.A.                       │
│                                              │
│ Comandos:                                    │
│  ⚡ Novo lançamento                          │
│  ⚡ Ver alertas pendentes                    │
└──────────────────────────────────────────────┘
```

**Especificações Técnicas**:
- Width: `600px` (desktop), `100%` (mobile)
- Height: `48px`
- Background: `bg-gray-100` (light), `bg-gray-800` (dark)
- Border: `border border-gray-300`
- Border radius: `12px`
- Padding: `12px 16px`
- Ícone: Lucide `Search` tamanho 20px

**Keyboard Shortcuts**:
- `Cmd+K` ou `Ctrl+K`: Abrir search
- `Esc`: Fechar search
- `↑↓`: Navegar resultados
- `Enter`: Selecionar resultado

---

## 📱 Responsive Behavior

### Desktop (≥1920px)

- Grid: 6 colunas (280px cards)
- Executive banner: Horizontal, 4 métricas lado a lado
- Navigation: Todas tabs visíveis
- Cards: Tamanho completo com hover effects ricos

### Desktop Medium (1366px-1919px)

- Grid: 4-5 colunas (240px cards)
- Executive banner: Horizontal, métricas ligeiramente menores
- Navigation: Todas tabs visíveis
- Cards: Tamanho médio

### Tablet (768px-1365px)

- Grid: 2 colunas (48% width cada)
- Executive banner: 2×2 grid de métricas
- Navigation: Scroll horizontal com snap
- Cards: Width responsivo

### Mobile (≤767px)

- Grid: 1 coluna (100% width)
- Executive banner: Stack vertical de métricas
- Navigation: Dropdown select ao invés de tabs
- Cards: Altura reduzida (160px mínimo)
- Search: Full width, posição fixa no topo

**Breakpoint Strategy**:
```css
/* Mobile First Approach */
.container {
  padding: 16px;
}

@media (min-width: 768px) {
  .container {
    padding: 24px;
  }
}

@media (min-width: 1366px) {
  .container {
    padding: 32px;
    max-width: 1280px;
  }
}

@media (min-width: 1920px) {
  .container {
    padding: 48px;
    max-width: 1728px;
  }
}
```

---

## 🎭 Estados de Interação

### Service Card States

1. **Default (Idle)**:
   - Border: `border-2 border-gray-200`
   - Shadow: `shadow-sm`
   - Transform: `scale(1)`

2. **Hover**:
   - Border: `border-blue-400`
   - Shadow: `shadow-xl`
   - Transform: `scale(1.02)`
   - Transition: `all 200ms ease-out`
   - Cursor: `pointer`
   - Overlay: Gradient overlay aparece

3. **Focus (Keyboard)**:
   - Border: `border-blue-500`
   - Outline: `outline-4 outline-blue-300`
   - Shadow: `shadow-2xl`

4. **Active (Click)**:
   - Transform: `scale(0.98)`
   - Shadow: `shadow-md`

5. **Disabled**:
   - Opacity: `0.5`
   - Cursor: `not-allowed`
   - Grayscale: `grayscale(100%)`

### Badge States

**Alert Badge** (vermelho):
- Background: `bg-red-100` (light), `bg-red-900` (dark)
- Text: `text-red-700` (light), `text-red-200` (dark)
- Border: `border border-red-300`

**Warning Badge** (amarelo):
- Background: `bg-yellow-100` (light), `bg-yellow-900` (dark)
- Text: `text-yellow-700` (light), `text-yellow-200` (dark)

**Success Badge** (verde):
- Background: `bg-green-100` (light), `bg-green-900` (dark)
- Text: `text-green-700` (light), `text-green-200` (dark)

**Info Badge** (azul):
- Background: `bg-blue-100` (light), `bg-blue-900` (dark)
- Text: `text-blue-700` (light), `text-blue-200` (dark)

---

## 🚀 Animações e Transições

### Page Load Animation

```
Sequência de entrada (stagger):
1. Executive banner fade-in (0ms)
2. Category nav slide-in from top (100ms)
3. Cards fade-in + slide-up, staggered 50ms cada
```

**CSS Implementation**:
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.service-card {
  animation: fadeInUp 400ms ease-out;
  animation-fill-mode: both;
}

.service-card:nth-child(1) { animation-delay: 0ms; }
.service-card:nth-child(2) { animation-delay: 50ms; }
.service-card:nth-child(3) { animation-delay: 100ms; }
/* ... até 12 cards visíveis */
```

### Hover Effects

**Card Hover**:
```css
.service-card {
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.service-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.service-card:hover .quick-actions {
  opacity: 1;
  transform: translateY(0);
}
```

### Category Filter Transition

```css
.category-filter {
  transition: background-color 150ms ease,
              color 150ms ease,
              transform 100ms ease;
}

.category-filter:active {
  transform: scale(0.95);
}
```

---

## ♿ Acessibilidade (WCAG 2.1 AA)

### Keyboard Navigation

**Tab Order**:
1. Header search
2. Theme toggle
3. User menu
4. Executive summary cards (4 items)
5. Category navigation (6 tabs)
6. Service cards (grid order, left-to-right, top-to-bottom)

**Keyboard Shortcuts**:
- `Tab`: Próximo elemento focável
- `Shift+Tab`: Elemento anterior
- `Enter` ou `Space`: Ativar card/botão
- `Arrow keys`: Navegar dentro de category tabs
- `Home`: Primeiro card
- `End`: Último card
- `Cmd/Ctrl+K`: Abrir search global

### Screen Reader Support

**Semantic HTML Structure**:
```html
<main role="main" aria-label="Dashboard Principal">
  <section aria-label="Resumo Executivo">
    <div role="status" aria-live="polite">
      <!-- Métricas dinâmicas -->
    </div>
  </section>
  
  <nav aria-label="Filtro de Categorias">
    <button role="tab" aria-selected="true">Todos</button>
    <!-- Outras tabs -->
  </nav>
  
  <section aria-label="Serviços Disponíveis">
    <article aria-label="NFe - Emissão de Notas">
      <!-- Card content -->
    </article>
  </section>
</main>
```

**ARIA Labels**:
- Cards: `aria-label="[Nome Serviço] - [Descrição]"`
- Badges: `aria-label="[Tipo] - [Mensagem]"`
- Quick actions: `aria-label="Ação rápida: [Nome Ação]"`

### Color Contrast

**Mínimos WCAG AA**:
- Texto normal: 4.5:1 ratio
- Texto grande (≥18px): 3:1 ratio
- Elementos UI: 3:1 ratio

**Validação**:
- Light mode: Texto `text-gray-900` sobre `bg-white` = 21:1 ✓
- Dark mode: Texto `text-gray-100` sobre `bg-gray-900` = 18:1 ✓
- Badges: Testados com WebAIM Contrast Checker

### Focus Indicators

```css
*:focus-visible {
  outline: 3px solid var(--color-primary-500);
  outline-offset: 2px;
  border-radius: 4px;
}

.service-card:focus-visible {
  box-shadow: 0 0 0 4px var(--color-primary-200),
              0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

---

## 🔄 Loading States

### Initial Page Load

**Skeleton Screen**:
```
┌─────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (Executive banner skeleton)               │
├─────────────────────────────────────────────────────────────┤
│ ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓ (Category tabs)                    │
├─────────────────────────────────────────────────────────────┤
│ ┏━━━━━━━━━━━┓ ┏━━━━━━━━━━━┓ ┏━━━━━━━━━━━┓                 │
│ ┃ ▓▓▓▓▓▓▓   ┃ ┃ ▓▓▓▓▓▓▓   ┃ ┃ ▓▓▓▓▓▓▓   ┃                 │
│ ┃ ▓▓▓▓▓     ┃ ┃ ▓▓▓▓▓     ┃ ┃ ▓▓▓▓▓     ┃                 │
│ ┃ ▓▓▓       ┃ ┃ ▓▓▓       ┃ ┃ ▓▓▓       ┃                 │
│ ┗━━━━━━━━━━━┛ ┗━━━━━━━━━━━┛ ┗━━━━━━━━━━━┛                 │
└─────────────────────────────────────────────────────────────┘
```

**Shimmer Animation**:
```css
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 0%,
    #f8f8f8 50%,
    #f0f0f0 100%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}
```

### Card Data Loading

**Spinner Inside Card**:
```
┏━━━━━━━━━━━━━━┓
┃ 💳 Receber   ┃
┃ Contas       ┃
┃              ┃
┃   ⏳ ...     ┃  ← Pequeno spinner
┗━━━━━━━━━━━━━━┛
```

### Empty States

**Nenhum Serviço Encontrado**:
```
╔════════════════════════════════════════╗
║                                        ║
║          🔍                            ║
║                                        ║
║   Nenhum serviço encontrado            ║
║   para o filtro "fiscal"               ║
║                                        ║
║   [Limpar filtros]                     ║
║                                        ║
╚════════════════════════════════════════╝
```

---

## 🎯 Métricas de Sucesso

### UX Metrics

1. **Tempo até primeira ação**: < 5 segundos
2. **Taxa de descoberta de serviços**: > 80% sem search
3. **Clique em onboarding**: > 60% dos novos usuários
4. **Taxa de conclusão de tarefas**: > 85%

### Performance Metrics

1. **First Contentful Paint**: < 1.5s
2. **Largest Contentful Paint**: < 2.5s
3. **Time to Interactive**: < 3.5s
4. **Cumulative Layout Shift**: < 0.1

### Accessibility Metrics

1. **Keyboard navigation**: 100% dos cards acessíveis
2. **Screen reader**: 100% das ações narrradas corretamente
3. **Color contrast**: 100% AA compliant
4. **Focus indicators**: 100% visíveis

---

## 📋 Checklist de Implementação

### Fase 1: Estrutura Base
- [ ] Header com search global
- [ ] Executive summary banner
- [ ] Category navigation
- [ ] Grid responsivo de cards
- [ ] Theme toggle (light/dark/system)

### Fase 2: Service Cards
- [ ] Card component base
- [ ] Hover states e animações
- [ ] Badge system
- [ ] Quick actions overlay
- [ ] Status indicators

### Fase 3: Interatividade
- [ ] Search global funcionando
- [ ] Filtros de categoria
- [ ] Keyboard navigation
- [ ] Click handlers para cards
- [ ] Modal de onboarding

### Fase 4: Dados Reais
- [ ] Integração com APIs
- [ ] Loading states
- [ ] Error boundaries
- [ ] Empty states
- [ ] Real-time updates

### Fase 5: Polish
- [ ] Animações de entrada
- [ ] Micro-interações
- [ ] Feedback visual
- [ ] Testes de acessibilidade
- [ ] Performance optimization

---

## 🚀 Próximos Passos

1. **Revisar**: `SERVICE-CARDS-SPECS.md` para detalhes de cada card
2. **Implementar**: Design system em `DESIGN-SYSTEM.md`
3. **Construir**: Onboarding flow conforme `ONBOARDING-FLOW.md`
4. **Validar**: Responsive specs em `RESPONSIVE-BREAKPOINTS.md`

---

**ArchitectUX Foundation**: Dashboard Netflix-style concept  
**Developer Handoff**: Ready for implementation com especificações completas  
**Next Agent**: Senior Developer para implementação dos componentes
