# Service Cards - Especificação Técnica Completa

**Versão**: 1.0  
**Data**: 22/05/2026  
**ArchitectUX Agent**: Component Specification  

---

## 🎴 Anatomia de um Service Card

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ┌─────────────────────────────────┐ ┃ ← Header (60px)
┃ │ 📄 NFe           [2 alertas]    │ ┃   - Icon (32px)
┃ │ Emissão de Notas Fiscais        │ ┃   - Title + Badge
┃ └─────────────────────────────────┘ ┃
┃                                     ┃
┃ ┌─────────────────────────────────┐ ┃ ← Body (160px)
┃ │ Quick Stats:                    │ ┃   - Métricas principais
┃ │ • 156 NFes emitidas este mês    │ ┃   - Status
┃ │ • R$ 245.000 faturado           │ ┃   - Preview de dados
┃ │ • Última: 22/05 10:30           │ ┃
┃ └─────────────────────────────────┘ ┃
┃                                     ┃
┃ ┌─────────────────────────────────┐ ┃ ← Footer (60px)
┃ │ [Nova NFe] [Consultar] [Relat]  │ ┃   - Quick Actions
┃ └─────────────────────────────────┘ ┃   - (aparece no hover)
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  280px × 320px (desktop)
```

---

## 📐 Dimensões e Estrutura

### Card Container

**Desktop (≥1366px)**:
```css
.service-card {
  width: 280px;
  height: 320px;
  border-radius: 16px;
  padding: 24px;
  border: 2px solid var(--border-color);
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  overflow: hidden;
}
```

**Tablet (768px-1365px)**:
```css
.service-card {
  width: 48%; /* 2 colunas */
  min-height: 280px;
  padding: 20px;
}
```

**Mobile (≤767px)**:
```css
.service-card {
  width: 100%;
  min-height: 160px; /* Compacto */
  padding: 16px;
  display: flex;
  flex-direction: row; /* Horizontal no mobile */
  gap: 12px;
}
```

### Internal Structure

```
┌─────────────────────────────────┐
│ Header (auto height)            │ ← .card-header
├─────────────────────────────────┤
│ Body (flex-1)                   │ ← .card-body
├─────────────────────────────────┤
│ Footer (auto height)            │ ← .card-footer
└─────────────────────────────────┘
```

**CSS Grid Layout**:
```css
.service-card {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto; /* Se conteúdo exceder */
}

.card-footer {
  display: flex;
  gap: 8px;
  opacity: 0; /* Hidden por padrão */
  transform: translateY(10px);
  transition: all 200ms ease;
}

.service-card:hover .card-footer {
  opacity: 1;
  transform: translateY(0);
}
```

---

## 🎨 Componentes do Card

### 1. Card Header

**Estrutura**:
```html
<div class="card-header">
  <div class="card-title-group">
    <div class="card-icon">📄</div>
    <div>
      <h3 class="card-title">NFe</h3>
      <p class="card-subtitle">Emissão de Notas Fiscais</p>
    </div>
  </div>
  <div class="card-badge">
    <span class="badge badge-alert">2 alertas</span>
  </div>
</div>
```

**Especificações**:

**Icon**:
- Size: `32px × 32px`
- Background: `bg-blue-100` (light), `bg-blue-900` (dark)
- Border radius: `8px`
- Padding: `6px`
- Emoji ou Lucide icon
- Pode ter gradient background para categorias

**Title**:
- Font: `text-lg font-bold` (18px, 700)
- Color: `text-gray-900` (light), `text-gray-100` (dark)
- Line height: `1.2`
- Max width: `180px`
- Overflow: `text-overflow: ellipsis`

**Subtitle**:
- Font: `text-sm` (14px, 400)
- Color: `text-gray-600` (light), `text-gray-400` (dark)
- Line height: `1.4`
- Max lines: `2` com ellipsis

**Badge**:
- Position: `absolute top-24px right-24px`
- Padding: `4px 12px`
- Border radius: `12px`
- Font: `text-xs font-semibold` (12px, 600)
- Variações: alert, warning, success, info, neutral

### 2. Card Body

**Estrutura**:
```html
<div class="card-body">
  <div class="card-stats">
    <div class="stat-item">
      <span class="stat-label">Emitidas este mês</span>
      <span class="stat-value">156</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Faturamento</span>
      <span class="stat-value">R$ 245.000</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Última emissão</span>
      <span class="stat-value">22/05 10:30</span>
    </div>
  </div>
  
  <div class="card-progress" aria-label="Meta mensal 80%">
    <div class="progress-bar">
      <div class="progress-fill" style="width: 80%"></div>
    </div>
    <span class="progress-label">80% da meta</span>
  </div>
