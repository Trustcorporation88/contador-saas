export type ServiceOperationalStatus = "operacional" | "hibrido" | "simulado";

export interface ServiceDefinition {
  title: string;
  path: string;
  category: "core" | "relatorio" | "inteligencia" | "config";
  status: ServiceOperationalStatus;
  summary: string;
  howItWorks: string;
  requiredData: string[];
  bestResultsTips: string[];
  dataSources: string[];
  backendRoutes?: string[];
  notes?: string[];
}

export const serviceCatalog: ServiceDefinition[] = [
  {
    title: "Dashboard",
    path: "/dashboard",
    category: "core",
    status: "operacional",
    summary:
      "Visao executiva consolidada da empresa com KPIs contabeis e financeiros.",
    howItWorks:
      "Utiliza os dados da empresa ativa, balanco patrimonial, DRE do periodo e ultimos lancamentos para exibir a saude geral da operacao.",
    requiredData: [
      "Empresa cadastrada e selecionada",
      "Plano de contas estruturado",
      "Lancamentos contabeis consistentes no periodo",
      "Receitas, despesas e saldos patrimoniais atualizados",
    ],
    bestResultsTips: [
      "Mantenha os lancamentos do mes atual postados",
      "Revise classificacao das contas para evitar KPIs distorcidos",
      "Feche o periodo antes de usar o dashboard como base executiva",
    ],
    dataSources: ["Companies API", "Reports API", "Journal Entries API"],
    backendRoutes: [
      "/companies/:id",
      "/companies/:id/reports/balance-sheet",
      "/companies/:id/reports/income-statement",
      "/companies/:id/journal-entries",
    ],
  },
  {
    title: "Cliente",
    path: "/cliente",
    category: "core",
    status: "operacional",
    summary:
      "Resumo mensal e anual orientado ao cliente com foco em resultado, caixa e pendencias.",
    howItWorks:
      "Consolida indicadores financeiros e comparativos do periodo para apresentacao executiva.",
    requiredData: [
      "Receitas e despesas lancadas no periodo",
      "Contas a receber e pagar atualizadas",
      "Apuracao de impostos executada",
    ],
    bestResultsTips: [
      "Atualize recebimentos e pagamentos antes da reuniao com o cliente",
      "Registre vencimentos corretamente para que alertas tenham valor real",
      "Use periodos fechados para comparativos mais confiaveis",
    ],
    dataSources: ["Reports API"],
    backendRoutes: [
      "/companies/:id/reports/client-summary/monthly",
      "/companies/:id/reports/client-summary/annual",
    ],
  },
  {
    title: "Empresas",
    path: "/empresas",
    category: "core",
    status: "operacional",
    summary:
      "Cadastro e manutencao de empresas, regimes tributarios e dados basicos.",
    howItWorks:
      "Gerencia entidades empresariais e controla qual contexto multiempresa esta ativo no sistema.",
    requiredData: [
      "CNPJ valido",
      "Razao social",
      "Regime tributario",
      "Exercicio fiscal",
    ],
    bestResultsTips: [
      "Preencha dados cadastrais completos",
      "Defina corretamente o regime tributario desde o inicio",
      "Mantenha uma empresa ativa por contexto operacional",
    ],
    dataSources: ["Companies API", "CNPJ API"],
    backendRoutes: ["/companies", "/companies/:id", "/cnpj/:cnpj"],
  },
  {
    title: "Plano de Contas",
    path: "/contas",
    category: "core",
    status: "operacional",
    summary: "Estrutura contabil de contas sinteticas e analiticas.",
    howItWorks:
      "Permite cadastrar, importar e organizar contas que servem de base para todos os relatorios e lancamentos.",
    requiredData: [
      "Codigo da conta",
      "Nome da conta",
      "Tipo contábil",
      "Classificacao analitica ou sintetica",
    ],
    bestResultsTips: [
      "Use um plano coerente com o regime da empresa",
      "Evite duplicidade de codigos",
      "Relacione tax codes quando a conta influenciar tributos",
    ],
    dataSources: ["Accounts API"],
    backendRoutes: [
      "/companies/:id/accounts",
      "/companies/:id/accounts/hierarchy",
      "/companies/:id/accounts/import-plano",
    ],
  },
  {
    title: "Lançamentos",
    path: "/lancamentos",
    category: "core",
    status: "operacional",
    summary: "Registro de partidas dobradas com trilha de auditoria.",
    howItWorks:
      "Cria, edita, posta e consulta lancamentos contabeis vinculados a contas e documentos.",
    requiredData: [
      "Data do lancamento",
      "Descricao",
      "Linhas com conta debito/credito",
      "Valores balanceados",
    ],
    bestResultsTips: [
      "Nao poste lancamentos sem documento de suporte",
      "Garanta debito = credito",
      "Use referencias consistentes para rastreabilidade",
    ],
    dataSources: ["Journal Entries API"],
    backendRoutes: [
      "/companies/:id/journal-entries",
      "/companies/:id/journal-entries/:entryId",
    ],
  },
  {
    title: "Documentos Fiscais",
    path: "/documentos",
    category: "core",
    status: "operacional",
    summary: "Cadastro e acompanhamento de documentos fiscais e comprovantes.",
    howItWorks:
      "Armazena documentos, valores, impostos e contraparte para apoiar contabilizacao e auditoria.",
    requiredData: [
      "Tipo do documento",
      "Numero",
      "Data de emissao",
      "Valor total",
      "Contraparte",
    ],
    bestResultsTips: [
      "Preencha impostos destacados",
      "Associe o documento ao fluxo correto de contas",
      "Mantenha anexos e metadata consistentes",
    ],
    dataSources: ["Documentos API"],
    backendRoutes: [
      "/documentos",
      "/documentos/:id",
      "/documentos/stats/estatisticas",
    ],
  },
  {
    title: "Contas a Receber",
    path: "/contas-receber",
    category: "core",
    status: "operacional",
    summary: "Controle de titulos a receber, vencimentos e recebimentos.",
    howItWorks:
      "Gerencia carteira de recebiveis, estatisticas e baixa financeira.",
    requiredData: [
      "Cliente",
      "Descricao do titulo",
      "Data de vencimento",
      "Valor original",
      "Status e recebimentos",
    ],
    bestResultsTips: [
      "Registre pagamentos parciais",
      "Revise titulos vencidos diariamente",
      "Padronize categorias para analise",
    ],
    dataSources: ["Contas a Receber API"],
    backendRoutes: [
      "/contas-receber",
      "/contas-receber/:id",
      "/contas-receber/stats/estatisticas",
    ],
  },
  {
    title: "Contas a Pagar",
    path: "/contas-pagar",
    category: "core",
    status: "operacional",
    summary:
      "Controle de obrigacoes, vencimentos e pagamentos a fornecedores e tributos.",
    howItWorks:
      "Organiza compromissos a pagar, pagamentos parciais e previsao de caixa.",
    requiredData: [
      "Fornecedor ou orgao",
      "Descricao",
      "Data de vencimento",
      "Valor original",
      "Status e pagamentos",
    ],
    bestResultsTips: [
      "Classifique corretamente impostos versus fornecedores",
      "Use datas reais de liquidacao",
      "Concilie o saldo em aberto com o financeiro",
    ],
    dataSources: ["Contas a Pagar API"],
    backendRoutes: [
      "/contas-pagar",
      "/contas-pagar/:id",
      "/contas-pagar/stats/estatisticas",
    ],
  },
  {
    title: "Fluxo de Caixa",
    path: "/relatorios/fluxo-caixa",
    category: "relatorio",
    status: "operacional",
    summary: "Relatorio de entradas, saidas e saldo projetado ou realizado.",
    howItWorks:
      "Consolida resumo executivo e serie historica mensal para visualizacao de caixa.",
    requiredData: [
      "Receitas reconhecidas",
      "Despesas reconhecidas",
      "Contas a receber e pagar atualizadas",
    ],
    bestResultsTips: [
      "Mantenha periodos alinhados",
      "Atualize vencimentos e baixas",
      "Use historico minimo de 6 meses para leitura gerencial",
    ],
    dataSources: ["Reports API"],
    backendRoutes: [
      "/companies/:id/reports/executive-summary",
      "/companies/:id/reports/cash-flow-summary",
    ],
  },
  {
    title: "Balanço Patrimonial",
    path: "/relatorios/balanco",
    category: "relatorio",
    status: "operacional",
    summary: "Posicao patrimonial consolidada por data de referencia.",
    howItWorks:
      "Agrupa contas patrimoniais em ativo, passivo e patrimonio liquido.",
    requiredData: [
      "Plano de contas patrimonial",
      "Lancamentos patrimoniais postados",
      "Data de referencia",
    ],
    bestResultsTips: [
      "Garanta classificacao correta das contas",
      "Nao use periodo sem conciliacao",
      "Valide se ativo = passivo + PL",
    ],
    dataSources: ["Reports API"],
    backendRoutes: ["/companies/:id/reports/balance-sheet"],
  },
  {
    title: "DRE",
    path: "/relatorios/dre",
    category: "relatorio",
    status: "operacional",
    summary: "Demonstracao do resultado do exercicio por periodo.",
    howItWorks:
      "Consolida receitas, deducoes, custos, despesas e lucro liquido.",
    requiredData: [
      "Receitas classificadas",
      "Custos e despesas classificadas",
      "Periodo inicial e final",
    ],
    bestResultsTips: [
      "Classifique custos separadamente de despesas",
      "Use datas dentro do periodo fiscal correto",
      "Compare com periodos equivalentes",
    ],
    dataSources: ["Reports API"],
    backendRoutes: ["/companies/:id/reports/income-statement"],
  },
  {
    title: "Outros Relatórios",
    path: "/relatorios/outros",
    category: "relatorio",
    status: "operacional",
    summary: "Balancete, razao e exportacoes auxiliares para controle tecnico.",
    howItWorks: "Exibe relatorios auxiliares por conta, periodo e exportacao.",
    requiredData: [
      "Lancamentos postados",
      "Contas validas",
      "Periodo e conta quando aplicavel",
    ],
    bestResultsTips: [
      "Use filtro de conta para auditoria pontual",
      "Valide divergencias no balancete antes do fechamento",
      "Exporte so apos revisao",
    ],
    dataSources: ["Reports API"],
    backendRoutes: [
      "/companies/:id/reports/trial-balance",
      "/companies/:id/reports/ledger/:accountId",
    ],
  },
  {
    title: "Apuração de Impostos",
    path: "/impostos",
    category: "core",
    status: "operacional",
    summary:
      "Calculo e registro de apuracoes tributarias por regime e periodo.",
    howItWorks:
      "Calcula tributos e permite salvar apuracoes e status de aprovacao.",
    requiredData: [
      "Regime tributario correto",
      "Receita do periodo",
      "Base tributavel e aliquotas aplicaveis",
      "Periodo de apuracao",
    ],
    bestResultsTips: [
      "Confirme o regime antes de calcular",
      "Revise bases de calculo e excecoes",
      "Aprove a apuracao somente apos fechamento",
    ],
    dataSources: ["Taxes API"],
    backendRoutes: [
      "/companies/:id/taxes/calculate",
      "/companies/:id/taxes/appraisal",
    ],
  },
  {
    title: "Auditoria & Logs",
    path: "/auditoria",
    category: "core",
    status: "operacional",
    summary: "Rastreamento de eventos, alteracoes e acessos na operacao.",
    howItWorks:
      "Consulta logs de auditoria e estatisticas de eventos relevantes.",
    requiredData: [
      "Usuarios autenticados",
      "Eventos de escrita e acesso",
      "Filtros de periodo ou tipo quando necessario",
    ],
    bestResultsTips: [
      "Use filtros por acao e entidade",
      "Analise falhas de acesso semanalmente",
      "Concilie eventos criticos com processos internos",
    ],
    dataSources: ["Audit API"],
    backendRoutes: ["/audit/stats", "/audit/logs", "/audit/access"],
  },
  {
    title: "Saúde Financeira",
    path: "/saude",
    category: "inteligencia",
    status: "hibrido",
    summary:
      "Score de saude financeira calculado no frontend sobre dados contabeis.",
    howItWorks:
      "Usa balanco e DRE reais para calcular liquidez, rentabilidade, endividamento e eficiencia.",
    requiredData: [
      "Balanco patrimonial valido",
      "DRE do periodo",
      "Contas patrimoniais e de resultado bem classificadas",
    ],
    bestResultsTips: [
      "Feche o mes antes de ler o score",
      "Corrija classificacoes erradas de receita e passivo",
      "Use como sinal gerencial, nao como parecer isolado",
    ],
    dataSources: ["Reports API + calculo local"],
    backendRoutes: [
      "/companies/:id/reports/balance-sheet",
      "/companies/:id/reports/income-statement",
    ],
    notes: ["A logica do score e local no frontend."],
  },
  {
    title: "Simulador Fiscal",
    path: "/simulador",
    category: "inteligencia",
    status: "hibrido",
    summary: "Simulador de cenarios tributarios para comparar regimes.",
    howItWorks:
      "Calcula localmente cenarios com base nas entradas fornecidas pelo usuario.",
    requiredData: [
      "Receita mensal ou anual",
      "Margem estimada",
      "Folha ou despesas relevantes",
      "Tipo de atividade",
    ],
    bestResultsTips: [
      "Use dados anualizados sempre que possivel",
      "Informe margem realista",
      "Compare com a apuracao efetiva da empresa",
    ],
    dataSources: ["Calculo local orientado por parametros do usuario"],
    notes: ["Nao depende de backend para o calculo principal."],
  },
  {
    title: "Benchmark Setorial",
    path: "/benchmark",
    category: "inteligencia",
    status: "hibrido",
    summary: "Comparacao da empresa com referencias setoriais parametrizadas.",
    howItWorks:
      "Compara indicadores reais da empresa com medias setoriais estaticas cadastradas no frontend.",
    requiredData: [
      "Balanco e DRE reais",
      "Escolha do setor ou CNAE aproximado",
    ],
    bestResultsTips: [
      "Escolha o setor mais proximo da realidade da empresa",
      "Use para referencia, nao como laudo de mercado",
      "Atualize a base setorial quando houver fonte melhor",
    ],
    dataSources: ["Reports API + tabela estatica de setor"],
    notes: ["A media de mercado ainda e estatica, nao uma base viva."],
  },
  {
    title: "Risco Fiscal SPED",
    path: "/risco-fiscal",
    category: "inteligencia",
    status: "hibrido",
    summary:
      "Leitura de sinais de risco fiscal com base em regras heuristicas.",
    howItWorks:
      "Aplica regras locais sobre balanco e DRE para sinalizar inconsistencias e alertas fiscais.",
    requiredData: [
      "Balanco patrimonial",
      "DRE",
      "Impostos calculados",
      "Classificacao contábil coerente",
    ],
    bestResultsTips: [
      "Nao use como substituto de revisao tecnica",
      "Corrija classificacoes antes de interpretar riscos",
      "Combine com auditoria e apuracao fiscal",
    ],
    dataSources: ["Reports API + regras locais"],
    notes: ["Motor de risco ainda baseado em heuristicas do frontend."],
  },
  {
    title: "Open Finance",
    path: "/open-finance",
    category: "inteligencia",
    status: "simulado",
    summary: "Visao de conciliacao bancaria e sugestoes de lancamento.",
    howItWorks:
      "Hoje usa feed bancario mockado no frontend para demonstrar a experiencia.",
    requiredData: [
      "Extrato bancario estruturado",
      "Descricao da transacao",
      "Valor",
      "Data",
      "Conta bancária vinculada",
    ],
    bestResultsTips: [
      "Idealmente importar OFX, CSV ou conexao Open Finance real",
      "Mapear regras de categorizacao",
      "Conciliar diariamente",
    ],
    dataSources: ["Mock feed local"],
    notes: [
      "Ainda nao ha conector real de instituicao financeira no frontend atual.",
    ],
  },
  {
    title: "Copiloto IA",
    path: "/copiloto",
    category: "inteligencia",
    status: "hibrido",
    summary:
      "Assistente de interpretacao financeira com motor local e opcao de IA remota.",
    howItWorks:
      "Consulta status do backend e responde via IA remota quando disponivel, com fallback local.",
    requiredData: [
      "Dados contabeis da empresa",
      "Pergunta objetiva do usuario",
      "Configuração de IA se houver",
    ],
    bestResultsTips: [
      "Pergunte sobre periodos especificos",
      "Use perguntas de causa e comparacao",
      "Valide respostas com relatorios oficiais",
    ],
    dataSources: ["Copiloto API + fallback local"],
    backendRoutes: ["/copiloto/status"],
    notes: ["Parte das respostas ainda pode cair no motor local."],
  },
  {
    title: "Prova Criptográfica",
    path: "/prova-hash",
    category: "inteligencia",
    status: "hibrido",
    summary: "Gera prova hash dos dados financeiros consolidados.",
    howItWorks:
      "Usa dados do frontend para produzir um hash compartilhavel sem expor detalhes financeiros.",
    requiredData: ["Balanco patrimonial", "DRE", "Contexto da empresa"],
    bestResultsTips: [
      "Gere apenas com dados fechados",
      "Armazene a referencia temporal do hash",
      "Compartilhe junto do periodo de apuracao",
    ],
    dataSources: ["Reports API + calculo local"],
    notes: ["O hash e calculado localmente no frontend."],
  },
  {
    title: "Configurações",
    path: "/configuracoes",
    category: "config",
    status: "operacional",
    summary: "Ajustes gerais de operacao e preferencias da aplicacao.",
    howItWorks: "Centraliza parametros do workspace e preferencias de uso.",
    requiredData: ["Dados administrativos e preferencias conforme o caso"],
    bestResultsTips: [
      "Revise perfis de acesso",
      "Mantenha configuracoes fiscais aderentes ao cliente",
      "Use esta area como governanca",
    ],
    dataSources: ["Configuracoes locais e APIs auxiliares"],
  },
  {
    title: "Guia Operacional",
    path: "/servicos",
    category: "config",
    status: "operacional",
    summary:
      "Mapa completo dos servicos, status operacional e dados necessarios.",
    howItWorks:
      "Exibe a matriz completa dos modulos do produto e orienta como obter o melhor resultado em cada um.",
    requiredData: ["Nenhum dado obrigatorio alem do acesso ao sistema"],
    bestResultsTips: [
      "Use esta pagina como checklist de operacao",
      "Revise primeiro os servicos em estado hibrido ou simulado",
    ],
    dataSources: ["Catalogo interno do frontend"],
  },
];

export function getServiceDefinition(
  pathname: string,
): ServiceDefinition | undefined {
  return serviceCatalog.find(
    (service) =>
      pathname === service.path || pathname.startsWith(`${service.path}/`),
  );
}

export function getOperationalStatusMeta(status: ServiceOperationalStatus) {
  if (status === "operacional") {
    return {
      label: "Operacional",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }

  if (status === "hibrido") {
    return {
      label: "Híbrido",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    };
  }

  return {
    label: "Simulado",
    cls: "bg-slate-100 text-slate-700 border-slate-200",
  };
}
