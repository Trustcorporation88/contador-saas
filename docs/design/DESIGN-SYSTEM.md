# Design System - Contador SaaS Dashboard

**Versão**: 1.0  
**Data**: 22/05/2026  
**ArchitectUX Agent**: Complete Design System Foundation  

---

## 🎨 Paleta de Cores

### Color System Architecture

O sistema usa uma paleta escalável de 50-900 para cada cor, seguindo o padrão Tailwind CSS.

### Light Theme (Tema Padrão)

#### Primary (Azul) - Ações principais

```css
:root {
  --primary-50: #eff6ff;   /* Backgrounds muito claros */
  --primary-100: #dbeafe;  /* Backgrounds claros */
  --primary-200: #bfdbfe;  /* Borders e hover states */
  --primary-300: #93c5fd;  /* Disabled states */
  --primary-400: #60a5fa;  /* Hover states de botões */
  --primary-500: #3b82f6;  /* COR PRINCIPAL - Botões, links */
  --primary-600: #2563eb;  /* Hover de primary-500 */
  --primary-700: #1d4ed8;  /* Pressed states */
  --primary-800: #1e40af;  /* Texto em backgrounds claros */
  --primary-900: #1e3a8a;  /* Texto mais escuro */
}
```

**Uso**:
- Botões primários: `bg-primary-600`, hover `bg-primary-700`
- Links: `text-primary-600`
- Badges info: `bg-primary-100 text-primary-700`

#### Secondary (Cinza) - UI Neutra

```css
:root {
  --gray-50: #f9fafb;    /* Backgrounds sutis */
  --gray-100: #f3f4f6;   /* Backgrounds de cards */
  --gray-200: #e5e7eb;   /* Borders padrão */
  --gray-300: #d1d5db;   /* Borders hover */
  --gray-400: #9ca3af;   /* Icons e placeholder */
  --gray-500: #6b7280;   /* Texto secundário */
  --gray-600: #4b5563;   /* Texto terciário */
  --gray-700: #374151;   /* Texto em backgrounds claros */
  --gray-800: #1f2937;   /* Texto principal em light theme */
  --gray-900: #111827;   /* Headings */
}
```

**Uso**:
- Background principal: `bg-white`
- Background secundário: `bg-gray-50`
- Texto principal: `text-gray-900`
- Texto secundário: `text-gray-600`
- Borders: `border-gray-200`

#### Success (Verde) - Feedback positivo

```css
:root {
  --green-50: #f0fdf4;
  --green-100: #dcfce7;
  --green-200: #bbf7d0;
  --green-300: #86efac;
  --green-400: #4ade80;
  --green-500: #22c55e;   /* COR PRINCIPAL */
  --green-600: #16a34a;
  --green-700: #15803d;
  --green-800: #166534;
  --green-900: #14532d;
}
```

**Uso**:
- Success badges: `bg-green-100 text-green-700 border-green-300`
- Success buttons: `bg-green-600 hover:bg-green-700`
- Status positivo: `text-green-600`

#### Warning (Amarelo) - Avisos

```css
:root {
  --yellow-50: #fefce8;
  --yellow-100: #fef9c3;
  --yellow-200: #fef08a;
  --yellow-300: #fde047;
  --yellow-400: #facc15;
  --yellow-500: #eab308;  /* COR PRINCIPAL */
  --yellow-600: #ca8a04;
  --yellow-700: #a16207;
  --yellow-800: #854d0e;
  --yellow-900: #713f12;
}
```

**Uso**:
- Warning badges: `bg-yellow-100 text-yellow-800 border-yellow-300`
- Alertas: `bg-yellow-50 border-yellow-200`

#### Danger (Vermelho) - Erros e alertas

```css
:root {
  --red-50: #fef2f2;
  --red-100: #fee2e2;
  --red-200: #fecaca;
  --red-300: #fca5a5;
  --red-400: #f87171;
  --red-500: #ef4444;     /* COR PRINCIPAL */
  --red-600: #dc2626;
  --red-700: #b91c1c;
  --red-800: #991b1b;
  --red-900: #7f1d1d;
}
```

