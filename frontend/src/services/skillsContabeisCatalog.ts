/**
 * Catálogo educacional — Principais Indicadores e Skills (itens 1–19)
 * Conteúdo alinhado às artes didáticas enviadas (fundamentos + índices +
 * destinação de lucro + reforma CST IBS/CBS).
 */

export type SkillCategoria =
  | 'fundamentos'
  | 'demonstracoes'
  | 'patrimonio'
  | 'indices'
  | 'resultado'
  | 'reforma';

export interface SkillItem {
  numero: number;
  titulo: string;
  categoria: SkillCategoria;
  definicao: string;
  objetivo: string;
  baseLegal?: string;
  formula?: string;
  pontos: string[];
  exemplo?: string;
  lancamento?: { debito: string; credito: string; historico?: string };
}

export const SKILL_CATEGORIA_META: Record<
  SkillCategoria,
  { titulo: string; cor: string }
> = {
  fundamentos: { titulo: 'Fundamentos', cor: 'bg-amber-50 text-amber-800' },
  demonstracoes: { titulo: 'Demonstrações', cor: 'bg-sky-50 text-sky-800' },
  patrimonio: { titulo: 'Patrimônio e ativos', cor: 'bg-emerald-50 text-emerald-800' },
  indices: { titulo: 'Índices financeiros', cor: 'bg-violet-50 text-violet-800' },
  resultado: { titulo: 'Resultado e distribuição', cor: 'bg-rose-50 text-rose-800' },
  reforma: { titulo: 'Reforma tributária', cor: 'bg-teal-50 text-teal-800' },
};

/** Códigos CST IBS/CBS (nova tabela) — skill 16 */
export const CST_IBS_CBS: Array<{ codigo: string; descricao: string }> = [
  { codigo: '000', descricao: 'Tributação integral' },
  { codigo: '010', descricao: 'Tributação com alíquota uniforme' },
  { codigo: '011', descricao: 'Tributação com alíquota uniforme reduzida' },
  { codigo: '200', descricao: 'Alíquota reduzida' },
  { codigo: '210', descricao: 'Redução da base de cálculo' },
  { codigo: '220', descricao: 'Alíquota fixa' },
  { codigo: '221', descricao: 'Alíquota fixa rateada' },
  { codigo: '222', descricao: 'Redução da base de cálculo' },
  { codigo: '400', descricao: 'Isenção' },
  { codigo: '410', descricao: 'Imunidade e não incidência' },
  { codigo: '510', descricao: 'Diferimento' },
  { codigo: '550', descricao: 'Suspensão' },
  { codigo: '620', descricao: 'Tributação monofásica' },
  { codigo: '800', descricao: 'Transferência de crédito' },
  { codigo: '810', descricao: 'Ajustes' },
  { codigo: '820', descricao: 'Tributação em declaração de regime específico' },
  { codigo: '830', descricao: 'Exclusão da base de cálculo' },
];

/** 15 índices clássicos (skill 15) */
export const INDICES_CLASSICOS: Array<{ grupo: string; nome: string; formula: string }> = [
  { grupo: 'Liquidez', nome: 'Liquidez Corrente', formula: 'Ativo Circulante / Passivo Circulante' },
  { grupo: 'Liquidez', nome: 'Liquidez Seca', formula: '(Ativo Circulante − Estoques) / Passivo Circulante' },
  { grupo: 'Liquidez', nome: 'Liquidez Imediata', formula: 'Disponível / Passivo Circulante' },
  { grupo: 'Estrutura', nome: 'Endividamento Geral', formula: '(PC + PNC) / Ativo Total' },
  { grupo: 'Estrutura', nome: 'Composição do Endividamento', formula: 'Passivo Circulante / Passivo Total' },
  { grupo: 'Estrutura', nome: 'Imobilização do PL', formula: 'Ativo Não Circulante / Patrimônio Líquido' },
  { grupo: 'Rentabilidade', nome: 'Margem Líquida', formula: '(Lucro Líquido / Receita Líquida) × 100' },
  { grupo: 'Rentabilidade', nome: 'ROA', formula: '(Lucro Líquido / Ativo Total) × 100' },
  { grupo: 'Rentabilidade', nome: 'ROE', formula: '(Lucro Líquido / Patrimônio Líquido) × 100' },
  { grupo: 'Atividade', nome: 'Giro do Ativo', formula: 'Receita Líquida / Ativo Total' },
  { grupo: 'Atividade', nome: 'Giro dos Estoques', formula: 'CMV / Estoque Médio' },
  { grupo: 'Atividade', nome: 'PMR', formula: '(Clientes / Receita Bruta) × 365' },
  { grupo: 'Atividade', nome: 'PMP', formula: '(Fornecedores / Compras) × 365' },
  { grupo: 'Eficiência', nome: 'Margem Bruta', formula: '(Lucro Bruto / Receita Líquida) × 100' },
  { grupo: 'Eficiência', nome: 'Margem Operacional', formula: '(Lucro Operacional / Receita Líquida) × 100' },
];

