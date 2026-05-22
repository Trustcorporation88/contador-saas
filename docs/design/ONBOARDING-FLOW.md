# Onboarding Flow - Sistema de Explicação Contextual

**Versão**: 1.0  
**Data**: 22/05/2026  
**ArchitectUX Agent**: Onboarding & Education System  

---

## 🎯 Objetivo

Criar um sistema de onboarding contextual que **explica cada serviço ao usuário** quando ele clica em um service card pela primeira vez, eliminando confusão e acelerando adoção.

### Princípios do Onboarding

1. **Just-in-Time Learning**: Educar no momento da ação, não antes
2. **Progressive Disclosure**: Mostrar apenas o necessário para começar
3. **Guided Choice**: Wizard vs. Formulário direto baseado em experiência
4. **Variable Explanation**: Explicar TODOS os inputs necessários antes de pedir
5. **Visual Examples**: Mostrar, não apenas descrever

---

## 📐 Modal de Onboarding - Estrutura

### Wireframe Desktop

```
╔══════════════════════════════════════════════════════════════╗
║  NFe - Emissão de Notas Fiscais Eletrônicas         [X]     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ TAB: [ O que é? ]  [ O que preciso? ]  [ Como usar? ]│   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║  ┌────────────────────────────────────────────────────────┐ ║
║  │                                                        │ ║
║  │  📄 O que é NFe?                                       │ ║
║  │                                                        │ ║
║  │  Nota Fiscal Eletrônica (NFe) é um documento fiscal   │ ║
║  │  digital que registra uma operação de venda de        │ ║
║  │  produtos. É obrigatória para empresas que vendem     │ ║
║  │  mercadorias.                                          │ ║
║  │                                                        │ ║
║  │  🔹 Substitui a nota fiscal em papel                  │ ║
║  │  🔹 Validade jurídica garantida pela assinatura       │ ║
║  │     digital                                            │ ║
║  │  🔹 Armazenamento obrigatório por 5 anos              │ ║
║  │  🔹 Transmitida diretamente à SEFAZ                   │ ║
║  │                                                        │ ║
║  │  [📺 Ver vídeo de 2 min]                              │ ║
║  │                                                        │ ║
║  └────────────────────────────────────────────────────────┘ ║
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ Como você prefere começar?                           │   ║
║  │                                                      │   ║
║  │  ┌────────────────────┐    ┌────────────────────┐   │   ║
║  │  │ 🧙 Wizard Guiado   │    │ 📝 Formulário      │   │   ║
║  │  │ (Recomendado para  │    │ (Para quem já      │   │   ║
║  │  │  iniciantes)       │    │  conhece NFe)      │   │   ║
║  │  │                    │    │                    │   │   ║
║  │  │  [Começar]         │    │  [Ir direto]       │   │   ║
║  │  └────────────────────┘    └────────────────────┘   │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║                               [Fechar]  [Não mostrar mais]  ║
╚══════════════════════════════════════════════════════════════╝
```

### Dimensões

- **Desktop**: `800px width × auto height` (max 90vh)
- **Tablet**: `90vw × auto height`
- **Mobile**: `100vw × 100vh` (fullscreen)

**CSS**:
```css
.onboarding-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 800px;
  max-height: 90vh;
  background: var(--bg-primary);
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  z-index: 1000;
}

@media (max-width: 1023px) {
  .onboarding-modal {
    width: 90vw;
    max-width: 600px;
  }
}

@media (max-width: 767px) {
  .onboarding-modal {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    top: 0;
    left: 0;
    transform: none;
  }
}
```

---

## 🗂️ Tab System

### Tab 1: "O que é?"

**Objetivo**: Explicar o serviço em linguagem simples