**Uso**:
- Error badges: `bg-red-100 text-red-700 border-red-300`
- Danger buttons: `bg-red-600 hover:bg-red-700`
- Mensagens de erro: `text-red-600`

#### Category Colors

**Fiscal (Azul)**:
```css
:root {
  --category-fiscal-bg: var(--blue-100);
  --category-fiscal-text: var(--blue-700);
  --category-fiscal-border: var(--blue-300);
  --category-fiscal-hover: var(--blue-400);
}
```

**Financeiro (Verde)**:
```css
:root {
  --category-financeiro-bg: var(--green-100);
  --category-financeiro-text: var(--green-700);
  --category-financeiro-border: var(--green-300);
  --category-financeiro-hover: var(--green-400);
}
```

**Contábil (Roxo)**:
```css
:root {
  --purple-50: #faf5ff;
  --purple-100: #f3e8ff;
  --purple-500: #a855f7;
  --purple-600: #9333ea;
  --purple-700: #7e22ce;
  
  --category-contabil-bg: var(--purple-100);
  --category-contabil-text: var(--purple-700);
  --category-contabil-border: var(--purple-300);
  --category-contabil-hover: var(--purple-400);
}
```

**Relatórios (Laranja)**:
```css
:root {
  --orange-50: #fff7ed;
  --orange-100: #ffedd5;
  --orange-500: #f97316;
  --orange-600: #ea580c;
  --orange-700: #c2410c;
  
  --category-relatorios-bg: var(--orange-100);
  --category-relatorios-text: var(--orange-700);
  --category-relatorios-border: var(--orange-300);
  --category-relatorios-hover: var(--orange-400);
}
```

**Gestão (Cinza)**:
```css
:root {
  --category-gestao-bg: var(--gray-100);
  --category-gestao-text: var(--gray-700);
  --category-gestao-border: var(--gray-300);
  --category-gestao-hover: var(--gray-400);
}
```

**Auditoria (Vermelho escuro)**:
```css
:root {
  --category-auditoria-bg: var(--red-100);
  --category-auditoria-text: var(--red-700);
  --category-auditoria-border: var(--red-300);
  --category-auditoria-hover: var(--red-400);
}
```

### Dark Theme

```css
[data-theme="dark"] {
  /* Primary (Azul) - Mais brilhante no dark */
  --primary-50: #1e3a8a;
  --primary-100: #1e40af;
  --primary-200: #1d4ed8;
  --primary-300: #2563eb;
  --primary-400: #3b82f6;
  --primary-500: #60a5fa;  /* PRINCIPAL no dark */
  --primary-600: #93c5fd;
  --primary-700: #bfdbfe;
  --primary-800: #dbeafe;
  --primary-900: #eff6ff;
  
  /* Gray (Invertido) */
  --gray-50: #111827;     /* Background principal dark */
  --gray-100: #1f2937;    /* Background cards dark */
  --gray-200: #374151;    /* Borders dark */
  --gray-300: #4b5563;
  --gray-400: #6b7280;
  --gray-500: #9ca3af;    /* Texto secundário dark */
  --gray-600: #d1d5db;
  --gray-700: #e5e7eb;
  --gray-800: #f3f4f6;    /* Texto principal dark */
  --gray-900: #f9fafb;    /* Headings dark */
  
  /* Success (Verde) */
  --green-100: #14532d;
  --green-200: #166534;
  --green-500: #22c55e;
  --green-700: #86efac;
  
  /* Warning (Amarelo) */
  --yellow-100: #713f12;
  --yellow-200: #854d0e;
  --yellow-500: #eab308;
  --yellow-800: #fef08a;
  
  /* Danger (Vermelho) */
  --red-100: #7f1d1d;
  --red-200: #991b1b;
  --red-500: #ef4444;
  --red-700: #fca5a5;
  
  /* Categories no dark */
  --category-fiscal-bg: rgba(59, 130, 246, 0.15);
  --category-fiscal-text: #93c5fd;
  
  --category-financeiro-bg: rgba(34, 197, 94, 0.15);
  --category-financeiro-text: #86efac;
  
  --category-contabil-bg: rgba(168, 85, 247, 0.15);
  --category-contabil-text: #d8b4fe;
  
  --category-relatorios-bg: rgba(249, 115, 22, 0.15);
  --category-relatorios-text: #fdba74;
  
  --category-gestao-bg: rgba(107, 114, 128, 0.15);
  --category-gestao-text: #d1d5db;
  
  --category-auditoria-bg: rgba(239, 68, 68, 0.15);
  --category-auditoria-text: #fca5a5;
}
```