export const SKILLS_CONTABEIS: SkillItem[] = [
  {
    numero: 1,
    titulo: 'Escrituração Contábil',
    categoria: 'fundamentos',
    definicao:
      'Registro cronológico de todas as operações financeiras e patrimoniais da empresa nos livros obrigatórios, com base em documentos fiscais e suporte.',
    objetivo: 'Transformar operações em informação útil, segura e confiável para gestão e obrigações legais.',
    baseLegal: 'Lei 6.404/76; ITG 2000 (R1)',
    pontos: [
      'Clara, completa e sem rasuras',
      'Segue princípios e normas contábeis',
      'Base das demonstrações contábeis',
      'Obrigatória para as empresas',
    ],
    exemplo: 'Documento fiscal → Lançamento → Livros → Informações confiáveis',
  },
  {
    numero: 2,
    titulo: 'Plano de Contas',
    categoria: 'fundamentos',
    definicao:
      'Lista ordenada de todas as contas usadas pela empresa para registrar suas operações contábeis.',
    objetivo: 'Padronizar e organizar os registros, facilitando coleta, classificação e análise.',
    pontos: [
      'Estrutura: grupo → subgrupo → conta → subconta',
      'Deve refletir a realidade da empresa',
      'Facilita a elaboração de relatórios',
      'Pode seguir modelos padrão ou ser customizado',
    ],
    exemplo: '1 Ativo → 1.1 Ativo Circulante → 1.1.1 Caixa → 1.1.1.01 Caixa Geral',
  },
  {
    numero: 3,
    titulo: 'Depreciação',
    categoria: 'patrimonio',
    definicao:
      'Redução do valor dos bens do ativo imobilizado pelo uso, desgaste, obsolescência ou ação da natureza.',
    objetivo: 'Alocar o custo do bem ao resultado ao longo da vida útil.',
    formula: 'Depreciação anual = (Custo − Valor residual) / Vida útil',
    pontos: [
      'Métodos: linear, decrescente, unidades produzidas',
      'Reduz o valor do ativo no balanço',
      'Impacta o resultado como despesa',
      'Segue critérios contábeis e fiscais',
    ],
    exemplo: 'Bem R$ 60.000, vida útil 5 anos, residual R$ 0 → depreciação anual R$ 12.000',
    lancamento: {
      debito: 'Despesa com Depreciação',
      credito: 'Depreciação Acumulada',
      historico: 'Apropriação da depreciação do período',
    },
  },
  {
    numero: 4,
    titulo: 'Provisão',
    categoria: 'patrimonio',
    definicao:
      'Reconhecimento contábil de obrigação provável com valor estimado, quando a data ou o montante exato ainda não são certos.',
    objetivo: 'Refletir com prudência obrigações presentes nas demonstrações.',
    baseLegal: 'CPC 25 — Provisões, Passivos Contingentes e Ativos Contingentes',
    pontos: [
      'Baseada no regime de competência',
      'Valor estimado de forma confiável',
      'Obrigação presente com saída provável de recursos',
      'Deve ser revista periodicamente',
    ],
    exemplo: 'Ação trabalhista com perda provável estimada em R$ 50.000',
    lancamento: {
      debito: 'Despesas com Provisões — R$ 50.000',
      credito: 'Provisões para Ações Trabalhistas — R$ 50.000',
    },
  },
  {
    numero: 5,
    titulo: 'DRE — Demonstração do Resultado',
    categoria: 'demonstracoes',
    definicao:
      'Demonstração que apresenta o desempenho econômico da empresa em um período, evidenciando lucro ou prejuízo.',
    objetivo: 'Avaliar eficiência operacional e capacidade de gerar resultado.',
    baseLegal: 'Lei 6.404/76 (obrigatória)',
    pontos: [
      'Demonstração dinâmica (período)',
      'Regime de competência',
      'Essencial para análise de rentabilidade',
      'Estrutura: receita → custos → despesas → lucro líquido',
    ],
    exemplo:
      'Receita bruta 200k − deduções 20k = RL 180k − custos 90k = LB 90k − desp. 30k = LO 60k ± fin. 5k = LAIR 65k − IR/CSLL 16,25k = LL 48,75k',
  },
  {
    numero: 6,
    titulo: 'Usuários da Contabilidade',
    categoria: 'fundamentos',
    definicao:
      'Pessoas físicas ou jurídicas que usam informações contábeis para tomar decisões econômicas.',
    objetivo: 'Fornecer informação útil, relevante e confiável para decisões presentes e futuras.',
    pontos: [
      'Sócios/acionistas: retorno e gestão',
      'Investidores/credores: liquidez, solvência, rentabilidade',
      'Gestores: planejamento e controle',
      'Governo: arrecadação e fiscalização',
      'Empregados/sindicatos: continuidade e direitos',
      'Clientes/fornecedores: capacidade de pagamento',
    ],
  },
  {
    numero: 7,
    titulo: 'Método das Partidas Dobradas',
    categoria: 'fundamentos',
    definicao:
      'Sistema em que toda operação é registrada com débito e crédito de igual valor.',
    objetivo: 'Garantir o equilíbrio das contas e o controle do patrimônio.',
    formula: 'Σ Débitos = Σ Créditos',
    pontos: [
      'Não há débito sem crédito correspondente',
      'Base de todas as demonstrações',
      'Permite rastreabilidade',
      'Usado por todas as entidades',
    ],
    exemplo: 'Compra de equipamento à vista R$ 10.000 → D Equipamentos / C Caixa',
  },
  {
    numero: 8,
    titulo: 'Equação Fundamental',
    categoria: 'fundamentos',
    definicao: 'Relação patrimonial que equilibra recursos e fontes de financiamento.',
    objetivo: 'Explicar a origem dos ativos (terceiros + sócios/resultados).',
    formula: 'Ativos = Passivos + Patrimônio Líquido',
    pontos: [
      'Ativos: bens e direitos (caixa, estoques, imóveis, clientes)',
      'Passivos: obrigações (fornecedores, empréstimos, impostos)',
      'PL: capital, reservas, lucros acumulados',
      'Toda operação afeta ao menos dois elementos e mantém o equilíbrio',
    ],
    exemplo: 'Ativos R$ 150.000 = Passivos R$ 60.000 + PL R$ 90.000',
  },
  {
    numero: 9,
    titulo: 'Reserva Legal',
    categoria: 'resultado',
    definicao:
      'Parcela do lucro líquido que a empresa é obrigada a destinar a reserva de capital, reforçando o patrimônio.',
    objetivo: 'Proteger o capital social e assegurar continuidade financeira.',
    baseLegal: 'Lei 6.404/76, art. 193 (S.A.; facultativa em outros tipos)',
    formula: '5% do lucro líquido até atingir 20% do capital social',
    pontos: [
      'Constituição antes de outras destinações',
      'Não distribuível a sócios (salvo absorção de prejuízos)',
      'Obrigatória até o limite de 20% do capital',
      'Ultrapassado o limite, a destinação pode cessar',
    ],
    exemplo: 'Lucro R$ 200.000 → Reserva Legal 5% = R$ 10.000 → disponível R$ 190.000',
    lancamento: {
      debito: 'Lucros/Prejuízos Acumulados',
      credito: 'Reserva Legal',
      historico: 'Constituição da Reserva Legal (5% do lucro líquido)',
    },
  },
  {
    numero: 10,
    titulo: 'Ativos Contingentes',
    categoria: 'patrimonio',
    definicao:
      'Ativos possíveis decorrentes de eventos passados, cuja existência depende de eventos futuros incertos fora do controle total da entidade.',
    objetivo: 'Dar transparência a possíveis benefícios econômicos futuros.',
    baseLegal: 'CPC 25; NBC TG Estrutura Conceitual (R2)',
    pontos: [
      'Originam-se de evento passado',
      'Dependem de evento futuro incerto',
      'Não são reconhecidos no balanço',
      'Divulgados em notas quando relevantes',
    ],
    exemplo: 'Ação judicial com chance de ganho; indenizações a receber; créditos tributários em reconhecimento',
  },
  {
    numero: 11,
    titulo: 'Amortização',
    categoria: 'patrimonio',
    definicao:
      'Redução sistemática do valor de ativos intangíveis ao longo da vida útil.',
    objetivo: 'Alocar o custo aos períodos que se beneficiam do ativo.',
    baseLegal: 'CPC 04 — Ativo Intangível',
    formula: 'Amortização = (Custo − Residual) / Vida útil',
    pontos: [
      'Métodos: linear, decrescente, unidades produzidas',
      'Exemplos: marcas, software, carteira de clientes, franchising, licenças',
      'Despesa que não gera saída de caixa',
      'Impacta resultado e balanço',
    ],
    exemplo: 'Software R$ 60.000 / 5 anos = R$ 12.000 ao ano',
    lancamento: {
      debito: 'Despesa com Amortização',
      credito: 'Amortização Acumulada',
    },
  },
  {
    numero: 12,
    titulo: 'Regime de Competência',
    categoria: 'fundamentos',
    definicao:
      'Reconhece receitas, despesas, custos e perdas no período do fato gerador, independentemente do recebimento ou pagamento.',
    objetivo: 'Apurar corretamente o resultado e evidenciar o desempenho real.',
    baseLegal: 'NBC TG Estrutura Conceitual (R2); Lei 6.404/76',
    pontos: [
      'Competência: foco em direitos e obrigações',
      'Caixa: foco no fluxo financeiro (só controle gerencial)',
      'Exigência legal: competência',
      'Fato gerador → reconhecimento → mensuração → evidenciação',
    ],
    exemplo: 'Serviço em 15/05, recebimento em 20/06 → receita reconhecida em maio',
    lancamento: {
      debito: 'Clientes a Receber — R$ 10.000',
      credito: 'Receita de Serviços — R$ 10.000',
      historico: 'Reconhecimento da receita na competência do fato gerador',
    },
  },
  {
    numero: 13,
    titulo: 'Livro Diário',
    categoria: 'fundamentos',
    definicao:
      'Livro em que todos os fatos contábeis são registrados em ordem cronológica, com débitos e créditos.',
    objetivo: 'Registrar eventos de forma completa e organizada, base das demonstrações.',
    baseLegal: 'Lei 6.404/76 art. 177; ITG 2000 (R1)',
    pontos: [
      'Registro cronológico',
      'Débito à esquerda, crédito à direita',
      'Total de débitos = total de créditos',
      'Obrigatório; sem rasuras',
      'Contém: data, histórico, contas, valores e equilíbrio',
    ],
    exemplo: '10/05 Venda à vista D Caixa / C Receita; 15/05 Compra a prazo D Estoques / C Fornecedores',
  },
  {
    numero: 14,
    titulo: 'Arrendamento Mercantil',
    categoria: 'patrimonio',
    definicao:
      'Contrato em que o arrendador cede o uso de um ativo ao arrendatário mediante pagamentos periódicos, com opção de compra ao final.',
    objetivo: 'Permitir o uso de ativos sem aquisição imediata, preservando capital de giro.',
    baseLegal: 'Lei 6.099/74; CPC 06 (R2); NBC TG 06 (R3)',
    pontos: [
      'Financeiro: transfere riscos/benefícios — ativo e passivo no balanço',
      'Operacional: não transfere — pagamentos como despesa (conforme norma aplicável)',
      'Reconhecimento: direito de uso + obrigação',
      'Pagamento: juros (despesa) + redução do passivo; depreciação do direito de uso',
    ],
    exemplo: 'Equipamento R$ 100.000, 24 meses, parcela R$ 4.600 → D Direito de Uso / C Passivo de Arrendamento',
  },
  {
    numero: 15,
    titulo: 'Índices Financeiros',
    categoria: 'indices',
    definicao:
      'Indicadores calculados a partir das demonstrações para avaliar liquidez, estrutura, rentabilidade, atividade e eficiência.',
    objetivo: 'Dar visão rápida da situação financeira e do desempenho da empresa.',
    pontos: [
      'Analisar índices em conjunto',
      'Comparar com períodos anteriores e com o setor',
      'Úteis para gestores, investidores e credores',
      'Transformam números em informação decisória',
    ],
    exemplo: 'Ver tabela dos 15 índices clássicos (liquidez, estrutura, rentabilidade, atividade, eficiência)',
  },
  {
    numero: 16,
    titulo: 'CST IBS e CBS',
    categoria: 'reforma',
    definicao:
      'Nova tabela de Códigos de Situação Tributária para IBS e CBS na Reforma Tributária (EC 132 / LC 214).',
    objetivo: 'Classificar corretamente a tributação de operações no novo modelo CBS/IBS.',
    baseLegal: 'EC 132/2023; LC 214/2025',
    pontos: [
      '000–011: tributação integral / alíquota uniforme',
      '200–222: reduções, base e alíquotas fixas',
      '400–410: isenção, imunidade e não incidência',
      '510–550: diferimento e suspensão',
      '620: monofásica; 800–830: crédito, ajustes, regimes e exclusões',
    ],
    exemplo: 'Consultar a tabela completa de CST IBS/CBS no detalhe do skill',
  },
  {
    numero: 17,
    titulo: 'Reserva Legal (aplicação)',
    categoria: 'resultado',
    definicao:
      'Aplicação prática da destinação de 5% do lucro líquido à Reserva Legal até 20% do capital social.',
    objetivo: 'Fortalecer o PL e promover estabilidade e continuidade.',
    baseLegal: 'Lei 6.404/76, art. 193',
    formula: 'Lucro Líquido × 5% (até limite de 20% do capital)',
    pontos: [
      'Antes de qualquer distribuição',
      'Só para absorver prejuízos — não para distribuir',
      'Após o limite de 20%, a constituição deixa de ser obrigatória',
    ],
    exemplo: 'Lucro R$ 100.000 → Reserva Legal R$ 5.000',
    lancamento: {
      debito: 'Lucros ou Prejuízos Acumulados — R$ 5.000',
      credito: 'Reserva Legal — R$ 5.000',
    },
  },
  {
    numero: 18,
    titulo: 'Dividendos',
    categoria: 'resultado',
    definicao:
      'Parcela do lucro líquido distribuída aos sócios/acionistas, proporcional à participação no capital.',
    objetivo: 'Remunerar investidores e compartilhar resultados positivos.',
    baseLegal: 'Lei 6.404/76 arts. 202 e 203',
    formula: 'Lucro disponível × % definido × proporção do sócio',
    pontos: [
      'Tipos: obrigatórios, mínimos e adicionais',
      'Dependem de aprovação em reunião/assembleia',
      'Podem ser em dinheiro, bens ou ações',
      'Reduzem o patrimônio líquido',
    ],
    exemplo:
      'LL R$ 500.000 − Reserva Legal 5% (25k) = 475k × 50% dividendos = 237,5k; sócio 30% → R$ 71.250',
    lancamento: {
      debito: 'Lucros/Prejuízos Acumulados',
      credito: 'Dividendos a Pagar',
      historico: 'Apropriação dos dividendos a distribuir',
    },
  },
  {
    numero: 19,
    titulo: 'Receitas Correntes',
    categoria: 'resultado',
    definicao:
      'Ingressos que aumentam o patrimônio líquido, oriundos da atividade operacional — não de investimentos ou financiamentos.',
    objetivo: 'Financiar a atividade e garantir continuidade e geração de valor.',
    pontos: [
      'Habituais: vendas, serviços, aluguéis, royalties, juros ativos',
      'Empresarial: operacionais × não operacionais',
      'Público: impostos, taxas, transferências correntes',
      'Reconhecidas quando há aumento do PL (competência)',
    ],
    exemplo: 'Vendas 80k + serviços 15k + aluguel 5k = Receitas correntes R$ 100.000',
    lancamento: {
      debito: 'Caixa / Bancos — R$ 100.000',
      credito: 'Receita de Vendas — R$ 100.000',
      historico: 'Reconhecimento de receita de vendas à vista',
    },
  },
];

export function getSkillByNumero(n: number): SkillItem | undefined {
  return SKILLS_CONTABEIS.find((s) => s.numero === n);
}
