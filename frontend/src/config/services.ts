import {
  FileText,
  ScrollText,
  Calculator,
  Receipt,
  CreditCard,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Shield,
  Users,
  Building2,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  FileBarChart,
  Brain,
  LayoutDashboard,
  Search,
} from 'lucide-react';
import { Service, CategoryConfig, ServiceCategory } from '../types/service';

// Configuração de Categorias
export const CATEGORIES: Record<ServiceCategory, CategoryConfig> = {
  fiscal: {
    name: 'Fiscal',
    color: 'blue',
    icon: ScrollText,
    description: 'Gestão de obrigações fiscais e tributárias',
  },
  financeiro: {
    name: 'Financeiro',
    color: 'green',
    icon: DollarSign,
    description: 'Controle de contas, fluxo de caixa e pagamentos',
  },
  contabil: {
    name: 'Contábil',
    color: 'purple',
    icon: Calculator,
    description: 'Escrituração contábil e plano de contas',
  },
  relatorios: {
    name: 'Relatórios',
    color: 'orange',
    icon: BarChart3,
    description: 'Análises, dashboards e relatórios gerenciais',
  },
  gestao: {
    name: 'Gestão',
    color: 'gray',
    icon: Settings,
    description: 'Configurações, empresas e usuários',
  },
  auditoria: {
    name: 'Auditoria',
    color: 'red',
    icon: Shield,
    description: 'Auditoria, compliance e segurança',
  },
};