**Estrutura**:
```markdown
# [Ícone] O que é [Nome do Serviço]?

[Descrição em 2-3 frases, máximo 50 palavras]

🔹 Benefício 1
🔹 Benefício 2
🔹 Benefício 3
🔹 Benefício 4 (opcional)

[Elemento visual: ilustração, diagrama ou screenshot]

[📺 Ver vídeo explicativo de 2 min] (opcional)
```

**Exemplo - NFe**:
```
📄 O que é NFe?

Nota Fiscal Eletrônica (NFe) é um documento fiscal digital que 
registra uma operação de venda de produtos. É obrigatória para 
empresas que vendem mercadorias.

🔹 Substitui a nota fiscal em papel
🔹 Validade jurídica garantida pela assinatura digital
🔹 Armazenamento obrigatório por 5 anos
🔹 Transmitida diretamente à SEFAZ

[Diagrama: Empresa → XML → SEFAZ → Cliente]

[📺 Ver vídeo de 2 min]
```

**Exemplo - Contas a Receber**:
```
💳 O que é Contas a Receber?

Controle de todas as vendas que você fez mas ainda não recebeu 
o pagamento. Ajuda a saber quanto dinheiro vai entrar no caixa 
e quando.

🔹 Evita esquecimento de cobranças
🔹 Alerta sobre atrasos de clientes
🔹 Projeção de entrada de dinheiro
🔹 Relatórios de inadimplência

[Screenshot da tela de contas a receber]
```

### Tab 2: "O que preciso?"

**Objetivo**: Listar TODAS as informações/variáveis necessárias antes de começar

**Estrutura**:
```markdown
# 📋 O que você precisa ter em mãos?

Para usar [Nome do Serviço], você vai precisar de:

## Informações Obrigatórias
✓ [Item 1] - [Onde encontrar]
✓ [Item 2] - [Onde encontrar]
✓ [Item 3] - [Onde encontrar]

## Informações Opcionais (mas recomendadas)
○ [Item 4] - [Por que é útil]
○ [Item 5] - [Por que é útil]

## Antes de começar, certifique-se de:
□ [Pré-requisito 1]
□ [Pré-requisito 2]
□ [Pré-requisito 3]

[Botão: Tenho tudo isso] [Botão: Falta algo]
```

**Exemplo - NFe**:
```
# 📋 O que você precisa ter em mãos?

Para emitir uma NFe, você vai precisar de:

## Informações Obrigatórias

✓ **Certificado Digital A1 ou A3** 
  → Onde obter: Compre em Certisign, Serasa, etc.
  → Validade: 1 ano (A1) ou 3 anos (A3)

✓ **CNPJ da empresa** 
  → Onde encontrar: Cartão CNPJ ou portal da Receita Federal

✓ **Inscrição Estadual** 
  → Onde encontrar: Junta Comercial do seu estado

✓ **Dados do cliente (comprador)** 
  → Nome/Razão Social, CPF/CNPJ, Endereço completo

✓ **Produtos vendidos** 
  → Código, descrição, quantidade, valor unitário
  → NCM (Nomenclatura Comum do Mercosul)
  → CFOP (Código Fiscal de Operação)

## Informações Opcionais (mas recomendadas)

○ **Dados do transportador** 
  → Necessário se você for enviar a mercadoria

○ **Informações de pagamento** 
  → Forma de pagamento, parcelas, condições

## Antes de começar, certifique-se de:

□ Certificado digital está instalado e válido
□ Você tem permissão da SEFAZ para emitir NFe
□ O regime tributário da empresa está configurado
□ O plano de contas está configurado no sistema

[✓ Tenho tudo isso] [⚠️ Falta algo]
```