### System Theme (Auto)

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Aplica dark theme automaticamente */
    /* (copia as variáveis do [data-theme="dark"]) */
  }
}
```

### Semantic Color Tokens

```css
:root {
  /* Backgrounds */
  --bg-primary: var(--white);
  --bg-secondary: var(--gray-50);
  --bg-tertiary: var(--gray-100);
  --bg-overlay: rgba(0, 0, 0, 0.5);
  
  /* Text */
  --text-primary: var(--gray-900);
  --text-secondary: var(--gray-600);
  --text-tertiary: var(--gray-500);
  --text-disabled: var(--gray-400);
  
  /* Borders */
  --border-color: var(--gray-200);
  --border-subtle: var(--gray-100);
  --border-hover: var(--gray-300);
  --border-focus: var(--primary-500);
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

[data-theme="dark"] {
  --bg-primary: var(--gray-50); /* #111827 */
  --bg-secondary: var(--gray-100); /* #1f2937 */
  --bg-tertiary: var(--gray-200); /* #374151 */
  --bg-overlay: rgba(0, 0, 0, 0.7);
  
  --text-primary: var(--gray-900); /* #f9fafb */
  --text-secondary: var(--gray-500); /* #9ca3af */
  --text-tertiary: var(--gray-400); /* #6b7280 */
  --text-disabled: var(--gray-300);
  
  --border-color: var(--gray-200); /* #374151 */
  --border-subtle: var(--gray-100);
  --border-hover: var(--gray-300);
  
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}
```

---

## 📝 Tipografia

### Font Families

```css
:root {
  /* Sans-serif moderna para UI */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
                Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  
  /* Monospace para códigos e números */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  
  /* Opcional: Serif para conteúdo longo (relatórios) */
  --font-serif: 'Georgia', 'Times New Roman', serif;
}

body {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Type Scale

```css
:root {
  /* Font Sizes */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px - Base size */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */
  --text-5xl: 3rem;        /* 48px */
  
  /* Line Heights */
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
  
  /* Font Weights */
  --font-light: 300;
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  --font-extrabold: 800;
}
```

### Typography Classes

```css
/* Headings */
.heading-1 {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.heading-2 {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  color: var(--text-primary);
  margin-bottom: 0.875rem;
}

.heading-3 {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.heading-4 {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

/* Body Text */
.text-body {
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--text-primary);
}

.text-body-sm {
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}

.text-caption {
  font-size: var(--text-xs);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--text-tertiary);
}

/* Links */
.link {
  color: var(--primary-600);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  transition: color 150ms ease;
}

.link:hover {
  color: var(--primary-700);
  text-decoration-thickness: 2px;
}

/* Números e valores monetários */
.text-numeric {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
```

---

## 📏 Spacing System

### Spacing Scale (Base 4px)

```css
:root {
  --space-0: 0;
  --space-px: 1px;
  --space-0-5: 0.125rem;   /* 2px */
  --space-1: 0.25rem;      /* 4px */
  --space-2: 0.5rem;       /* 8px */
  --space-3: 0.75rem;      /* 12px */
  --space-4: 1rem;         /* 16px - Base */
  --space-5: 1.25rem;      /* 20px */
  --space-6: 1.5rem;       /* 24px */
  --space-8: 2rem;         /* 32px */
  --space-10: 2.5rem;      /* 40px */
  --space-12: 3rem;        /* 48px */
  --space-16: 4rem;        /* 64px */
  --space-20: 5rem;        /* 80px */
  --space-24: 6rem;        /* 96px */
  --space-32: 8rem;        /* 128px */
}
```

### Semantic Spacing

```css
:root {
  /* Component Internal Padding */
  --padding-btn-sm: var(--space-2) var(--space-3);      /* 8px 12px */
  --padding-btn: var(--space-2-5) var(--space-4);       /* 10px 16px */
  --padding-btn-lg: var(--space-3) var(--space-6);      /* 12px 24px */
  
  --padding-input: var(--space-3) var(--space-4);       /* 12px 16px */
  --padding-card: var(--space-6);                       /* 24px */
  --padding-modal: var(--space-8);                      /* 32px */
  
  /* Layout Gaps */
  --gap-xs: var(--space-1);    /* 4px */
  --gap-sm: var(--space-2);    /* 8px */
  --gap-md: var(--space-4);    /* 16px */
  --gap-lg: var(--space-6);    /* 24px */
  --gap-xl: var(--space-8);    /* 32px */
  
  /* Section Spacing */
  --section-padding-sm: var(--space-8);    /* 32px */
  --section-padding: var(--space-12);      /* 48px */
  --section-padding-lg: var(--space-16);   /* 64px */
}
```

---

## 🎯 Border Radius

```css
:root {
  --radius-none: 0;
  --radius-sm: 0.25rem;      /* 4px */
  --radius-md: 0.5rem;       /* 8px */
  --radius-lg: 0.75rem;      /* 12px */
  --radius-xl: 1rem;         /* 16px */
  --radius-2xl: 1.5rem;      /* 24px */
  --radius-full: 9999px;     /* Pill shape */
  
  /* Semantic */
  --radius-button: var(--radius-lg);      /* 12px */
  --radius-input: var(--radius-lg);       /* 12px */
  --radius-card: var(--radius-xl);        /* 16px */
  --radius-modal: var(--radius-2xl);      /* 24px */
  --radius-badge: var(--radius-full);     /* Pill */
}
```

---

## 🎭 Shadows

### Shadow Layers

```css
:root {
  /* Elevation Levels */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
               0 1px 2px 0 rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
               0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
               0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
               0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  
  /* Inner Shadow */
  --shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
  
  /* Focus Ring */
  --shadow-focus: 0 0 0 3px rgba(59, 130, 246, 0.5);
}

[data-theme="dark"] {
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  --shadow-focus: 0 0 0 3px rgba(96, 165, 250, 0.5);
}
```

---

## 🎨 Componentes Fundamentais

### Buttons

```css
/* Base Button */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--padding-btn);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  line-height: 1;
  border-radius: var(--radius-button);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 150ms ease;
  white-space: nowrap;
}

.btn:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Primary Button */
.btn-primary {
  background: var(--primary-600);
  color: white;
  border-color: var(--primary-600);
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-700);
  border-color: var(--primary-700);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

/* Secondary Button */
.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
}

/* Danger Button */
.btn-danger {
  background: var(--red-600);
  color: white;
  border-color: var(--red-600);
}

.btn-danger:hover:not(:disabled) {
  background: var(--red-700);
  border-color: var(--red-700);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  color: var(--text-primary);
  border-color: transparent;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--bg-secondary);
}

/* Button Sizes */
.btn-sm {
  padding: var(--padding-btn-sm);
  font-size: var(--text-sm);
}

.btn-lg {
  padding: var(--padding-btn-lg);
  font-size: var(--text-lg);
}

/* Icon Button */
.btn-icon {
  padding: var(--space-2);
  width: 40px;
  height: 40px;
}

.btn-icon svg {
  width: 20px;
  height: 20px;
}
```

### Inputs

```css
/* Base Input */
.input {
  width: 100%;
  padding: var(--padding-input);
  font-size: var(--text-base);
  font-family: var(--font-sans);
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-input);
  transition: all 150ms ease;
}

.input::placeholder {
  color: var(--text-disabled);
}

.input:hover:not(:disabled) {
  border-color: var(--border-hover);
}

.input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: var(--shadow-focus);
}

.input:disabled {
  background: var(--bg-secondary);
  cursor: not-allowed;
  opacity: 0.6;
}

.input.error {
  border-color: var(--red-500);
}

.input.error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.5);
}

/* Input Group (com icon) */
.input-group {
  position: relative;
}

.input-group-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}

.input-group .input {
  padding-left: 40px; /* Espaço para o ícone */
}

/* Textarea */
.textarea {
  min-height: 120px;
  resize: vertical;
}
```

### Select

```css
.select {
  appearance: none;
  width: 100%;
  padding: var(--padding-input);
  padding-right: 40px; /* Espaço para seta */
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--bg-primary);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 12px center;
  background-repeat: no-repeat;
  background-size: 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-input);
  cursor: pointer;
  transition: all 150ms ease;
}

.select:hover:not(:disabled) {
  border-color: var(--border-hover);
}

.select:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: var(--shadow-focus);
}
```

### Checkbox & Radio

```css
.checkbox,
.radio {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 150ms ease;
}

.checkbox {
  border-radius: var(--radius-sm);
}

.radio {
  border-radius: var(--radius-full);
}

.checkbox:hover,
.radio:hover {
  border-color: var(--primary-500);
}

.checkbox:checked,
.radio:checked {
  background: var(--primary-600);
  border-color: var(--primary-600);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='white' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 8l2 2 6-6'/%3E%3C/svg%3E");
  background-position: center;
  background-repeat: no-repeat;
}

.radio:checked {
  background-image: none;
  box-shadow: inset 0 0 0 4px var(--bg-primary);
}

.checkbox:focus-visible,
.radio:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

### Badge

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 4px 12px;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  line-height: 1;
  border-radius: var(--radius-badge);
  border: 1px solid transparent;
  white-space: nowrap;
}

.badge-primary {
  background: var(--primary-100);
  color: var(--primary-700);
  border-color: var(--primary-300);
}

.badge-success {
  background: var(--green-100);
  color: var(--green-700);
  border-color: var(--green-300);
}

.badge-warning {
  background: var(--yellow-100);
  color: var(--yellow-800);
  border-color: var(--yellow-300);
}

.badge-danger {
  background: var(--red-100);
  color: var(--red-700);
  border-color: var(--red-300);
}

.badge-neutral {
  background: var(--gray-100);
  color: var(--gray-700);
  border-color: var(--gray-300);
}

[data-theme="dark"] .badge-primary {
  background: rgba(59, 130, 246, 0.2);
  color: var(--primary-300);
  border-color: var(--primary-700);
}

[data-theme="dark"] .badge-success {
  background: rgba(34, 197, 94, 0.2);
  color: var(--green-300);
  border-color: var(--green-700);
}

[data-theme="dark"] .badge-warning {
  background: rgba(234, 179, 8, 0.2);
  color: var(--yellow-300);
  border-color: var(--yellow-700);
}

[data-theme="dark"] .badge-danger {
  background: rgba(239, 68, 68, 0.2);
  color: var(--red-300);
  border-color: var(--red-700);
}
```

### Card

```css
.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-card);
  padding: var(--padding-card);
  box-shadow: var(--shadow-sm);
  transition: all 200ms ease;
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.card-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.card-body {
  color: var(--text-secondary);
}

.card-footer {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}
```

### Modal

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(4px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.modal {
  position: relative;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  background: var(--bg-primary);
  border-radius: var(--radius-modal);
  box-shadow: var(--shadow-2xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6) var(--padding-modal);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.modal-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms ease;
}

.modal-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--padding-modal);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-6) var(--padding-modal);
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}
```

---

## 🎭 Iconografia

### Lucide Icons (Sistema atual)

**Tamanhos padrão**:
```css
.icon-xs { width: 12px; height: 12px; }
.icon-sm { width: 16px; height: 16px; }
.icon-md { width: 20px; height: 20px; } /* Padrão */
.icon-lg { width: 24px; height: 24px; }
.icon-xl { width: 32px; height: 32px; }
```

**Cores**:
```css
.icon-primary { color: var(--primary-600); }
.icon-secondary { color: var(--text-secondary); }
.icon-success { color: var(--green-600); }
.icon-warning { color: var(--yellow-600); }
.icon-danger { color: var(--red-600); }
```

### Ícones por Serviço

| Serviço | Lucide Icon | Emoji Fallback |
|---------|-------------|----------------|
| NFe | `FileText` | 📄 |
| SPED | `Files` | 📑 |
| DAS | `DollarSign` | 💰 |
| Apuração | `Calculator` | 🧾 |
| Receber | `CreditCard` | 💳 |
| Pagar | `Wallet` | 💸 |
| Fluxo Caixa | `TrendingUp` | 📈 |
| Conciliação | `Building` | 🏦 |
| Lançamentos | `Edit3` | ✍️ |
| Plano Contas | `List` | 📋 |
| Diário | `BookOpen` | 📖 |
| Razão | `Search` | 🔍 |
| Documentos | `Paperclip` | 📎 |
| Balanço | `Scale` | ⚖️ |
| DRE | `BarChart3` | 📊 |
| Balancete | `LineChart` | 📉 |
| DFC | `Activity` | 💹 |
| Empresas | `Building2` | 🏢 |
| Usuários | `Users` | 👥 |
| Configurações | `Settings` | ⚙️ |
| Auditoria | `FileCheck` | 📜 |
| Controle Acesso | `Lock` | 🔐 |
| Prova Hash | `Shield` | 🔏 |

---

## 📋 Utility Classes

### Display

```css
.hidden { display: none; }
.block { display: block; }
.inline-block { display: inline-block; }
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.grid { display: grid; }
```

### Flexbox

```css
.flex-row { flex-direction: row; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.items-end { align-items: flex-end; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-end { justify-content: flex-end; }
.gap-1 { gap: var(--space-1); }
.gap-2 { gap: var(--space-2); }
.gap-4 { gap: var(--space-4); }
.gap-6 { gap: var(--space-6); }
```

### Text

```css
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.font-bold { font-weight: var(--font-bold); }
.font-semibold { font-weight: var(--font-semibold); }
.font-medium { font-weight: var(--font-medium); }
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### Colors

```css
.text-primary { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.text-success { color: var(--green-600); }
.text-warning { color: var(--yellow-600); }
.text-danger { color: var(--red-600); }

.bg-primary { background-color: var(--bg-primary); }
.bg-secondary { background-color: var(--bg-secondary); }
```

---

## 📋 Implementação Checklist

### Fase 1: Core Variables
- [ ] Criar arquivo `design-system.css`
- [ ] Definir todas as color variables (light/dark)
- [ ] Definir typography scale
- [ ] Definir spacing system
- [ ] Definir border radius
- [ ] Definir shadows

### Fase 2: Component Styles
- [ ] Buttons (primary, secondary, danger, ghost)
- [ ] Inputs (text, textarea, select)
- [ ] Checkbox e Radio
- [ ] Badges (5 variantes)
- [ ] Cards
- [ ] Modals

### Fase 3: Utilities
- [ ] Display classes
- [ ] Flexbox classes
- [ ] Text classes
- [ ] Color classes
- [ ] Spacing classes

### Fase 4: Theme System
- [ ] Theme toggle component
- [ ] LocalStorage persistence
- [ ] System preference detection
- [ ] Smooth transitions entre temas

### Fase 5: Iconografia
- [ ] Integrar Lucide icons
- [ ] Definir tamanhos padrão
- [ ] Criar icon components
- [ ] Mapear ícones para cada serviço

---

**ArchitectUX**: Design System Complete  
**Next**: `RESPONSIVE-BREAKPOINTS.md` para especificações mobile  
**Developer Ready**: Sistema de design completo e escalável pronto para implementação