</div>
```

**Stat Item**:
```css
.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.stat-label {
  font-size: 0.875rem; /* 14px */
  color: var(--text-secondary);
  font-weight: 400;
}

.stat-value {
  font-size: 1rem; /* 16px */
  color: var(--text-primary);
  font-weight: 600;
}
```

**Progress Bar**:
```css
.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-500), var(--primary-600));
  border-radius: 4px;
  transition: width 500ms ease-out;
}

.progress-label {
  font-size: 0.75rem; /* 12px */
  color: var(--text-secondary);
  margin-top: 4px;
  display: block;
}
```

### 3. Card Footer (Quick Actions)

**Estrutura**:
```html
<div class="card-footer">
  <button class="quick-action primary">
    <svg><!-- Lucide Icon --></svg>
    <span>Criar</span>
  </button>
  <button class="quick-action secondary">
    <svg><!-- Lucide Icon --></svg>
    <span>Ver</span>
  </button>
  <button class="quick-action secondary">
    <svg><!-- Lucide Icon --></svg>
    <span>Relat</span>
  </button>
</div>
```

**Quick Action Button**:
```css
.quick-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.875rem; /* 14px */
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
}

.quick-action.primary {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-600);
}

.quick-action.primary:hover {
  background: var(--primary-600);
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.quick-action.secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.quick-action.secondary:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
}