**Exemplo - Contas a Receber**:
```
# 📋 O que você precisa ter em mãos?

Para lançar contas a receber, você vai precisar de:

## Informações Obrigatórias

✓ **Dados do cliente** 
  → Nome/Razão Social, CPF/CNPJ

✓ **Valor a receber** 
  → Valor total ou valor de cada parcela

✓ **Data de vencimento** 
  → Quando o pagamento deve ser efetuado

✓ **Descrição da venda** 
  → O que foi vendido (resumo)

## Informações Opcionais (mas recomendadas)

○ **Número do documento** 
  → NFe, boleto, contrato, etc.

○ **Conta bancária destino** 
  → Em qual conta o dinheiro vai entrar

○ **Condições de pagamento** 
  → À vista, parcelado, cartão, etc.

## Antes de começar, certifique-se de:

□ Cliente está cadastrado no sistema
□ A venda já foi registrada (NFe ou documento)
□ Você sabe a forma de pagamento acordada

[✓ Tenho tudo isso] [⚠️ Falta algo]
```

### Tab 3: "Como usar?"

**Objetivo**: Passo a passo visual de como executar a ação principal

**Estrutura**:
```markdown
# 🚀 Como usar [Nome do Serviço]?

Siga estes passos para [ação principal]:

┌──────────────────────────────────┐
│ PASSO 1: [Título do passo]       │
│                                  │
│ [Descrição breve]                │
│ [Screenshot ou ilustração]       │
└──────────────────────────────────┘
         ↓
┌──────────────────────────────────┐
│ PASSO 2: [Título do passo]       │
│                                  │
│ [Descrição breve]                │
│ [Screenshot ou ilustração]       │
└──────────────────────────────────┘
         ↓
┌──────────────────────────────────┐
│ PASSO 3: [Título do passo]       │
│                                  │
│ [Descrição breve]                │
│ [Screenshot ou ilustração]       │
└──────────────────────────────────┘

💡 Dicas:
• [Dica 1]
• [Dica 2]
• [Dica 3]

⚠️ Cuidados:
• [Cuidado 1]
• [Cuidado 2]

[Botão: Começar agora]
```

**Exemplo - NFe**:
```
# 🚀 Como emitir uma NFe?

Siga estes 5 passos:

┌──────────────────────────────────────┐
│ PASSO 1: Selecione o destinatário   │
│                                      │
│ Escolha o cliente na lista ou       │
│ cadastre um novo cliente.            │
│                                      │
│ [Screenshot do seletor de cliente]   │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PASSO 2: Adicione os produtos        │
│                                      │
│ Informe código, quantidade e valor.  │
│ O sistema preenche NCM e CFOP auto.  │
│                                      │
│ [Screenshot da grid de produtos]     │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PASSO 3: Revise impostos calculados  │
│                                      │
│ O sistema calcula ICMS, PIS, COFINS  │
│ automaticamente. Confira os valores. │
│                                      │
│ [Screenshot da tela de impostos]     │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PASSO 4: Preencha dados de pagamento │
│                                      │
│ Forma, condições e parcelas.         │
│                                      │
│ [Screenshot de forma de pagamento]   │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PASSO 5: Assine e transmita          │
│                                      │
│ Clique em "Assinar e Enviar". A NFe  │
│ será enviada à SEFAZ.                │
│                                      │
│ [Screenshot do botão de envio]       │
└──────────────────────────────────────┘

💡 Dicas:
• Salve como rascunho se precisar pausar
• Use templates para produtos que vende sempre
• O XML fica salvo automaticamente

⚠️ Cuidados:
• Certifique-se que o certificado está válido
• Revise CNPJ do cliente (erro comum)
• Depois de autorizada, NFe não pode ser alterada (só cancelada)

[🚀 Começar a emitir NFe]
```

---

## 🎨 Design do Modal

### Header

```html
<div class="modal-header">
  <div class="modal-title-group">
    <div class="modal-icon">📄</div>
    <div>
      <h2 class="modal-title">NFe - Emissão de Notas Fiscais</h2>
      <p class="modal-subtitle">Aprenda a usar em 5 minutos</p>
    </div>
  </div>
  <button class="modal-close" aria-label="Fechar">
    <svg><!-- X icon --></svg>
  </button>
</div>
```