// Definição de Serviços
export const SERVICES: Service[] = [
  // ===== FISCAL =====
  {
    id: 'nfe-emission',
    title: 'Emissão de NFe',
    description: 'Emitir e gerenciar notas fiscais eletrônicas',
    icon: FileText,
    category: 'fiscal',
    route: '/documentos/nfe',
    status: 'warning',
    badge: 2,
    metrics: [
      { label: 'Emitidas este mês', value: '156' },
      { label: 'Faturamento', value: 'R$ 245.000', trend: 'up', trendValue: '+12%' },
    ],
    help: {
      summary: 'Use este serviço para registrar notas emitidas e validar dados fiscais antes da transmissão.',
      requiredInputs: ['CNPJ do emitente', 'cliente/tomador', 'itens/serviços', 'valores e tributos'],
      examples: ['NF de venda de serviço', 'NF de revenda com tributação do Simples'],
    },
  },
  {
    id: 'documento-lookup',
    title: 'Busca CNPJ/CPF',
    description: 'Consulta completa de CPF e CNPJ com auto-preenchimento cadastral',
    icon: Search,
    category: 'fiscal',
    route: '/documentos/nfe',
    externalUrl: 'https://cnpj.trustcorp.com.br',
    status: 'active',
    automated: true,
    badge: 'Novo',
    help: {
      summary: 'Consulte CPF/CNPJ para preencher automaticamente nome, endereço e dados cadastrais.',
      requiredInputs: ['CPF (11 dígitos) ou CNPJ (14 dígitos)'],
      examples: ['Consulta de destinatário para emissão NF-e', 'Validação cadastral antes de faturar'],
      automation: 'Busca automática via cnpj.trustcorp.com.br com fallback de CNPJ quando necessário.',
    },
  },
  {
    id: 'sped-fiscal',
    title: 'SPED Fiscal',
    description: 'Gerar e enviar arquivos SPED Fiscal',
    icon: ScrollText,
    category: 'fiscal',
    route: '/documentos/sped',
    status: 'active',
  },
  {
    id: 'das-apuracao',
    title: 'Apuração DAS',
    description: 'Calcular e gerar DAS do Simples Nacional',
    icon: Receipt,
    category: 'fiscal',
    route: '/impostos/das',
    status: 'warning',
    badge: 'Vence em 3 dias',
    automated: true,
    metrics: [
      { label: 'Valor estimado', value: 'R$ 8.450' },
      { label: 'Vencimento', value: '25/05/2026' },
    ],
    help: {
      summary: 'Centraliza a conferência do faturamento do mês e dispara a geração automatizada da guia DAS.',
      requiredInputs: ['receita bruta do período', 'notas fiscais emitidas', 'eventuais ajustes tributários'],
      examples: ['Receita do mês: R$ 82.500', 'Segregação por serviço e comércio'],
      automation: 'Após conferência dos dados, o sistema deve calcular, gerar a guia e alertar vencimento automaticamente.',
    },
  },
  {
    id: 'impostos-apurar',
    title: 'Apuração de Impostos',
    description: 'Calcular ICMS, PIS, COFINS e outros tributos',
    icon: Calculator,
    category: 'fiscal',
    route: '/impostos/apuracao',
  },
  {
    id: 'obrigacoes-acessorias',
    title: 'Obrigações Acessórias',
    description: 'Gerenciar DCTF, DIRF, SINTEGRA e outras',
    icon: FileCheck,
    category: 'fiscal',
    route: '/documentos/obrigacoes',
    badge: 3,
    help: {
      summary: 'Mostra as entregas mensais e anuais com checklist do que falta imputar.',
      requiredInputs: ['competência', 'dados fiscais consolidados', 'eventuais recibos/protocolos'],
      examples: ['DCTFWeb mensal', 'DEFIS anual do Simples Nacional'],
    },
  },

  // ===== FINANCEIRO =====
  {
    id: 'contas-receber',
    title: 'Contas a Receber',
    description: 'Gerenciar recebimentos e cobranças',
    icon: TrendingUp,
    category: 'financeiro',
    route: '/contas-receber',
    status: 'active',
    metrics: [
      { label: 'A receber', value: 'R$ 45.200' },
      { label: 'Vencidas', value: 'R$ 3.100', trend: 'down' },
    ],
    help: {
      summary: 'Cadastre títulos, parcelas e previsões de entrada para alimentar caixa e conciliação.',
      requiredInputs: ['cliente', 'valor', 'data de vencimento', 'categoria da receita'],
      examples: ['Mensalidade de cliente', 'Recebimento por boleto ou Pix'],
    },
  },
  {
    id: 'contas-pagar',
    title: 'Contas a Pagar',
    description: 'Gerenciar pagamentos e fornecedores',
    icon: TrendingDown,
    category: 'financeiro',
    route: '/contas-pagar',
    status: 'active',
    metrics: [
      { label: 'A pagar', value: 'R$ 23.800' },
      { label: 'Vence hoje', value: 'R$ 1.200' },
    ],
    help: {
      summary: 'Registre despesas e contas recorrentes para organizar obrigações e saídas financeiras.',
      requiredInputs: ['fornecedor', 'valor', 'vencimento', 'centro de custo'],
      examples: ['Aluguel', 'Honorários', 'Conta de software mensal'],
    },
  },
  {
    id: 'fluxo-caixa',
    title: 'Fluxo de Caixa',
    description: 'Acompanhar entradas e saídas de caixa',
    icon: ArrowUpRight,
    category: 'financeiro',
    route: '/relatorios/fluxo-caixa',
    status: 'active',
    metrics: [
      { label: 'Saldo atual', value: 'R$ 22.400', trend: 'up', trendValue: '+5%' },
    ],
  },
  {
    id: 'conciliacao-bancaria',
    title: 'Conciliação Bancária',
    description: 'Conciliar extratos com lançamentos',
    icon: CreditCard,
    category: 'financeiro',
    route: '/financeiro/conciliacao',
    badge: 'Pendente',
    automated: true,
    help: {
      summary: 'Importa extratos e sugere vínculos automáticos com receitas, despesas e transferências.',
      requiredInputs: ['conta bancária', 'período do extrato', 'regras de conciliação'],
      examples: ['Arquivo OFX', 'Integração bancária via Open Finance'],
      automation: 'Sugestões automáticas por histórico, valor, CNPJ e descrição do lançamento.',
    },
  },
  {
    id: 'cartoes-credito',
    title: 'Cartões de Crédito',
    description: 'Gerenciar faturas e lançamentos de cartões',
    icon: Wallet,
    category: 'financeiro',
    route: '/financeiro/cartoes',
  },
  {
    id: 'open-finance',
    title: 'Open Finance',
    description: 'Importar extratos bancários automaticamente',
    icon: ArrowDownRight,
    category: 'financeiro',
    route: '/open-finance',
    automated: true,
    help: {
      summary: 'Conecte as contas bancárias da empresa para sincronização contínua de saldos e movimentações.',
      requiredInputs: ['instituição financeira', 'conta autorizada', 'consentimento de acesso'],
      examples: ['Banco Inter PJ', 'Conta corrente operacional'],
      automation: 'Sincronização automática de extratos para alimentar conciliação e dashboards.',
    },
  },

  // ===== CONTÁBIL =====
  {
    id: 'lancamentos',
    title: 'Lançamentos Contábeis',
    description: 'Registrar e gerenciar partidas dobradas',
    icon: FileSpreadsheet,
    category: 'contabil',
    route: '/lancamentos',
    status: 'active',
    metrics: [
      { label: 'Lançamentos este mês', value: '342' },
    ],
  },
  {
    id: 'plano-contas',
    title: 'Plano de Contas',
    description: 'Gerenciar estrutura de contas contábeis',
    icon: LayoutDashboard,
    category: 'contabil',
    route: '/contas',
  },
  {
    id: 'balancete',
    title: 'Balancete',
    description: 'Visualizar balancete de verificação',
    icon: FileBarChart,
    category: 'contabil',
    route: '/relatorios/balancete',
  },
  {
    id: 'demonstracoes',
    title: 'Demonstrações Contábeis',
    description: 'Gerar DRE, Balanço Patrimonial e DMPL',
    icon: FileCheck,
    category: 'contabil',
    route: '/relatorios/demonstracoes',
  },

  // ===== RELATÓRIOS =====
  {
    id: 'dashboard-executivo',
    title: 'Dashboard Executivo',
    description: 'Visão executiva com KPIs principais',
    icon: PieChart,
    category: 'relatorios',
    route: '/dashboard',
  },
  {
    id: 'analise-vendas',
    title: 'Análise de Vendas',
    description: 'Relatórios de faturamento e margem',
    icon: TrendingUp,
    category: 'relatorios',
    route: '/relatorios/vendas',
  },
  {
    id: 'analise-despesas',
    title: 'Análise de Despesas',
    description: 'Relatórios de custos e despesas',
    icon: TrendingDown,
    category: 'relatorios',
    route: '/relatorios/despesas',
  },
  {
    id: 'relatorios-personalizados',
    title: 'Relatórios Personalizados',
    description: 'Criar relatórios customizados',
    icon: BarChart3,
    category: 'relatorios',
    route: '/relatorios/customizados',
  },

  // ===== GESTÃO =====
  {
    id: 'empresas',
    title: 'Empresas',
    description: 'Gerenciar empresas cadastradas',
    icon: Building2,
    category: 'gestao',
    route: '/empresas',
    metrics: [
      { label: 'Empresas ativas', value: '12' },
    ],
  },
  {
    id: 'usuarios',
    title: 'Usuários',
    description: 'Gerenciar acessos e permissões',
    icon: Users,
    category: 'gestao',
    route: '/configuracoes/usuarios',
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    description: 'Ajustes gerais do sistema',
    icon: Settings,
    category: 'gestao',
    route: '/configuracoes',
  },

  // ===== AUDITORIA =====
  {
    id: 'auditoria-logs',
    title: 'Auditoria de Logs',
    description: 'Rastrear ações e alterações no sistema',
    icon: Shield,
    category: 'auditoria',
    route: '/auditoria/logs',
  },
  {
    id: 'prova-hash',
    title: 'Prova Hash',
    description: 'Validar integridade de documentos fiscais',
    icon: FileCheck,
    category: 'auditoria',
    route: '/prova-hash',
  },
  {
    id: 'risco-fiscal',
    title: 'Risco Fiscal',
    description: 'Análise de riscos e compliance',
    icon: AlertTriangle,
    category: 'auditoria',
    route: '/risco-fiscal',
    status: 'warning',
    badge: 2,
  },
];

// Função helper para buscar serviços
export function getServicesByCategory(category: ServiceCategory): Service[] {
  return SERVICES.filter(service => service.category === category);
}

export function searchServices(query: string): Service[] {
  const lowerQuery = query.toLowerCase().trim();
  
  if (!lowerQuery) return [];
  
  return SERVICES.filter(service => 
    service.title.toLowerCase().includes(lowerQuery) ||
    service.description.toLowerCase().includes(lowerQuery)
  );
}

export function getServiceById(id: string): Service | undefined {
  return SERVICES.find(service => service.id === id);
}
