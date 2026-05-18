# 🚀 EXECUÇÃO PRIORIDADE 1: Lançamento de Documentos Fiscais

## Objetivo
Criar interface completa para registrar documentos fiscais (NFe, Boletos, Recibos) com documentação passo-a-passo

---

## BACKEND CHECKLIST

### ✅ Modelo de Documento Fiscal
```typescript
interface DocumentoFiscal {
  id: string;
  company_id: string;
  tipo: 'nfe' | 'boleto' | 'recibo' | 'cupom_fiscal';
  numero: string;
  serie: string;
  data_emissao: Date;
  data_vencimento?: Date;
  valor_total: number;
  valor_impostos?: number;
  descricao: string;
  
  // Cliente/Fornecedor
  contraparte_type: 'cliente' | 'fornecedor';
  contraparte_cnpj: string; // Auto-preenchimento via BrasilAPI
  contraparte_nome: string;
  
  // Itens do documento
  itens: Array<{
    descricao: string;
    quantidade: number;
    valor_unitario: number;
    aliquota_icms?: number;
  }>;
  
  // Status
  status: 'rascunho' | 'registrado' | 'cancelado';
  created_at: Date;
  updated_at: Date;
}
```

### ✅ Endpoints Necessários
- `POST /api/v1/documentos` - Criar novo documento
- `GET /api/v1/documentos` - Listar com filtros (período, tipo, status)
- `GET /api/v1/documentos/:id` - Ver detalhe
- `PUT /api/v1/documentos/:id` - Editar rascunho
- `DELETE /api/v1/documentos/:id` - Cancelar
- `POST /api/v1/documentos/:id/gerar-diario` - Gerar lançamento no diário automaticamente

### ✅ Validações
- [ ] Número + Série são únicos por empresa
- [ ] CNPJ válido (validar com BrasilAPI)
- [ ] Data de emissão não pode ser futura
- [ ] Valor total = soma dos itens
- [ ] Campos obrigatórios preenchidos

---

## FRONTEND CHECKLIST

### ✅ Página: `/empresas/:id/documentos`
Com tabs:
- **Lista** - Tabela de documentos registrados
- **Novo Documento** - Formulário de criação

### ✅ Componente: DocumentoForm
```
┌─────────────────────────────────────────────┐
│  NOVO LANÇAMENTO DE DOCUMENTO              │
├─────────────────────────────────────────────┤
│ Tipo de Documento *                         │
│ ☐ NFe  ☐ Boleto  ☐ Recibo  ☐ Cupom       │
│                                              │
│ Série * | Número *                         │
│ [  ]    | [          ]                      │
│                                              │
│ CLIENTE/FORNECEDOR                         │
│ CNPJ * [11.222.333/0001-81]  🔍 Buscar    │
│ Nome [___auto-preenchido___]                │
│                                              │
│ Datas                                       │
│ Emissão * [__/__/____]  Vencimento [__/__/__] │
│                                              │
│ Valores                                     │
│ Subtotal:        R$ [_______]              │
│ Impostos:        R$ [_______]              │
│ Total *:         R$ [_______] (auto)       │
│                                              │
│ ITENS DO DOCUMENTO                         │
│ ┌─────────────────────────────────────────┐│
│ │ Descrição | Qtd | Vr.Unit | Total       ││
│ │ [______] [__] [_____] [_____]           ││
│ │ + Adicionar Item                         ││
│ └─────────────────────────────────────────┘│
│                                              │
│ Observações/Notas:                         │
│ [________________________]                  │
│                                              │
│ ☐ Registrar no Diário Contábil automaticamente │
│                                              │
│         [Salvar em Rascunho]  [Registrar]  │
└─────────────────────────────────────────────┘
```

### ✅ Componente: DocumentosList
- Tabela com: Tipo | Número | Fornecedor | Data | Valor | Status | Ações
- Filtros: Período, Tipo, Status
- Ações: Ver, Editar (se rascunho), Cancelar, Gerar Diário

---

## DOCUMENTAÇÃO CHECKLIST

### 📖 Guia: "Como Lançar um Documento"
**Arquivo**: `/docs/guias/lançamento-documentos.md`

#### Seções:
1. **O que é um Documento Fiscal?**
   - Explicação simples para iniciante
   - Exemplos: NFe, Boleto, Recibo

2. **Tipos Suportados**
   - NFe: "Nota Fiscal Eletrônica"
   - Boleto: "Comprovante de cobrança"
   - Recibo: "Comprovante de pagamento"
   - Cupom: "De PDV/E-commerce"

3. **Passo a Passo Completo** (com screenshots)
   - Passo 1: Selecionar tipo
   - Passo 2: Preencher cliente/fornecedor
   - Passo 3: Adicionar itens
   - Passo 4: Verificar total
   - Passo 5: Registrar

4. **Campos Explicados**
   - O que é "Série"?
   - O que é "CNPJ do fornecedor"?
   - Como calcular impostos?

5. **Exemplos Práticos**
   - Exemplo 1: Lançar NFe de compra de matéria-prima
   - Exemplo 2: Lançar boleto de venda
   - Exemplo 3: Lançar recibo de serviço

6. **Dicas de Ouro**
   - "Sempre registre no mesmo dia"
   - "Guarde a cópia física"
   - "Valide o total antes de registrar"

7. **Erros Comuns**
   - Esquecer de registrar no diário
   - Errar CNPJ do fornecedor
   - Não colocar data correta

---

## VÍDEO CHECKLIST

### 🎬 Vídeo: "Como Lançar Seu Primeiro Documento" (1 min 30 seg)

**Roteiro**:
```
[0:00] Intro: "Vamos lançar seu primeiro documento fiscal"
[0:05] Abrir página de Documentos
[0:15] Clicar "Novo Documento"
[0:20] Selecionar tipo: NFe
[0:25] Preencher série e número
[0:35] Buscar CNPJ do fornecedor (mostra auto-preenchimento)
[0:50] Adicionar item
[1:05] Sistema calcula total automaticamente
[1:15] Clicar "Registrar"
[1:25] ✓ Sucesso! Documento criado
[1:30] "Próximo passo: Gerar diário contábil"
```

---

## ✅ CHECKLIST FINAL DE ENTREGA

- [ ] Banco de dados: Tabela `documentos_fiscais` criada
- [ ] Backend: Todos 6 endpoints funcionando
- [ ] Frontend: Form + Lista implementados
- [ ] Validações: Todas ativas
- [ ] Documentação: Guia completo com exemplos
- [ ] Vídeo: Publicado na plataforma
- [ ] Tooltips: Campos principais explicados
- [ ] Testes: Form funciona em desktop/mobile
- [ ] Feedback: Testado com 2-3 usuários reais
- [ ] GO-LIVE: Deploy para staging

---

## 📝 PRÓXIMOS PASSOS IMEDIATOS

1. **Hoje**: Criar models de backend
2. **Amanhã**: Implementar endpoints
3. **Dia 3**: Criar form no frontend
4. **Dia 4**: Documentação + Vídeo
5. **Dia 5**: Testes + Deploy

**Começamos agora?** ⏱️