**CSS**:
```css
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.modal-icon {
  width: 48px;
  height: 48px;
  background: var(--category-bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.modal-title {
  font-size: 1.5rem; /* 24px */
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.modal-subtitle {
  font-size: 0.875rem; /* 14px */
  color: var(--text-secondary);
  margin: 4px 0 0 0;
}

.modal-close {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms ease;
}

.modal-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

### Tab Navigation

```html
<div class="modal-tabs">
  <button class="tab-button active" data-tab="what">
    O que é?
  </button>
  <button class="tab-button" data-tab="requirements">
    O que preciso?
  </button>
  <button class="tab-button" data-tab="howto">
    Como usar?
  </button>
</div>
```

**CSS**:
```css
.modal-tabs {
  display: flex;
  gap: 4px;
  padding: 16px 32px 0 32px;
  border-bottom: 2px solid var(--border-color);
}

.tab-button {
  flex: 1;
  padding: 12px 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9375rem; /* 15px */
  font-weight: 600;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 150ms ease;
  position: relative;
  bottom: -2px;
}

.tab-button:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.tab-button.active {
  color: var(--primary-600);
  border-bottom-color: var(--primary-600);
}
```

### Content Area

```css
.modal-body {
  padding: 32px;
  overflow-y: auto;
  max-height: calc(90vh - 240px); /* Header + Footer + Tabs */
}

.tab-content {
  display: none;
  animation: fadeIn 300ms ease;
}