.quick-action svg {
  width: 16px;
  height: 16px;
}
```

---

## 🎭 Estados do Card

### 1. Default (Idle)

```css
.service-card {
  border: 2px solid var(--gray-200);
  background: var(--white);
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  transform: scale(1);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Visual**:
- Border sutil cinza claro
- Shadow mínima
- Sem transformações

### 2. Hover

```css
.service-card:hover {
  border-color: var(--primary-400);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 10px 10px -5px rgba(0, 0, 0, 0.04);
  transform: translateY(-4px) scale(1.02);
  z-index: 10; /* Acima de outros cards */
}

.service-card:hover::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.05) 0%,
    rgba(99, 102, 241, 0.05) 100%
  );
  pointer-events: none;
  border-radius: 14px;
}

.service-card:hover .card-footer {
  opacity: 1;
  transform: translateY(0);
}
```

**Animação**:
- Elevação suave
- Shadow aumenta
- Border muda para cor primária
- Footer com quick actions aparece
- Overlay gradiente sutil

### 3. Focus (Keyboard)

```css
.service-card:focus-visible {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 4px var(--primary-200),
              0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transform: scale(1.02);
}

.service-card:focus-visible .card-footer {
  opacity: 1;
  transform: translateY(0);
}
```

**Características**:
- Outline ring de 4px
- Cor primária forte
- Footer sempre visível
- Acessível via Tab

### 4. Active (Click)

```css
.service-card:active {
  transform: translateY(-2px) scale(0.99);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transition: all 100ms ease;
}
```

**Feedback**:
- Pequeno "push down"
- Shadow reduzida
- Transição rápida (100ms)

### 5. Loading

```css
.service-card.loading {
  pointer-events: none;
  opacity: 0.7;
}

.service-card.loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border: 4px solid var(--gray-200);
  border-top-color: var(--primary-500);
  border-radius: 50%;
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
```

**Visual**:
- Card opaco (70%)
- Spinner centralizado
- Interações desabilitadas

### 6. Disabled

```css
.service-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(100%);
  pointer-events: none;
}

.service-card.disabled::after {
  content: 'Indisponível';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-overlay);
  color: var(--text-primary);
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
}
```

**Indicadores**:
- Grayscale 100%
- Opacidade 50%
- Label "Indisponível"
- Sem interações

### 7. Error

```css
.service-card.error {
  border-color: var(--red-400);
  background: var(--red-50);
}

.service-card.error .card-icon {
  background: var(--red-100);
  color: var(--red-700);
}
```

---

## 🏷️ Badge System

### Badge Types

#### 1. Alert Badge (Vermelho)

```css
.badge-alert {
  background: var(--red-100);
  color: var(--red-700);
  border: 1px solid var(--red-300);
}

[data-theme="dark"] .badge-alert {
  background: var(--red-900);
  color: var(--red-200);
  border-color: var(--red-700);
}
```

**Uso**: Erros, alertas críticos, vencimentos

**Exemplos**:
- "2 alertas"
- "Vencido"
- "Erro na emissão"

#### 2. Warning Badge (Amarelo)

```css
.badge-warning {
  background: var(--yellow-100);
  color: var(--yellow-800);
  border: 1px solid var(--yellow-300);
}

[data-theme="dark"] .badge-warning {
  background: var(--yellow-900);
  color: var(--yellow-200);
  border-color: var(--yellow-700);
}
```

**Uso**: Avisos, atenção necessária

**Exemplos**:
- "Vence em 3 dias"
- "Revisar"
- "Pendente aprovação"

#### 3. Success Badge (Verde)

```css
.badge-success {
  background: var(--green-100);
  color: var(--green-700);
  border: 1px solid var(--green-300);
}

[data-theme="dark"] .badge-success {
  background: var(--green-900);
  color: var(--green-200);
  border-color: var(--green-700);
}
```

**Uso**: Sucesso, completo, em dia

**Exemplos**:
- "✓ Completo"
- "Em dia"
- "Validado"

#### 4. Info Badge (Azul)

```css
.badge-info {
  background: var(--blue-100);
  color: var(--blue-700);
  border: 1px solid var(--blue-300);
}

[data-theme="dark"] .badge-info {
  background: var(--blue-900);
  color: var(--blue-200);
  border-color: var(--blue-700);
}
```

**Uso**: Informações neutras

**Exemplos**:
- "12 ativas"
- "156 registros"
- "R$ 45.000"

#### 5. Neutral Badge (Cinza)

```css
.badge-neutral {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-300);
}

[data-theme="dark"] .badge-neutral {
  background: var(--gray-800);
  color: var(--gray-300);
  border-color: var(--gray-600);
}
```

**Uso**: Status neutro

**Exemplos**:
- "Aguardando"
- "Rascunho"
- "Inativo"

### Badge Positioning

```css
.card-badge {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 5;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem; /* 12px */
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.badge svg {
  width: 14px;
  height: 14px;
}
```

### Badge com Pulse Animation

Para alertas urgentes:

```css
.badge-alert.pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
```

---

## 🎨 Category Color Coding

Cada categoria tem uma cor associada para identificação visual rápida:

### Fiscal (Azul)

```css
.card-category-fiscal {
  --category-color: var(--blue-500);
  --category-bg: var(--blue-100);
  --category-border: var(--blue-300);
}

.card-category-fiscal .card-icon {
  background: var(--blue-100);
  color: var(--blue-700);
}

.card-category-fiscal:hover {
  border-color: var(--blue-400);
}
```

### Financeiro (Verde)

```css
.card-category-financeiro {
  --category-color: var(--green-500);
  --category-bg: var(--green-100);
  --category-border: var(--green-300);
}

.card-category-financeiro .card-icon {
  background: var(--green-100);
  color: var(--green-700);
}
```

### Contábil (Roxo)

```css
.card-category-contabil {
  --category-color: var(--purple-500);
  --category-bg: var(--purple-100);
  --category-border: var(--purple-300);
}

.card-category-contabil .card-icon {
  background: var(--purple-100);
  color: var(--purple-700);
}
```

### Relatórios (Laranja)

```css
.card-category-relatorios {
  --category-color: var(--orange-500);
  --category-bg: var(--orange-100);
  --category-border: var(--orange-300);
}

.card-category-relatorios .card-icon {
  background: var(--orange-100);
  color: var(--orange-700);
}
```

### Gestão (Cinza)

```css
.card-category-gestao {
  --category-color: var(--gray-500);
  --category-bg: var(--gray-100);
  --category-border: var(--gray-300);
}

.card-category-gestao .card-icon {
  background: var(--gray-100);
  color: var(--gray-700);
}
```

### Auditoria (Vermelho)

```css
.card-category-auditoria {
  --category-color: var(--red-500);
  --category-bg: var(--red-100);
  --category-border: var(--red-300);
}

.card-category-auditoria .card-icon {
  background: var(--red-100);
  color: var(--red-700);
}
```

---

## 📋 Especificação de Cada Service Card

### 1. NFe (Fiscal)

**Card Content**:
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📄 NFe          [2 alertas]  ┃
┃ Emissão de Notas Fiscais     ┃
┃                              ┃
┃ • 156 emitidas este mês      ┃
┃ • R$ 245.000 faturamento     ┃
┃ • Última: 22/05 10:30        ┃
┃                              ┃
┃ ████████████░░░ 85%          ┃
┃                              ┃
┃ [Emitir] [Consultar] [XML]   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Stats**:
- Total emitidas no mês
- Faturamento total (soma dos valores)
- Data/hora última emissão
- Progress: Meta mensal de emissões

**Quick Actions**:
1. **Emitir**: Abre formulário de nova NFe
2. **Consultar**: Lista de NFes emitidas
3. **XML**: Download de XMLs em lote

**Badge Logic**:
- Alert (vermelho): NFes com erro na SEFAZ
- Warning (amarelo): NFes pendentes de envio
- Success (verde): Todas ok

### 2. SPED Fiscal (Fiscal)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📑 SPED         [✓ Ok]       ┃
┃ Geração de Arquivos          ┃
┃                              ┃
┃ • Abril/2026: Gerado         ┃
┃ • 12.456 registros           ┃
┃ • Validado em 20/05          ┃
┃                              ┃
┃ ████████████████ 100%        ┃
┃                              ┃
┃ [Gerar] [Validar] [Download] ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Stats**:
- Último mês gerado
- Total de registros
- Data de validação
- Progress: Status do mês atual

**Quick Actions**:
1. **Gerar**: Criar arquivo SPED do mês
2. **Validar**: Validar via PVA
3. **Download**: Baixar arquivo .txt

### 3. DAS (Fiscal)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 💰 DAS        [Vence 3d]     ┃
┃ Apuração Simples Nacional    ┃
┃                              ┃
┃ • Maio/2026: R$ 8.450        ┃
┃ • Vencimento: 25/05          ┃
┃ • Alíquota: 6,8%             ┃
┃                              ┃
┃ [Código: Não gerado]         ┃
┃                              ┃
┃ [Apurar] [Gerar] [Imprimir]  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Stats**:
- Valor calculado do mês
- Data de vencimento
- Alíquota efetiva
- Status: Código gerado ou não

**Quick Actions**:
1. **Apurar**: Calcular DAS do mês
2. **Gerar**: Gerar código de pagamento
3. **Imprimir**: PDF do boleto

**Badge Logic**:
- Alert (vermelho): Vencido
- Warning (amarelo): Vence em ≤7 dias
- Success (verde): Pago

### 4. Contas a Receber (Financeiro)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 💳 Receber    [R$ 45k]       ┃
┃ Controle de Recebimentos     ┃
┃                              ┃
┃ • 23 títulos em aberto       ┃
┃ • R$ 45.000 a receber        ┃
┃ • 3 vencidos (R$ 8.200)      ┃
┃                              ┃
┃ Próximo: Cliente ABC - 24/05 ┃
┃                              ┃
┃ [Lançar] [Receber] [Relat]   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Stats**:
- Quantidade de títulos abertos
- Valor total a receber
- Títulos vencidos (quantidade + valor)
- Próximo vencimento

**Quick Actions**:
1. **Lançar**: Novo título a receber
2. **Receber**: Registrar pagamento recebido
3. **Relat**: Relatório de recebimentos

**Badge Logic**:
- Info (azul): Total a receber
- Alert (vermelho): Se houver vencidos

### 5. Contas a Pagar (Financeiro)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 💸 Pagar      [R$ 23k]       ┃
┃ Gestão de Pagamentos         ┃
┃                              ┃
┃ • 15 títulos em aberto       ┃
┃ • R$ 23.000 a pagar          ┃
┃ • 1 vencido (R$ 1.500)       ┃
┃                              ┃
┃ Próximo: Fornec XYZ - 23/05  ┃
┃                              ┃
┃ [Lançar] [Pagar] [Relat]     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### 6. Fluxo de Caixa (Financeiro)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📈 Fluxo      [+R$ 22k]      ┃
┃ Projeção Financeira          ┃
┃                              ┃
┃ • Saldo atual: R$ 67.000     ┃
┃ • A receber: R$ 45.000       ┃
┃ • A pagar: R$ 23.000         ┃
┃                              ┃
┃ Projeção 30d: +R$ 22.000     ┃
┃                              ┃
┃ [Ver] [Projetar] [Exportar]  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Stats**:
- Saldo bancário atual
- Total a receber
- Total a pagar
- Projeção líquida 30 dias

**Badge Logic**:
- Success (verde): Projeção positiva
- Alert (vermelho): Projeção negativa

### 7. Lançamentos (Contábil)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ✍️ Lançamentos [12 este mês] ┃
┃ Registro de Transações       ┃
┃                              ┃
┃ • 12 lançamentos em maio     ┃
┃ • Último: 22/05 14:30        ┃
┃ • Total: R$ 156.000          ┃
┃                              ┃
┃ [Ver últimos 10]             ┃
┃                              ┃
┃ [Novo] [Buscar] [Importar]   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### 8. Plano de Contas (Contábil)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📋 Plano      [142 contas]   ┃
┃ Estrutura Contábil           ┃
┃                              ┃
┃ • 142 contas cadastradas     ┃
┃ • 45 sintéticas, 97 analít   ┃
┃ • Última edição: 10/05       ┃
┃                              ┃
┃ [Estrutura padrão BR]        ┃
┃                              ┃
┃ [Ver] [Editar] [Exportar]    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### 9. Balanço Patrimonial (Relatórios)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚖️ Balanço    [Abril/2026]   ┃
┃ Ativo, Passivo e PL          ┃
┃                              ┃
┃ • Ativo: R$ 856.000          ┃
┃ • Passivo: R$ 423.000        ┃
┃ • PL: R$ 433.000             ┃
┃                              ┃
┃ Saldo: ✓ Equilibrado         ┃
┃                              ┃
┃ [Ver] [Exportar] [Imprimir]  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### 10. DRE (Relatórios)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📊 DRE      [Lucro R$ 12k]   ┃
┃ Demonstração de Resultados   ┃
┃                              ┃
┃ • Receitas: R$ 245.000       ┃
┃ • Despesas: R$ 233.000       ┃
┃ • Lucro líquido: R$ 12.000   ┃
┃                              ┃
┃ Margem: 4,9%                 ┃
┃                              ┃
┃ [Ver] [Exportar] [Comparar]  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### 11. Empresas (Gestão)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🏢 Empresas   [12 ativas]    ┃
┃ Cadastro de Empresas         ┃
┃                              ┃
┃ • 12 empresas ativas         ┃
┃ • 8 Simples Nacional         ┃
┃ • 4 Lucro Presumido          ┃
┃                              ┃
┃ Última adição: 15/05         ┃
┃                              ┃
┃ [Cadastrar] [Listar] [Editar]┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### 12. Auditoria (Segurança)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📜 Auditoria [1.234 eventos] ┃
┃ Logs e Histórico             ┃
┃                              ┃
┃ • 1.234 eventos registrados  ┃
┃ • Último: Login João (ago)   ┃
┃ • 0 alertas de segurança     ┃
┃                              ┃
┃ [Integridade: 100%]          ┃
┃                              ┃
┃ [Ver Logs] [Filtrar] [Hash]  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## 📱 Mobile Card Layout

No mobile, cards mudam para layout horizontal compacto:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ┌────┐  NFe                    [2 alertas]  ┃
┃ │ 📄 │  Emissão de Notas                     ┃
┃ └────┘  156 emitidas • R$ 245k               ┃
┃         [Emitir] [Ver]                   →   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Mobile CSS**:
```css
@media (max-width: 767px) {
  .service-card {
    flex-direction: row;
    align-items: center;
    padding: 16px;
    min-height: 100px;
    gap: 16px;
  }
  
  .card-icon {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }
  
  .card-body {
    flex: 1;
    gap: 8px;
  }
  
  .card-footer {
    opacity: 1; /* Sempre visível no mobile */
    transform: none;
    flex-direction: column;
    gap: 4px;
  }
  
  .quick-action {
    padding: 8px;
    font-size: 0.75rem;
  }
  
  .stat-item {
    font-size: 0.75rem;
  }
}
```

---

## ♿ Acessibilidade de Cards

### Semantic HTML

```html
<article 
  class="service-card card-category-fiscal"
  role="button"
  tabindex="0"
  aria-label="NFe - Emissão de Notas Fiscais. 2 alertas pendentes. 156 notas emitidas este mês."
  aria-describedby="nfe-stats"
  data-service="nfe"
>
  <div class="card-header">
    <div class="card-title-group">
      <div class="card-icon" aria-hidden="true">📄</div>
      <div>
        <h3 class="card-title">NFe</h3>
        <p class="card-subtitle">Emissão de Notas Fiscais</p>
      </div>
    </div>
    <span class="badge badge-alert" role="status">
      <span aria-hidden="true">⚠️</span>
      <span>2 alertas</span>
    </span>
  </div>
  
  <div class="card-body" id="nfe-stats">
    <div class="stat-item">
      <span class="stat-label">Emitidas este mês</span>
      <span class="stat-value">156</span>
    </div>
    <!-- Mais stats -->
  </div>
  
  <div class="card-footer">
    <button class="quick-action primary" aria-label="Emitir nova NFe">
      <svg aria-hidden="true">...</svg>
      <span>Emitir</span>
    </button>
    <!-- Mais actions -->
  </div>
</article>
```

### Keyboard Support

**Tab Navigation**:
- Cards são focáveis via `tabindex="0"`
- Quick actions são botões nativos (focáveis)
- Ordem lógica de tab: header → stats → actions

**Enter/Space**:
- Ativa o card (abre modal de onboarding)
- Dentro do card, ativa quick action focada

**Arrow Keys** (dentro do footer):
- `→`: Próxima quick action
- `←`: Quick action anterior

### Screen Reader Announcements

```javascript
// Ao carregar dados do card
const cardElement = document.querySelector('[data-service="nfe"]');
const statsContainer = cardElement.querySelector('.card-body');

// Update aria-live region
statsContainer.setAttribute('aria-live', 'polite');
statsContainer.setAttribute('aria-atomic', 'true');

// Screen reader anuncia: "156 notas emitidas este mês. R$ 245 mil faturados. Última emissão em 22 de maio às 10:30."
```

---

## 🎨 Theme Support (Light/Dark)

### Light Theme

```css
:root {
  --card-bg: #ffffff;
  --card-border: #e5e7eb;
  --card-shadow: rgba(0, 0, 0, 0.1);
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --border-subtle: #f3f4f6;
}

.service-card {
  background: var(--card-bg);
  border-color: var(--card-border);
  color: var(--text-primary);
}
```

### Dark Theme

```css
[data-theme="dark"] {
  --card-bg: #1f2937;
  --card-border: #374151;
  --card-shadow: rgba(0, 0, 0, 0.3);
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --border-subtle: #374151;
}

[data-theme="dark"] .service-card {
  background: var(--card-bg);
  border-color: var(--card-border);
  box-shadow: 0 1px 3px 0 var(--card-shadow);
}

[data-theme="dark"] .service-card:hover {
  border-color: var(--primary-500);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
}
```

---

## 📋 Component Checklist

### Implementação de Card

- [ ] Estrutura HTML semântica
- [ ] CSS com variáveis CSS
- [ ] Estados: default, hover, focus, active, loading, disabled, error
- [ ] Badge system com 5 tipos
- [ ] Quick actions com hover
- [ ] Category color coding
- [ ] Responsive (desktop/tablet/mobile)
- [ ] Animações de entrada e hover
- [ ] Theme support (light/dark)
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] ARIA labels e roles
- [ ] Focus indicators
- [ ] Color contrast AA compliant

---

**ArchitectUX**: Service Card Specification Complete  
**Next**: `ONBOARDING-FLOW.md` para modal explicativo  
**Developer Ready**: Implementação com todos os estados e variações