.tab-content.active {
  display: block;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Footer Actions

```html
<div class="modal-footer">
  <label class="dont-show-again">
    <input type="checkbox" />
    <span>Não mostrar novamente</span>
  </label>
  
  <div class="modal-actions">
    <button class="btn-secondary">Fechar</button>
    <button class="btn-primary">Começar</button>
  </div>
</div>
```

**CSS**:
```css
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 32px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.dont-show-again {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.btn-secondary,
.btn-primary {
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
}

.btn-primary {
  background: var(--primary-600);
  border: none;
  color: white;
}

.btn-primary:hover {
  background: var(--primary-700);
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

---

## 🧙 Wizard vs. Formulário Direto

### Escolha de Modo

Após o onboarding, usuário escolhe:

```
┌─────────────────────────────────────────────────────────┐
│ Como você prefere começar?                              │
│                                                         │
│ ┌────────────────────────┐  ┌───────────────────────┐  │
│ │  🧙 Wizard Guiado      │  │  📝 Formulário        │  │
│ │                        │  │                       │  │
│ │  Ideal se é sua        │  │  Para quem já         │  │
│ │  primeira vez ou       │  │  conhece o processo   │  │
│ │  quer ajuda passo      │  │  e quer rapidez       │  │
│ │  a passo               │  │                       │  │
│ │                        │  │  Tudo em uma tela     │  │
│ │  [⭐ Recomendado]      │  │                       │  │
│ │                        │  │                       │  │
│ │  [Começar Wizard]      │  │  [Ir Direto]          │  │
│ └────────────────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Wizard Multi-Step

**Conceito**: Dividir formulário complexo em passos de 3-5 campos cada

**Progress Indicator**:
```
┌──────────────────────────────────────────────────────┐
│  Emitindo NFe: Passo 2 de 5                          │
│  ████████████░░░░░░░░░░░░░░░░░░  40%                 │
│                                                       │
│  ✓ Cliente    → Produtos    □ Impostos    □ ...      │
└──────────────────────────────────────────────────────┘
```

**Exemplo - NFe Wizard**:

**Passo 1/5 - Destinatário**:
```
┌──────────────────────────────────────────────────────┐
│ 🧙 Passo 1 de 5: Quem vai receber esta NFe?          │
├──────────────────────────────────────────────────────┤
│                                                       │
│ Cliente: [Buscar cliente existente ▼]                │
│          ou [+ Cadastrar novo cliente]               │
│                                                       │
│ ┌─ Cliente Selecionado ──────────────────────────┐   │
│ │ Nome: EMPRESA ABC LTDA                         │   │
│ │ CNPJ: 11.222.333/0001-81                       │   │
│ │ Endereço: Rua das Flores, 123 - São Paulo/SP  │   │
│ └────────────────────────────────────────────────┘   │
│                                                       │
│ 💡 Dica: Certifique-se que o CNPJ está correto.      │
│    Este é o erro mais comum na emissão de NFe.       │
│                                                       │
│                        [Cancelar]  [Próximo: Produtos]│
└──────────────────────────────────────────────────────┘
```

**Passo 2/5 - Produtos**:
```
┌──────────────────────────────────────────────────────┐
│ 🧙 Passo 2 de 5: Quais produtos estão sendo vendidos?│
├──────────────────────────────────────────────────────┤
│                                                       │
│ [+ Adicionar produto]                                │
│                                                       │
│ ┌── Produto 1 ──────────────────────────────────┐    │
│ │ Código: 001                                   │    │
│ │ Descrição: Notebook Dell Inspiron 15         │    │
│ │ NCM: 8471.30.12 (preenchido automaticamente)  │    │
│ │ Quantidade: [2]   Valor unit: [R$ 3.500,00]  │    │
│ │ Total: R$ 7.000,00                            │    │
│ │                                    [Remover]  │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ [+ Adicionar outro produto]                          │
│                                                       │
│ Subtotal: R$ 7.000,00                                │
│                                                       │
│ 💡 Dica: Use o código do produto para busca rápida.  │
│                                                       │
│                        [← Voltar]  [Próximo: Impostos]│
└──────────────────────────────────────────────────────┘
```

**Passo 3/5 - Impostos (Automático)**:
```
┌──────────────────────────────────────────────────────┐
│ 🧙 Passo 3 de 5: Revisão de impostos calculados      │
├──────────────────────────────────────────────────────┤
│                                                       │
│ Os impostos foram calculados automaticamente:        │
│                                                       │
│ ┌── Tributos Federais ──────────────────────────┐    │
│ │ PIS:     R$ 105,00  (1,5%)                    │    │
│ │ COFINS:  R$ 490,00  (7,0%)                    │    │
│ │ IPI:     R$ 0,00    (isento)                  │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌── Tributos Estaduais ──────────────────────────┐   │
│ │ ICMS:    R$ 1.260,00  (18%)                   │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ Base de cálculo: R$ 7.000,00                         │
│ Total de tributos: R$ 1.855,00                       │
│                                                       │
│ ✓ Valores corretos de acordo com regime tributário   │
│                                                       │
│ ⚠️ Atenção: Revise os valores antes de prosseguir.   │
│                                                       │
│                      [← Voltar]  [Próximo: Pagamento]│
└──────────────────────────────────────────────────────┘
```

**Passo 4/5 - Pagamento**:
```
┌──────────────────────────────────────────────────────┐
│ 🧙 Passo 4 de 5: Como será o pagamento?              │
├──────────────────────────────────────────────────────┤
│                                                       │
│ Forma de pagamento:                                  │
│ ○ À vista                                            │
│ ● Parcelado                                          │
│ ○ Cartão de crédito                                  │
│ ○ Boleto bancário                                    │
│                                                       │
│ ┌── Configuração de Parcelas ────────────────────┐   │
│ │ Número de parcelas: [3 ▼]                      │   │
│ │                                                 │   │
│ │ Parcela 1: R$ 2.333,33 - Venc: 22/05/2026      │   │
│ │ Parcela 2: R$ 2.333,33 - Venc: 22/06/2026      │   │
│ │ Parcela 3: R$ 2.333,34 - Venc: 22/07/2026      │   │
│ └─────────────────────────────────────────────────┘   │
│                                                       │
│ 💡 Dica: Parcelas são registradas automaticamente    │
│    em Contas a Receber.                              │
│                                                       │
│                      [← Voltar]  [Próximo: Revisão]  │
└──────────────────────────────────────────────────────┘
```

**Passo 5/5 - Revisão Final**:
```
┌──────────────────────────────────────────────────────┐
│ 🧙 Passo 5 de 5: Revise antes de transmitir          │
├──────────────────────────────────────────────────────┤
│                                                       │
│ ┌── Resumo da NFe ──────────────────────────────┐    │
│ │                                                │    │
│ │ Destinatário: EMPRESA ABC LTDA                 │    │
│ │ CNPJ: 11.222.333/0001-81                       │    │
│ │                                                │    │
│ │ Produtos: 1 item (2 unidades)                  │    │
│ │ Subtotal: R$ 7.000,00                          │    │
│ │ Impostos: R$ 1.855,00                          │    │
│ │ Total da NFe: R$ 7.000,00                      │    │
│ │                                                │    │
│ │ Pagamento: 3x de R$ 2.333,33                   │    │
│ │ Forma: Parcelado                               │    │
│ └────────────────────────────────────────────────┘    │
│                                                       │
│ ✓ Certificado digital válido                         │
│ ✓ Conexão com SEFAZ ok                               │
│ ✓ Todos os campos obrigatórios preenchidos           │
│                                                       │
│ ⚠️ Após transmitir, a NFe não poderá ser alterada.   │
│    Apenas cancelamento ou carta de correção.         │
│                                                       │
│ [Salvar como rascunho]  [← Voltar]  [✓ Assinar e Enviar]│
└──────────────────────────────────────────────────────┘
```

### Formulário Direto (Advanced)

**Para usuários experientes**: Tudo em uma tela

```
┌────────────────────────────────────────────────────────┐
│ Emitir NFe - Formulário Completo                      │
├────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─ Destinatário ─────────────────────────────────────┐ │
│ │ Cliente: [EMPRESA ABC LTDA        ▼]  [+ Novo]    │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Produtos ─────────────────────────────────────────┐ │
│ │ Cód  Descrição           NCM      Qtd  Unit  Total │ │
│ │ 001  Notebook Dell...    8471...  2    3500  7000  │ │
│ │ [+ Adicionar produto]                              │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Impostos (calculados) ────────────────────────────┐ │
│ │ ICMS: 1260  PIS: 105  COFINS: 490  IPI: 0         │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Pagamento ────────────────────────────────────────┐ │
│ │ Forma: [Parcelado ▼]  Parcelas: [3]               │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Observações (opcional) ───────────────────────────┐ │
│ │ [Campo de texto livre...]                          │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│         [Salvar rascunho]  [Cancelar]  [Assinar e Enviar]│
└────────────────────────────────────────────────────────┘
```

---

## 🎬 Animações e Transições

### Modal Entrance

```css
@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.onboarding-modal {
  animation: modalFadeIn 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Backdrop */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 999;
  animation: backdropFadeIn 200ms ease;
}

@keyframes backdropFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Tab Change

```css
@keyframes tabSlideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.tab-content.active {
  animation: tabSlideIn 250ms ease-out;
}
```

### Wizard Step Transition

```css
@keyframes stepSlideLeft {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes stepSlideRight {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.wizard-step.entering-next {
  animation: stepSlideLeft 300ms ease-out;
}

.wizard-step.entering-prev {
  animation: stepSlideRight 300ms ease-out;
}
```

---

## 💾 Persistência de Preferências

### LocalStorage Schema

```javascript
{
  "onboarding_preferences": {
    "nfe": {
      "completed": true,
      "dont_show_again": true,
      "preferred_mode": "wizard", // ou "direct"
      "last_seen": "2026-05-22T10:30:00Z"
    },
    "contas_receber": {
      "completed": false,
      "dont_show_again": false,
      "preferred_mode": null,
      "last_seen": null
    }
    // ... outros serviços
  }
}
```

### Logic

```javascript
function shouldShowOnboarding(serviceId) {
  const prefs = getOnboardingPreferences();
  const servicePref = prefs[serviceId];
  
  // Sempre mostrar se usuário nunca viu
  if (!servicePref || !servicePref.completed) {
    return true;
  }
  
  // Não mostrar se marcou "não mostrar novamente"
  if (servicePref.dont_show_again) {
    return false;
  }
  
  // Mostrar se passou 30 dias desde última vez
  const daysSinceLastSeen = daysBetween(
    servicePref.last_seen, 
    new Date()
  );
  
  return daysSinceLastSeen > 30;
}

function saveOnboardingComplete(serviceId, mode, dontShowAgain) {
  const prefs = getOnboardingPreferences();
  prefs[serviceId] = {
    completed: true,
    dont_show_again: dontShowAgain,
    preferred_mode: mode,
    last_seen: new Date().toISOString()
  };
  localStorage.setItem('onboarding_preferences', JSON.stringify(prefs));
}
```

---

## ♿ Acessibilidade

### ARIA Attributes

```html
<div 
  class="onboarding-modal" 
  role="dialog" 
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
  aria-modal="true"
>
  <div class="modal-header">
    <h2 id="modal-title">NFe - Emissão de Notas Fiscais</h2>
    <p id="modal-description">Aprenda a usar em 5 minutos</p>
  </div>
  
  <div class="modal-tabs" role="tablist">
    <button 
      role="tab" 
      aria-selected="true" 
      aria-controls="tab-what"
      id="tab-button-what"
    >
      O que é?
    </button>
    <!-- Outras tabs -->
  </div>
  
  <div 
    class="tab-content" 
    role="tabpanel" 
    id="tab-what"
    aria-labelledby="tab-button-what"
  >
    <!-- Content -->
  </div>
</div>
```

### Keyboard Navigation

- `Tab`: Navega entre elementos focáveis
- `Shift+Tab`: Volta
- `Esc`: Fecha modal
- `Arrow Left/Right`: Navega entre tabs (quando focus em tablist)
- `Enter` ou `Space`: Ativa botão/tab focado

### Focus Trap

```javascript
function trapFocus(modal) {
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
    
    if (e.key === 'Escape') {
      closeModal();
    }
  });
  
  // Focus no primeiro elemento ao abrir
  firstElement.focus();
}
```

---

## 📋 Template de Conteúdo

Para cada serviço, criar arquivo JSON com conteúdo:

```json
{
  "service_id": "nfe",
  "service_name": "NFe",
  "full_name": "Nota Fiscal Eletrônica",
  "icon": "📄",
  "category": "fiscal",
  
  "tabs": {
    "what": {
      "title": "O que é?",
      "content": {
        "description": "Nota Fiscal Eletrônica (NFe) é um documento fiscal digital que registra uma operação de venda de produtos. É obrigatória para empresas que vendem mercadorias.",
        "benefits": [
          "Substitui a nota fiscal em papel",
          "Validade jurídica garantida pela assinatura digital",
          "Armazenamento obrigatório por 5 anos",
          "Transmitida diretamente à SEFAZ"
        ],
        "visual_aid": "/assets/diagrams/nfe-flow.svg",
        "video_url": "https://youtube.com/watch?v=...",
        "video_duration": "2:15"
      }
    },
    
    "requirements": {
      "title": "O que preciso?",
      "mandatory": [
        {
          "item": "Certificado Digital A1 ou A3",
          "where": "Compre em Certisign, Serasa, etc.",
          "note": "Validade: 1 ano (A1) ou 3 anos (A3)"
        },
        {
          "item": "CNPJ da empresa",
          "where": "Cartão CNPJ ou portal da Receita Federal",
          "note": null
        }
        // ... mais itens
      ],
      "optional": [
        {
          "item": "Dados do transportador",
          "why": "Necessário se você for enviar a mercadoria"
        }
      ],
      "prerequisites": [
        "Certificado digital está instalado e válido",
        "Você tem permissão da SEFAZ para emitir NFe",
        "O regime tributário da empresa está configurado"
      ]
    },
    
    "howto": {
      "title": "Como usar?",
      "steps": [
        {
          "number": 1,
          "title": "Selecione o destinatário",
          "description": "Escolha o cliente na lista ou cadastre um novo cliente.",
          "screenshot": "/assets/screenshots/nfe-step1.png",
          "tips": ["Certifique-se que o CNPJ está correto"]
        }
        // ... mais passos
      ],
      "tips": [
        "Salve como rascunho se precisar pausar",
        "Use templates para produtos que vende sempre"
      ],
      "warnings": [
        "Certifique-se que o certificado está válido",
        "Depois de autorizada, NFe não pode ser alterada"
      ]
    }
  },
  
  "modes": {
    "wizard": {
      "enabled": true,
      "recommended": true,
      "steps": 5
    },
    "direct": {
      "enabled": true,
      "recommended": false
    }
  }
}
```

---

## 🚀 Fluxo Completo

```
User clica no Service Card
         ↓
Sistema verifica localStorage
         ↓
   ┌─────┴─────┐
   │           │
Não viu    Já viu + "não mostrar"
onboarding       ↓
   ↓         Abre diretamente
Abre modal   o serviço
onboarding
   ↓
User lê tabs: "O que é?", "O que preciso?", "Como usar?"
   ↓
User escolhe modo: Wizard ou Direto
   ↓
   ┌─────┴─────┐
   │           │
 Wizard      Direto
   ↓           ↓
Step 1/5    Formulário
   ↓         completo
Step 2/5
   ↓
...
   ↓
Step 5/5
   ↓
Revisão final
   ↓
   └─────┬─────┘
         ↓
   Assinar e Enviar
         ↓
   Sucesso! 🎉
         ↓
   Salva preferência (wizard/direto) para próximas vezes
```

---

## 📋 Checklist de Implementação

### Modal Base
- [ ] Estrutura HTML do modal
- [ ] Sistema de tabs funcionando
- [ ] Animações de entrada/saída
- [ ] Backdrop com blur
- [ ] Botão de fechar (X)
- [ ] Responsive (desktop/tablet/mobile)

### Tabs de Conteúdo
- [ ] Tab "O que é?" com descrição
- [ ] Tab "O que preciso?" com lista de requirements
- [ ] Tab "Como usar?" com passo a passo
- [ ] Vídeos embarcados (opcional)
- [ ] Screenshots/diagramas

### Wizard System
- [ ] Progress indicator
- [ ] Navegação entre steps (Próximo/Voltar)
- [ ] Validação de cada step
- [ ] Estado salvo (pode pausar e retomar)
- [ ] Revisão final antes de submeter

### Persistência
- [ ] LocalStorage para preferências
- [ ] Checkbox "Não mostrar novamente"
- [ ] Salvar modo preferido (wizard/direto)
- [ ] Lógica de "mostrar após 30 dias"

### Acessibilidade
- [ ] ARIA attributes corretos
- [ ] Focus trap funcionando
- [ ] Keyboard navigation completa
- [ ] Screen reader announcements
- [ ] Esc fecha modal

### Conteúdo
- [ ] Criar JSON de conteúdo para cada serviço
- [ ] Criar diagramas/ilustrações
- [ ] Gravar vídeos explicativos (opcional)
- [ ] Screenshots de cada step do wizard

---

**ArchitectUX**: Onboarding Flow Specification Complete  
**Next**: `DESIGN-SYSTEM.md` para paleta de cores e componentes  
**Developer Ready**: Sistema completo de educação contextual
