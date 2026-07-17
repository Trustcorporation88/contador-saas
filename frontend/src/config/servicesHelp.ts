/**
 * Sistema de Variáveis Explicativas e Onboarding Contextual
 * 
 * Este arquivo mapeia todos os serviços contábeis com:
 * - Descrição clara em linguagem simples
 * - Variáveis/campos necessários com exemplos
 * - Dicas práticas de uso
 * - Tempo estimado de preenchimento
 * 
 * Objetivo: Educar usuários inline, reduzir confusão e acelerar adoção
 */

// ==================== TYPES ====================

export type VariableType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'currency' | 'email' | 'phone' | 'cpf' | 'cnpj';

export interface ServiceVariable {
  name: string;
  label: string;
  description: string;
  example: string;
  required: boolean;
  type: VariableType;
  helpText: string;
  validationRules?: string[];
  options?: Array<{ value: string; label: string }>; // para selects
}

export interface ServiceHelp {
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

// ==================== SERVICE HELP DATA ====================

export const SERVICE_HELP: Record<string, ServiceHelp> = {
  // ===== FISCAL =====
  
  'nfe-emission': {
    title: 'Emissão de NFe',
    whatIs: 'Nota Fiscal Eletrônica (NFe) é um documento fiscal digital que registra uma venda de produtos. É obrigatória para empresas que vendem mercadorias e substitui a nota fiscal em papel. Tem validade jurídica garantida pela assinatura digital e é transmitida diretamente à SEFAZ.',
    whenToUse: 'Use sempre que sua empresa vender produtos para clientes (pessoa física ou jurídica). É obrigatória por lei para formalizar vendas de mercadorias. Não use para prestação de serviços (nesse caso, emita NFSe).',
    variables: [
      {
        name: 'cliente',
        label: 'Cliente (CPF/CNPJ)',
        description: 'Identificação do comprador. Pode ser CPF para pessoa física ou CNPJ para empresa.',
        example: '12.345.678/0001-90 ou 123.456.789-00',
        required: true,
        type: 'text',
        helpText: 'Digite apenas números. O sistema formata automaticamente com pontos e traços.',
        validationRules: ['Deve ser CPF ou CNPJ válido', 'Apenas números'],
      },
      {
        name: 'naturezaOperacao',
        label: 'Natureza da Operação',
        description: 'Tipo de operação que está sendo realizada. Define como a NFe será tratada fiscalmente.',
        example: 'Venda de Mercadoria',
        required: true,
        type: 'select',
        helpText: 'Para vendas normais, use "Venda". Para devolução, use "Devolução de Mercadoria".',
        options: [
          { value: 'venda', label: 'Venda' },
          { value: 'devolucao', label: 'Devolução' },
          { value: 'transferencia', label: 'Transferência' },
          { value: 'remessa', label: 'Remessa' },
        ],
      },
      {
        name: 'produtos',
        label: 'Produtos Vendidos',
        description: 'Lista dos itens vendidos com código, descrição, quantidade e valor unitário.',
        example: 'Notebook Dell Inspiron 15, Código: NB001, 2 unidades, R$ 3.500,00 cada',
        required: true,
        type: 'multiselect',
        helpText: 'Adicione produtos clicando em "+ Adicionar Item". Você pode importar de planilha Excel.',
      },
      {
        name: 'valorTotal',
        label: 'Valor Total da Nota',
        description: 'Soma de todos os produtos, incluindo impostos e frete.',
        example: 'R$ 7.245,00',
        required: true,
        type: 'currency',
        helpText: 'Calculado automaticamente com base nos produtos e impostos. Confira se está correto.',
      },
      {
        name: 'cfop',
        label: 'CFOP (Código Fiscal)',
        description: 'Código que indica a natureza da circulação da mercadoria (dentro ou fora do estado).',
        example: '5102 - Venda dentro do estado',
        required: true,
        type: 'select',
        helpText: 'Use 5102 para vendas dentro do estado e 6102 para fora do estado.',
        options: [
          { value: '5102', label: '5102 - Venda dentro do estado' },
          { value: '6102', label: '6102 - Venda fora do estado' },
          { value: '5405', label: '5405 - Venda de prod. adquirido (dentro)' },
          { value: '6405', label: '6405 - Venda de prod. adquirido (fora)' },
        ],
      },
      {
        name: 'formaPagamento',
        label: 'Forma de Pagamento',
        description: 'Como o cliente vai pagar pela compra.',
        example: 'Cartão de Crédito',
        required: true,
        type: 'select',
        helpText: 'Escolha a forma principal. Se houver pagamento misto, adicione mais de uma.',
        options: [
          { value: 'dinheiro', label: 'Dinheiro' },
          { value: 'cartao_credito', label: 'Cartão de Crédito' },
          { value: 'cartao_debito', label: 'Cartão de Débito' },
          { value: 'pix', label: 'PIX' },
          { value: 'boleto', label: 'Boleto' },
          { value: 'transferencia', label: 'Transferência Bancária' },
        ],
      },
      {
        name: 'dataEmissao',
        label: 'Data de Emissão',
        description: 'Data em que a nota está sendo emitida.',
        example: '22/05/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente é a data de hoje. Não pode ser futura.',
        validationRules: ['Não pode ser futura', 'Formato: DD/MM/AAAA'],
      },
      {
        name: 'informacoesAdicionais',
        label: 'Informações Adicionais',
        description: 'Campo livre para observações, número de pedido, etc.',
        example: 'Pedido nº 12345. Entregar na portaria.',
        required: false,
        type: 'text',
        helpText: 'Use para comunicar informações extras ao cliente ou transportadora.',
      },
    ],
    tips: [
      'Tenha o CNPJ/CPF do cliente em mãos antes de começar',
      'Confira os dados do produto no seu cadastro (código, NCM, tributação)',
      'A natureza da operação mais comum é "Venda"',
      'Para vender fora do estado, lembre de verificar alíquota de ICMS',
      'Guarde o XML da NFe por 5 anos (obrigação legal)',
    ],
    estimatedTime: '5-10 minutos',
    videoUrl: '/videos/nfe-tutorial.mp4',
    commonErrors: [
      {
        error: 'Erro: CNPJ do destinatário inválido',
        solution: 'Verifique se digitou todos os 14 dígitos corretamente. Use o validador de CNPJ se necessário.',
      },
      {
        error: 'Erro: Produto sem NCM cadastrado',
        solution: 'Todo produto precisa ter NCM (Nomenclatura Comum do Mercosul). Cadastre no menu Produtos.',
      },
      {
        error: 'Erro: CFOP incompatível com regime tributário',
        solution: 'Empresas do Simples Nacional devem usar CFOPs específicos. Consulte seu contador.',
      },
    ],
    faqs: [
      {
        question: 'Posso cancelar uma NFe depois de emitida?',
        answer: 'Sim, você tem até 24 horas para cancelar uma NFe após a autorização pela SEFAZ. Após esse prazo, é necessário emitir uma Nota de Devolução.',
      },
      {
        question: 'Qual a diferença entre NFe e NFSe?',
        answer: 'NFe é para venda de produtos/mercadorias. NFSe (Nota Fiscal de Serviço Eletrônica) é para prestação de serviços. Use cada uma conforme sua atividade.',
      },
      {
        question: 'Preciso emitir NFe para venda pequena?',
        answer: 'Sim, se sua empresa está obrigada a emitir NFe, deve emitir para qualquer valor de venda, mesmo pequeno.',
      },
    ],
  },

  'lancamentos': {
    title: 'Lançamentos Contábeis',
    whatIs: 'Lançamento contábil é o registro de uma operação financeira usando o método das partidas dobradas (débito e crédito sempre iguais). É a base da contabilidade e permite gerar relatórios como Balanço e DRE.',
    whenToUse: 'Use sempre que precisar registrar uma operação que afeta o patrimônio da empresa: compras, vendas, pagamentos, recebimentos, depreciação, etc. Todo documento fiscal ou comprovante deve gerar um lançamento.',
    variables: [
      {
        name: 'data',
        label: 'Data do Lançamento',
        description: 'Data em que a operação ocorreu (competência) ou foi paga (caixa).',
        example: '15/05/2026',
        required: true,
        type: 'date',
        helpText: 'Use a data do documento fiscal ou comprovante. Não pode ser futura.',
        validationRules: ['Formato: DD/MM/AAAA', 'Não pode ser futura'],
      },
      {
        name: 'historico',
        label: 'Histórico',
        description: 'Descrição clara da operação para referência futura.',
        example: 'Pagamento de fornecedor XYZ ref. NF 12345',
        required: true,
        type: 'text',
        helpText: 'Seja específico. Inclua número de nota fiscal, fornecedor, ou referência do documento.',
        validationRules: ['Mínimo 10 caracteres', 'Máximo 500 caracteres'],
      },
      {
        name: 'contaDebito',
        label: 'Conta Débito',
        description: 'Conta que recebe o valor (onde entra o recurso ou sai uma obrigação).',
        example: 'Estoque de Mercadorias',
        required: true,
        type: 'select',
        helpText: 'Selecione do Plano de Contas. Débito aumenta Ativo e Despesa, diminui Passivo e Receita.',
      },
      {
        name: 'contaCredito',
        label: 'Conta Crédito',
        description: 'Conta que fornece o valor (de onde sai o recurso ou entra uma obrigação).',
        example: 'Caixa',
        required: true,
        type: 'select',
        helpText: 'Selecione do Plano de Contas. Crédito aumenta Passivo e Receita, diminui Ativo e Despesa.',
      },
      {
        name: 'valor',
        label: 'Valor',
        description: 'Valor do lançamento. Débito e crédito devem ser iguais.',
        example: 'R$ 1.500,00',
        required: true,
        type: 'currency',
        helpText: 'Digite apenas números. Use ponto para separar milhares e vírgula para centavos.',
        validationRules: ['Deve ser maior que zero', 'Débito = Crédito'],
      },
      {
        name: 'documento',
        label: 'Documento de Suporte',
        description: 'Número do documento que comprova a operação (NF, recibo, boleto).',
        example: 'NF 12345',
        required: false,
        type: 'text',
        helpText: 'Sempre que possível, referencie o documento. Ajuda em auditorias.',
      },
      {
        name: 'centrosCusto',
        label: 'Centro de Custo',
        description: 'Departamento ou projeto ao qual o lançamento pertence.',
        example: 'Vendas',
        required: false,
        type: 'select',
        helpText: 'Use para controlar custos por área da empresa. Opcional mas recomendado.',
        options: [
          { value: 'vendas', label: 'Vendas' },
          { value: 'marketing', label: 'Marketing' },
          { value: 'administrativo', label: 'Administrativo' },
          { value: 'producao', label: 'Produção' },
        ],
      },
    ],
    tips: [
      'Sempre tenha um documento de suporte (nota, recibo, comprovante)',
      'Confira se débito = crédito antes de salvar',
      'Use históricos padronizados para facilitar análises futuras',
      'Não poste lançamentos sem revisar. Correções geram mais trabalho.',
      'Guarde documentos digitalizados anexados ao lançamento',
    ],
    estimatedTime: '3-5 minutos por lançamento',
    commonErrors: [
      {
        error: 'Erro: Débito diferente de Crédito',
        solution: 'Verifique os valores. Na contabilidade, débito e crédito devem sempre ser iguais.',
      },
      {
        error: 'Erro: Conta não encontrada',
        solution: 'A conta precisa existir no Plano de Contas. Cadastre primeiro em Menu > Plano de Contas.',
      },
      {
        error: 'Erro: Data fora do período',
        solution: 'Você está tentando lançar em um período já fechado. Reabra o período ou ajuste a data.',
      },
    ],
    faqs: [
      {
        question: 'O que é débito e crédito?',
        answer: 'Débito e crédito são posições contábeis. Débito aumenta Ativo e Despesa. Crédito aumenta Passivo e Receita. É oposto ao que usamos no dia a dia.',
      },
      {
        question: 'Posso fazer lançamento de meses anteriores?',
        answer: 'Sim, desde que o período não esteja fechado. Mas evite lançamentos retroativos em excesso para manter a contabilidade organizada.',
      },
      {
        question: 'Preciso lançar manualmente se uso Open Finance?',
        answer: 'Não para transações bancárias. O Open Finance importa automaticamente. Mas você ainda precisa classificar as transações.',
      },
    ],
  },

  'contas-receber': {
    title: 'Contas a Receber',
    whatIs: 'Contas a Receber é o controle de valores que sua empresa tem a receber de clientes. Funciona como um "contas a pagar" do cliente para você. Permite acompanhar cobranças, inadimplência e fluxo de caixa futuro.',
    whenToUse: 'Use sempre que fizer uma venda a prazo ou precisar cobrar um cliente. Cada nota fiscal a prazo deve gerar um título a receber. Acompanhe vencimentos para garantir o recebimento.',
    variables: [
      {
        name: 'cliente',
        label: 'Cliente',
        description: 'Nome ou razão social do cliente que deve pagar.',
        example: 'Empresa XYZ Ltda',
        required: true,
        type: 'select',
        helpText: 'Selecione do cadastro de clientes. Se não existir, cadastre primeiro.',
      },
      {
        name: 'descricao',
        label: 'Descrição',
        description: 'Motivo do recebimento ou referência da venda.',
        example: 'Venda ref. NFe 12345',
        required: true,
        type: 'text',
        helpText: 'Seja claro. Inclua número da nota fiscal ou pedido para facilitar identificação.',
      },
      {
        name: 'valor',
        label: 'Valor a Receber',
        description: 'Valor total que o cliente deve pagar.',
        example: 'R$ 5.000,00',
        required: true,
        type: 'currency',
        helpText: 'Valor original sem descontos. Descontos são aplicados no recebimento.',
      },
      {
        name: 'dataEmissao',
        label: 'Data de Emissão',
        description: 'Data em que o título foi gerado (normalmente data da venda).',
        example: '15/05/2026',
        required: true,
        type: 'date',
        helpText: 'Geralmente é a data da nota fiscal.',
      },
      {
        name: 'dataVencimento',
        label: 'Data de Vencimento',
        description: 'Data limite para o cliente pagar sem multa.',
        example: '15/06/2026',
        required: true,
        type: 'date',
        helpText: 'Atenção: após o vencimento, o título fica em atraso e pode gerar juros.',
        validationRules: ['Deve ser posterior à data de emissão'],
      },
      {
        name: 'formaPagamento',
        label: 'Forma de Pagamento Prevista',
        description: 'Como o cliente deve pagar (boleto, PIX, etc).',
        example: 'Boleto Bancário',
        required: true,
        type: 'select',
        helpText: 'Define como você vai cobrar o cliente.',
        options: [
          { value: 'boleto', label: 'Boleto Bancário' },
          { value: 'pix', label: 'PIX' },
          { value: 'transferencia', label: 'Transferência' },
          { value: 'cheque', label: 'Cheque' },
          { value: 'cartao', label: 'Cartão' },
        ],
      },
      {
        name: 'numeroParcelas',
        label: 'Número de Parcelas',
        description: 'Se o recebimento for parcelado, quantas vezes.',
        example: '3',
        required: false,
        type: 'number',
        helpText: 'Deixe em branco para pagamento único. O sistema gera parcelas automaticamente.',
      },
      {
        name: 'observacoes',
        label: 'Observações',
        description: 'Informações adicionais sobre o recebimento.',
        example: 'Cliente solicitou boleto por email',
        required: false,
        type: 'text',
        helpText: 'Campo livre para anotações internas.',
      },
    ],
    tips: [
      'Envie boletos/cobranças assim que criar o título',
      'Configure alertas para receber aviso próximo ao vencimento',
      'Marque como "recebido" apenas quando o dinheiro entrar na conta',
      'Para clientes recorrentes, use modelo de cobrança automática',
      'Acompanhe taxa de inadimplência semanalmente',
    ],
    estimatedTime: '2-4 minutos',
    commonErrors: [
      {
        error: 'Erro: Cliente não cadastrado',
        solution: 'Cadastre o cliente primeiro em Menu > Cadastros > Clientes.',
      },
      {
        error: 'Erro: Data de vencimento anterior à emissão',
        solution: 'O vencimento deve ser depois da emissão. Corrija as datas.',
      },
    ],
    faqs: [
      {
        question: 'Como faço para enviar boleto ao cliente?',
        answer: 'Após criar o título, clique em "Gerar Boleto". O sistema cria o boleto e você pode enviar por email diretamente.',
      },
      {
        question: 'O que fazer se o cliente não pagar no vencimento?',
        answer: 'O título fica em atraso automaticamente. Você pode enviar cobrança, aplicar juros/multa ou negociar nova data.',
      },
      {
        question: 'Posso receber parcialmente?',
        answer: 'Sim. No recebimento, informe o valor parcial. O sistema atualiza o saldo devedor automaticamente.',
      },
    ],
  },

  'contas-pagar': {
    title: 'Contas a Pagar',
    whatIs: 'Contas a Pagar é o controle de valores que sua empresa deve pagar a fornecedores, prestadores e outros credores. Evita atrasos, multas e ajuda no planejamento do fluxo de caixa.',
    whenToUse: 'Use sempre que receber uma nota fiscal de fornecedor, boleto, ou tiver uma despesa a pagar. Registre assim que receber o documento para não esquecer e não atrasar.',
    variables: [
      {
        name: 'fornecedor',
        label: 'Fornecedor/Credor',
        description: 'Nome da empresa ou pessoa que você deve pagar.',
        example: 'Fornecedor ABC Ltda',
        required: true,
        type: 'select',
        helpText: 'Selecione do cadastro. Se não existir, cadastre primeiro em Fornecedores.',
      },
      {
        name: 'descricao',
        label: 'Descrição',
        description: 'O que você está pagando.',
        example: 'Compra de materiais ref. NF 98765',
        required: true,
        type: 'text',
        helpText: 'Inclua número da nota fiscal ou referência do serviço.',
      },
      {
        name: 'categoria',
        label: 'Categoria de Despesa',
        description: 'Tipo de despesa para fins de relatório.',
        example: 'Matéria-prima',
        required: true,
        type: 'select',
        helpText: 'Escolha a categoria correta para análise de custos.',
        options: [
          { value: 'materia_prima', label: 'Matéria-prima' },
          { value: 'fornecedores', label: 'Fornecedores' },
          { value: 'salarios', label: 'Salários' },
          { value: 'aluguel', label: 'Aluguel' },
          { value: 'energia', label: 'Energia Elétrica' },
          { value: 'telefone', label: 'Telefone/Internet' },
          { value: 'impostos', label: 'Impostos' },
          { value: 'outros', label: 'Outros' },
        ],
      },
      {
        name: 'valor',
        label: 'Valor a Pagar',
        description: 'Valor total da despesa.',
        example: 'R$ 3.200,00',
        required: true,
        type: 'currency',
        helpText: 'Valor exato conforme nota fiscal ou boleto.',
      },
      {
        name: 'dataEmissao',
        label: 'Data de Emissão',
        description: 'Data em que recebeu a nota ou boleto.',
        example: '10/05/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente é a data da nota fiscal.',
      },
      {
        name: 'dataVencimento',
        label: 'Data de Vencimento',
        description: 'Data limite para pagar sem multa/juros.',
        example: '25/05/2026',
        required: true,
        type: 'date',
        helpText: 'ATENÇÃO: Não pague atrasado para evitar multa de 2% + juros de 1% ao mês.',
        validationRules: ['Deve ser posterior à emissão'],
      },
      {
        name: 'formaPagamento',
        label: 'Forma de Pagamento',
        description: 'Como você vai pagar.',
        example: 'Transferência Bancária',
        required: true,
        type: 'select',
        helpText: 'Escolha conforme acordo com fornecedor.',
        options: [
          { value: 'dinheiro', label: 'Dinheiro' },
          { value: 'boleto', label: 'Boleto' },
          { value: 'pix', label: 'PIX' },
          { value: 'transferencia', label: 'Transferência' },
          { value: 'cheque', label: 'Cheque' },
          { value: 'cartao', label: 'Cartão Empresarial' },
        ],
      },
      {
        name: 'numeroParcelas',
        label: 'Número de Parcelas',
        description: 'Se o pagamento for parcelado.',
        example: '2',
        required: false,
        type: 'number',
        helpText: 'Deixe em branco para pagamento único.',
      },
      {
        name: 'anexo',
        label: 'Anexar Nota Fiscal/Boleto',
        description: 'Arquivo digital da nota ou boleto.',
        example: 'nf_98765.pdf',
        required: false,
        type: 'text',
        helpText: 'Recomendado anexar para facilitar auditoria e conferência.',
      },
    ],
    tips: [
      'Cadastre SEMPRE que receber um documento, nunca deixe para depois',
      'Priorize pagamentos por data de vencimento (mais próximos primeiro)',
      'Use alertas para receber avisos 3 dias antes do vencimento',
      'Negocie prazos maiores com fornecedores para melhorar fluxo de caixa',
      'Anexe sempre o boleto/nota para ter comprovante digital',
    ],
    estimatedTime: '2-4 minutos',
    commonErrors: [
      {
        error: 'Erro: Fornecedor não cadastrado',
        solution: 'Cadastre o fornecedor antes em Menu > Cadastros > Fornecedores.',
      },
      {
        error: 'Erro: Categoria de despesa vazia',
        solution: 'Toda despesa precisa ter categoria para relatórios. Escolha a mais adequada.',
      },
    ],
    faqs: [
      {
        question: 'Posso pagar antes do vencimento?',
        answer: 'Sim. Alguns fornecedores dão desconto para pagamento antecipado. Negocie!',
      },
      {
        question: 'E se eu esquecer de pagar?',
        answer: 'Configure alertas automáticos. O sistema avisa via email/notificação próximo ao vencimento.',
      },
      {
        question: 'Como pagar parcialmente?',
        answer: 'No pagamento, informe valor parcial. O sistema atualiza saldo devedor automaticamente.',
      },
    ],
  },

  'fluxo-caixa': {
    title: 'Fluxo de Caixa',
    whatIs: 'Fluxo de Caixa mostra todas as entradas e saídas de dinheiro da empresa em um período. Permite saber quanto dinheiro tem disponível, prever quando vai faltar e planejar investimentos.',
    whenToUse: 'Use diariamente para acompanhar saúde financeira. Consulte antes de fazer compras grandes, contratar pessoas ou investir. É essencial para evitar "caixa no vermelho" e renegociar prazos.',
    variables: [
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Início do período que deseja analisar.',
        example: '01/05/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente use primeiro dia do mês.',
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Fim do período.',
        example: '31/05/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente último dia do mês.',
        validationRules: ['Deve ser posterior à data inicial'],
      },
      {
        name: 'tipoVisualizacao',
        label: 'Tipo de Visualização',
        description: 'Como deseja ver o fluxo.',
        example: 'Diário',
        required: true,
        type: 'select',
        helpText: 'Diário para controle detalhado. Mensal para visão estratégica.',
        options: [
          { value: 'diario', label: 'Diário' },
          { value: 'semanal', label: 'Semanal' },
          { value: 'mensal', label: 'Mensal' },
        ],
      },
      {
        name: 'incluirPrevisao',
        label: 'Incluir Previsão',
        description: 'Mostrar valores futuros previstos (a receber e a pagar).',
        example: 'Sim',
        required: false,
        type: 'select',
        helpText: 'Recomendado marcar "Sim" para planejamento futuro.',
        options: [
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
        ],
      },
      {
        name: 'categorias',
        label: 'Filtrar por Categorias',
        description: 'Ver apenas determinadas categorias de entrada/saída.',
        example: 'Vendas, Fornecedores',
        required: false,
        type: 'multiselect',
        helpText: 'Deixe em branco para ver todas. Útil para análise específica.',
      },
    ],
    tips: [
      'Atualize diariamente para ter dados precisos',
      'Use previsão para antecipar problemas de caixa',
      'Compare realizado vs previsto para melhorar estimativas',
      'Configure saldo mínimo de segurança (ex: R$ 10.000)',
      'Negocie prazos maiores com fornecedores se o fluxo estiver apertado',
    ],
    estimatedTime: '1-2 minutos para consultar',
    faqs: [
      {
        question: 'Qual a diferença entre Fluxo de Caixa e DRE?',
        answer: 'Fluxo de Caixa mostra dinheiro que ENTROU e SAIU (regime de caixa). DRE mostra receitas e despesas quando ACONTECERAM (regime de competência).',
      },
      {
        question: 'Como melhorar meu fluxo de caixa?',
        answer: 'Receba mais rápido (diminua prazo de clientes), pague mais devagar (aumente prazo com fornecedores), reduza estoques parados.',
      },
    ],
  },

  'das-apuracao': {
    title: 'Apuração DAS - Simples Nacional',
    whatIs: 'DAS (Documento de Arrecadação do Simples Nacional) é o boleto único que empresas do Simples pagam mensalmente. Inclui vários impostos em um só (IRPJ, CSLL, PIS, COFINS, IPI, ICMS, ISS, CPP). A apuração calcula quanto sua empresa deve pagar com base no faturamento.',
    whenToUse: 'Use todo mês para calcular o valor do DAS. A apuração considera faturamento dos últimos 12 meses, anexo do Simples (comércio, indústria, serviços) e alíquota progressiva. Emita até o dia 20 do mês seguinte.',
    variables: [
      {
        name: 'competencia',
        label: 'Competência (Mês/Ano)',
        description: 'Mês de referência da apuração.',
        example: '05/2026',
        required: true,
        type: 'date',
        helpText: 'Use formato MM/AAAA. Ex: 05/2026 para maio de 2026.',
      },
      {
        name: 'faturamentoBruto',
        label: 'Faturamento Bruto do Mês',
        description: 'Total de vendas/serviços do mês (sem descontos).',
        example: 'R$ 45.000,00',
        required: true,
        type: 'currency',
        helpText: 'Soma de todas as notas fiscais emitidas no mês.',
      },
      {
        name: 'faturamento12Meses',
        label: 'Faturamento dos Últimos 12 Meses',
        description: 'Soma do faturamento dos últimos 12 meses (incluindo mês atual).',
        example: 'R$ 500.000,00',
        required: true,
        type: 'currency',
        helpText: 'Necessário para calcular alíquota. Sistema calcula automaticamente se tiver histórico.',
      },
      {
        name: 'anexoSimples',
        label: 'Anexo do Simples Nacional',
        description: 'Classificação da atividade da empresa (define tabela de alíquotas).',
        example: 'Anexo I - Comércio',
        required: true,
        type: 'select',
        helpText: 'Verifique no cartão CNPJ ou consulte contador.',
        options: [
          { value: 'anexo1', label: 'Anexo I - Comércio' },
          { value: 'anexo2', label: 'Anexo II - Indústria' },
          { value: 'anexo3', label: 'Anexo III - Serviços' },
          { value: 'anexo4', label: 'Anexo IV - Serviços' },
          { value: 'anexo5', label: 'Anexo V - Serviços' },
        ],
      },
      {
        name: 'deducoes',
        label: 'Deduções (Opcional)',
        description: 'Valores que podem ser deduzidos (devoluções, cancelamentos).',
        example: 'R$ 500,00',
        required: false,
        type: 'currency',
        helpText: 'Apenas se houver devoluções ou cancelamentos formais de notas.',
      },
    ],
    tips: [
      'Apure até dia 20 do mês seguinte para evitar multa',
      'Guarde comprovante de pagamento por 5 anos',
      'Se ultrapassar R$ 4,8 milhões/ano, sai do Simples',
      'Emita DAS pelo portal do Simples Nacional (oficial)',
      'Configure débito automático para não atrasar',
    ],
    estimatedTime: '5-8 minutos',
    commonErrors: [
      {
        error: 'Erro: Faturamento 12 meses incorreto',
        solution: 'Some TODAS as notas dos últimos 12 meses. Não esqueça nenhum mês.',
      },
      {
        error: 'Erro: Anexo do Simples errado',
        solution: 'Consulte seu cartão CNPJ ou fale com contador. Anexo errado = cálculo errado.',
      },
    ],
    faqs: [
      {
        question: 'Posso parcelar o DAS?',
        answer: 'Sim, mas apenas em casos específicos e com multa/juros. Pagar em dia é sempre melhor.',
      },
      {
        question: 'O que acontece se não pagar?',
        answer: 'Multa de 0,33% ao dia (max 20%) + juros Selic. Além disso, empresa fica irregular.',
      },
    ],
  },

  'balanco-patrimonial': {
    title: 'Balanço Patrimonial',
    whatIs: 'Balanço Patrimonial é uma "fotografia" do patrimônio da empresa em uma data específica. Mostra tudo que a empresa possui (Ativo), tudo que deve (Passivo) e quanto é dos sócios (Patrimônio Líquido). Fórmula: Ativo = Passivo + Patrimônio Líquido.',
    whenToUse: 'Use para fechar o ano, apresentar a investidores, pegar empréstimos bancários ou entender saúde patrimonial. Obrigatório gerar anualmente, mas recomendado fazer mensalmente.',
    variables: [
      {
        name: 'dataReferencia',
        label: 'Data de Referência',
        description: 'Data para a qual deseja ver o balanço (normalmente último dia do mês).',
        example: '31/12/2025',
        required: true,
        type: 'date',
        helpText: 'Use último dia do mês ou ano. Ex: 31/12/2025 para balanço anual.',
      },
      {
        name: 'tipoDemonstracao',
        label: 'Tipo de Demonstração',
        description: 'Formato de apresentação do balanço.',
        example: 'Sintético',
        required: true,
        type: 'select',
        helpText: 'Sintético para visão resumida. Analítico para detalhes de cada conta.',
        options: [
          { value: 'sintetico', label: 'Sintético (Resumido)' },
          { value: 'analitico', label: 'Analítico (Detalhado)' },
        ],
      },
      {
        name: 'compararComPeriodo',
        label: 'Comparar com Período Anterior',
        description: 'Mostrar variação em relação a outro período.',
        example: '31/12/2024',
        required: false,
        type: 'date',
        helpText: 'Útil para ver evolução patrimonial ano a ano.',
      },
    ],
    tips: [
      'Feche lançamentos antes de gerar balanço',
      'Confira se Ativo = Passivo + PL (deve bater sempre)',
      'Compare com período anterior para ver crescimento',
      'Use balanço para calcular indicadores (liquidez, endividamento)',
      'Guarde balanços anuais por tempo indeterminado',
    ],
    estimatedTime: '2-3 minutos para gerar',
    faqs: [
      {
        question: 'Por que Ativo = Passivo + PL?',
        answer: 'Porque tudo que a empresa tem (Ativo) veio de duas fontes: dívidas (Passivo) ou capital dos sócios (PL).',
      },
      {
        question: 'Posso gerar balanço de qualquer data?',
        answer: 'Sim, mas é mais comum fazer no final de mês ou ano. Certifique-se que lançamentos estejam completos.',
      },
    ],
  },

  'dre': {
    title: 'DRE - Demonstração do Resultado do Exercício',
    whatIs: 'DRE mostra se a empresa teve lucro ou prejuízo em um período. Começa com Receitas, subtrai Custos e Despesas, e chega no Resultado (Lucro ou Prejuízo). Diferente do fluxo de caixa, usa regime de competência.',
    whenToUse: 'Use para saber se a empresa está dando lucro, analisar margens, comparar períodos e tomar decisões estratégicas. Obrigatório anualmente, mas recomendado mensalmente.',
    variables: [
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Início do período da DRE.',
        example: '01/01/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente primeiro dia do mês ou ano.',
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Fim do período.',
        example: '31/01/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente último dia do mês ou ano.',
        validationRules: ['Deve ser posterior à data inicial'],
      },
      {
        name: 'nivelDetalhamento',
        label: 'Nível de Detalhamento',
        description: 'Quanto detalhe mostrar.',
        example: 'Padrão',
        required: true,
        type: 'select',
        helpText: 'Gerencial para análise interna. Fiscal para obrigações legais.',
        options: [
          { value: 'resumido', label: 'Resumido' },
          { value: 'padrao', label: 'Padrão' },
          { value: 'detalhado', label: 'Detalhado' },
        ],
      },
      {
        name: 'compararComPeriodo',
        label: 'Comparar com Período',
        description: 'Mostrar lado a lado com outro período.',
        example: '01/01/2025 a 31/01/2025',
        required: false,
        type: 'text',
        helpText: 'Útil para ver evolução mês a mês ou ano a ano.',
      },
    ],
    tips: [
      'Gere mensalmente para acompanhar resultado',
      'Compare com meses anteriores para identificar tendências',
      'Calcule margem líquida: Lucro Líquido / Receita Total',
      'Use DRE para negociar com bancos e investidores',
      'Se estiver no prejuízo, corte despesas ou aumente receitas',
    ],
    estimatedTime: '2-3 minutos',
    faqs: [
      {
        question: 'Diferença entre DRE e Fluxo de Caixa?',
        answer: 'DRE usa competência (quando aconteceu). Fluxo de Caixa usa caixa (quando entrou/saiu dinheiro).',
      },
      {
        question: 'Posso ter lucro na DRE e caixa negativo?',
        answer: 'Sim! Você pode ter vendido a prazo (lucro na DRE) mas ainda não recebeu (caixa negativo).',
      },
    ],
  },

  'sped-contabil': {
    title: 'SPED Contábil',
    whatIs: 'SPED Contábil (ECD - Escrituração Contábil Digital) é a entrega dos livros contábeis em formato digital para a Receita Federal. Substitui livros em papel. É obrigatório para todas empresas no Lucro Real e algumas no Lucro Presumido.',
    whenToUse: 'Use uma vez por ano para enviar escrituração contábil à Receita. Prazo: último dia útil de maio do ano seguinte. Ex: SPED de 2025 deve ser enviado até maio de 2026.',
    variables: [
      {
        name: 'anoExercicio',
        label: 'Ano de Exercício',
        description: 'Ano da escrituração que será enviada.',
        example: '2025',
        required: true,
        type: 'number',
        helpText: 'Use ano completo (4 dígitos). Ex: 2025',
        validationRules: ['4 dígitos', 'Não pode ser futuro'],
      },
      {
        name: 'tipoEscrituracao',
        label: 'Tipo de Escrituração',
        description: 'Classificação da escrituração.',
        example: 'Original',
        required: true,
        type: 'select',
        helpText: 'Use "Original" se for primeiro envio. "Substituta" se corrigir envio anterior.',
        options: [
          { value: 'original', label: 'Original' },
          { value: 'substituta', label: 'Substituta' },
        ],
      },
      {
        name: 'numeroRecibo',
        label: 'Número do Recibo (se Substituta)',
        description: 'Recibo da escrituração anterior (apenas para substituta).',
        example: '123456789012345',
        required: false,
        type: 'text',
        helpText: 'Obrigatório apenas se tipo for "Substituta".',
      },
      {
        name: 'formatoArquivo',
        label: 'Formato do Arquivo',
        description: 'Formato de exportação.',
        example: 'TXT',
        required: true,
        type: 'select',
        helpText: 'TXT é o padrão da Receita.',
        options: [
          { value: 'txt', label: 'TXT (Padrão Receita)' },
        ],
      },
    ],
    tips: [
      'Feche todos lançamentos do ano antes de gerar SPED',
      'Valide arquivo no PVA (Programa Validador) da Receita',
      'Assine digitalmente com certificado e-CPF ou e-CNPJ',
      'Guarde recibo de entrega por tempo indeterminado',
      'Se encontrar erro após envio, faça escrituração substituta',
    ],
    estimatedTime: '10-15 minutos',
    commonErrors: [
      {
        error: 'Erro: Escrituração com saldos não balanceados',
        solution: 'Confira se todos lançamentos têm débito = crédito. Corrija antes de gerar.',
      },
      {
        error: 'Erro: Plano de contas incompatível',
        solution: 'Use plano de contas que siga estrutura da Receita (códigos iniciando com 1, 2, 3...).',
      },
    ],
    faqs: [
      {
        question: 'Minha empresa é obrigada a enviar SPED?',
        answer: 'Sim se for Lucro Real. Lucro Presumido depende (consulte contador). Simples Nacional não envia.',
      },
      {
        question: 'Posso enviar atrasado?',
        answer: 'Sim, mas terá multa. R$ 500/mês de atraso (mínimo R$ 1.500). Envie o quanto antes.',
      },
    ],
  },

  'conciliacao-bancaria': {
    title: 'Conciliação Bancária',
    whatIs: 'Conciliação Bancária é o processo de comparar extrato bancário com lançamentos contábeis para garantir que estão corretos. Identifica erros, lançamentos duplicados, valores divergentes e transações não registradas.',
    whenToUse: 'Use mensalmente (ou semanalmente) para garantir que sua contabilidade reflete exatamente o que aconteceu no banco. Essencial para confiabilidade dos relatórios e evitar fraudes.',
    variables: [
      {
        name: 'contaBancaria',
        label: 'Conta Bancária',
        description: 'Qual conta bancária deseja conciliar.',
        example: 'Banco do Brasil - CC 12345-6',
        required: true,
        type: 'select',
        helpText: 'Selecione a conta. Você pode conciliar várias contas separadamente.',
      },
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Início do período de conciliação.',
        example: '01/05/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente primeiro dia do mês.',
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Fim do período.',
        example: '31/05/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente último dia do mês.',
      },
      {
        name: 'saldoInicialBanco',
        label: 'Saldo Inicial no Banco',
        description: 'Saldo da conta no início do período (conforme extrato).',
        example: 'R$ 15.000,00',
        required: true,
        type: 'currency',
        helpText: 'Copie do extrato bancário. Deve bater com contabilidade.',
      },
      {
        name: 'saldoFinalBanco',
        label: 'Saldo Final no Banco',
        description: 'Saldo da conta no fim do período (conforme extrato).',
        example: 'R$ 18.500,00',
        required: true,
        type: 'currency',
        helpText: 'Copie do extrato bancário.',
      },
      {
        name: 'importarExtrato',
        label: 'Importar Extrato (OFX)',
        description: 'Arquivo OFX baixado do banco.',
        example: 'extrato_maio.ofx',
        required: false,
        type: 'text',
        helpText: 'Se disponível, importar automatiza muito o processo.',
      },
    ],
    tips: [
      'Faça conciliação SEMPRE antes de fechar o mês',
      'Use Open Finance para importar extratos automaticamente',
      'Marque transações como "conciliadas" após verificar',
      'Investigue divergências imediatamente (podem ser fraudes)',
      'Guarde extratos conciliados por 5 anos',
    ],
    estimatedTime: '15-30 minutos',
    commonErrors: [
      {
        error: 'Erro: Saldo contábil diferente do bancário',
        solution: 'Compare linha a linha. Procure lançamentos faltando ou duplicados.',
      },
      {
        error: 'Erro: Tarifa bancária não lançada',
        solution: 'Bancos cobram tarifas. Registre como despesa bancária.',
      },
    ],
    faqs: [
      {
        question: 'Por que conciliar se uso Open Finance?',
        answer: 'Open Finance ajuda, mas não classifica corretamente. Você ainda precisa verificar.',
      },
      {
        question: 'E se não bater nunca?',
        answer: 'Revise lançamento por lançamento. Se não resolver, consulte contador.',
      },
    ],
  },

  'cadastro-clientes': {
    title: 'Cadastro de Clientes',
    whatIs: 'Cadastro de Clientes armazena dados dos compradores da empresa. Permite emitir notas fiscais, fazer cobranças, analisar vendas por cliente e manter histórico de relacionamento.',
    whenToUse: 'Use sempre que fechar uma venda para cliente novo ou atualizar dados de cliente existente. Mantenha cadastro completo para emitir NFe corretamente.',
    variables: [
      {
        name: 'tipoPessoa',
        label: 'Tipo de Pessoa',
        description: 'Pessoa física ou jurídica.',
        example: 'Jurídica',
        required: true,
        type: 'select',
        helpText: 'PF usa CPF. PJ usa CNPJ.',
        options: [
          { value: 'pf', label: 'Pessoa Física' },
          { value: 'pj', label: 'Pessoa Jurídica' },
        ],
      },
      {
        name: 'cpfCnpj',
        label: 'CPF/CNPJ',
        description: 'Documento de identificação.',
        example: '12.345.678/0001-90',
        required: true,
        type: 'cnpj',
        helpText: 'Digite apenas números. Sistema valida automaticamente.',
        validationRules: ['CPF ou CNPJ válido'],
      },
      {
        name: 'nomeRazaoSocial',
        label: 'Nome/Razão Social',
        description: 'Nome completo (PF) ou razão social (PJ).',
        example: 'Empresa XYZ Ltda',
        required: true,
        type: 'text',
        helpText: 'Use nome conforme documento (CPF ou Contrato Social).',
      },
      {
        name: 'nomeFantasia',
        label: 'Nome Fantasia (PJ)',
        description: 'Nome comercial da empresa.',
        example: 'XYZ Comércio',
        required: false,
        type: 'text',
        helpText: 'Apenas para PJ. É o nome conhecido no mercado.',
      },
      {
        name: 'email',
        label: 'E-mail',
        description: 'E-mail principal do cliente.',
        example: 'contato@empresaxyz.com.br',
        required: true,
        type: 'email',
        helpText: 'Usado para enviar NFe, boletos e cobranças.',
        validationRules: ['E-mail válido'],
      },
      {
        name: 'telefone',
        label: 'Telefone',
        description: 'Telefone de contato.',
        example: '(11) 98765-4321',
        required: true,
        type: 'phone',
        helpText: 'Use DDD + número. Ex: (11) 98765-4321',
      },
      {
        name: 'endereco',
        label: 'Endereço Completo',
        description: 'Endereço para entrega e emissão de NFe.',
        example: 'Rua ABC, 123, Centro, São Paulo - SP, 01234-567',
        required: true,
        type: 'text',
        helpText: 'Obrigatório para NFe. Inclua CEP, número, bairro, cidade, UF.',
      },
    ],
    tips: [
      'Valide CNPJ/CPF antes de salvar (evita erro em NFe)',
      'Mantenha e-mail atualizado (envio de documentos)',
      'Para clientes recorrentes, ative cobrança automática',
      'Use campo "Observações" para anotar preferências',
      'Exporte lista periodicamente (backup)',
    ],
    estimatedTime: '3-5 minutos',
    faqs: [
      {
        question: 'Posso ter cliente sem CNPJ/CPF?',
        answer: 'Não para emitir NFe. Para orçamentos, sim (mas complete depois).',
      },
    ],
  },

  'cadastro-fornecedores': {
    title: 'Cadastro de Fornecedores',
    whatIs: 'Cadastro de Fornecedores armazena dados de empresas que vendem para você. Facilita lançamentos, controle de pagamentos e análise de compras.',
    whenToUse: 'Use ao receber primeira nota de fornecedor novo ou atualizar dados existentes.',
    variables: [
      {
        name: 'cnpj',
        label: 'CNPJ',
        description: 'CNPJ do fornecedor.',
        example: '98.765.432/0001-10',
        required: true,
        type: 'cnpj',
        helpText: 'Conforme nota fiscal.',
      },
      {
        name: 'razaoSocial',
        label: 'Razão Social',
        description: 'Nome legal do fornecedor.',
        example: 'Fornecedor ABC Ltda',
        required: true,
        type: 'text',
        helpText: 'Conforme Contrato Social.',
      },
      {
        name: 'email',
        label: 'E-mail',
        description: 'E-mail de contato.',
        example: 'vendas@fornecedorabc.com',
        required: true,
        type: 'email',
        helpText: 'Para pedidos e comunicações.',
      },
      {
        name: 'telefone',
        label: 'Telefone',
        description: 'Telefone comercial.',
        example: '(11) 3456-7890',
        required: true,
        type: 'phone',
        helpText: 'Telefone principal.',
      },
      {
        name: 'condicoesPagamento',
        label: 'Condições de Pagamento',
        description: 'Prazo padrão do fornecedor.',
        example: '30 dias',
        required: false,
        type: 'text',
        helpText: 'Ex: À vista, 30/60 dias, etc.',
      },
    ],
    tips: [
      'Mantenha cadastro atualizado',
      'Negocie melhores prazos de pagamento',
      'Avalie fornecedores periodicamente',
    ],
    estimatedTime: '3-5 minutos',
  },

  'plano-contas': {
    title: 'Plano de Contas',
    whatIs: 'Plano de Contas é a estrutura de todas as contas contábeis da empresa. Organiza Ativos, Passivos, Receitas e Despesas em categorias. É a base para todos os lançamentos e relatórios.',
    whenToUse: 'Configure uma vez no início. Adicione contas novas conforme necessário. Revise anualmente.',
    variables: [
      {
        name: 'codigo',
        label: 'Código da Conta',
        description: 'Número único da conta.',
        example: '1.1.1.01',
        required: true,
        type: 'text',
        helpText: 'Use estrutura hierárquica. Ex: 1 = Ativo, 1.1 = Circulante, 1.1.1 = Caixa',
      },
      {
        name: 'nome',
        label: 'Nome da Conta',
        description: 'Nome descritivo.',
        example: 'Caixa Geral',
        required: true,
        type: 'text',
        helpText: 'Seja claro e objetivo.',
      },
      {
        name: 'tipo',
        label: 'Tipo de Conta',
        description: 'Classificação contábil.',
        example: 'Ativo Circulante',
        required: true,
        type: 'select',
        helpText: 'Define onde aparece no Balanço/DRE.',
        options: [
          { value: 'ativo_circulante', label: 'Ativo Circulante' },
          { value: 'ativo_nao_circulante', label: 'Ativo Não Circulante' },
          { value: 'passivo_circulante', label: 'Passivo Circulante' },
          { value: 'passivo_nao_circulante', label: 'Passivo Não Circulante' },
          { value: 'patrimonio_liquido', label: 'Patrimônio Líquido' },
          { value: 'receita', label: 'Receita' },
          { value: 'despesa', label: 'Despesa' },
        ],
      },
      {
        name: 'analiticaSintetica',
        label: 'Analítica/Sintética',
        description: 'Conta recebe lançamentos ou apenas agrupa outras.',
        example: 'Analítica',
        required: true,
        type: 'select',
        helpText: 'Analítica: recebe lançamentos. Sintética: soma de outras contas.',
        options: [
          { value: 'analitica', label: 'Analítica (recebe lançamentos)' },
          { value: 'sintetica', label: 'Sintética (apenas agrupa)' },
        ],
      },
    ],
    tips: [
      'Use plano padrão como base (adapte depois)',
      'Não delete contas com histórico (inative)',
      'Revise hierarquia antes de lançar',
    ],
    estimatedTime: '2-3 minutos por conta',
  },

  'relatorio-vendas': {
    title: 'Relatório de Vendas',
    whatIs: 'Relatório consolidado de todas as vendas em um período. Mostra faturamento, produtos mais vendidos, clientes top, margens e comparativos.',
    whenToUse: 'Use para análise de performance comercial, planejamento de estoque, definição de metas.',
    variables: [
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Início do período.',
        example: '01/05/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente primeiro dia do mês.',
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Fim do período.',
        example: '31/05/2026',
        required: true,
        type: 'date',
        helpText: 'Último dia do mês.',
      },
      {
        name: 'agruparPor',
        label: 'Agrupar Por',
        description: 'Como deseja agrupar dados.',
        example: 'Produto',
        required: true,
        type: 'select',
        helpText: 'Escolha conforme análise desejada.',
        options: [
          { value: 'produto', label: 'Produto' },
          { value: 'cliente', label: 'Cliente' },
          { value: 'vendedor', label: 'Vendedor' },
          { value: 'categoria', label: 'Categoria' },
        ],
      },
    ],
    tips: [
      'Compare com mês anterior',
      'Identifique produtos com baixa margem',
      'Use para negociar com fornecedores',
    ],
    estimatedTime: '1-2 minutos',
  },

  // ===== ALIAS ENTRIES com IDs usados no roteamento de páginas =====

  'nfe-emissao': {
    title: 'Emissão de NF-e',
    whatIs: 'Nota Fiscal Eletrônica (NF-e) é o documento fiscal digital obrigatório para venda de produtos. Substitui a nota em papel e tem validade jurídica garantida pelo governo federal. Cada venda de mercadoria precisa ter uma NF-e.',
    whenToUse: 'Use sempre que sua empresa vender produtos físicos para clientes (pessoa física ou jurídica). Para prestação de serviços, emita NFS-e (diferente). Emissão deve ocorrer antes do transporte da mercadoria.',
    variables: [
      {
        name: 'destinatario',
        label: 'Destinatário (CNPJ/CPF)',
        description: 'Identificação do comprador — CNPJ para empresa ou CPF para pessoa física.',
        example: '12.345.678/0001-90 (empresa) ou 123.456.789-00 (pessoa física)',
        required: true,
        type: 'cnpj',
        helpText: 'Digite apenas números. O sistema formata automaticamente.',
      },
      {
        name: 'naturezaOperacao',
        label: 'Natureza da Operação',
        description: 'Tipo fiscal da operação — define como a nota será tratada.',
        example: 'Venda de Mercadoria',
        required: true,
        type: 'select',
        helpText: 'Para venda normal use "Venda". Para devolver produto use "Devolução".',
        options: [
          { value: 'venda', label: 'Venda de Mercadoria' },
          { value: 'devolucao', label: 'Devolução de Mercadoria' },
          { value: 'transferencia', label: 'Transferência entre Filiais' },
          { value: 'remessa', label: 'Remessa para Conserto' },
          { value: 'brinde', label: 'Remessa de Brinde/Amostra' },
        ],
      },
      {
        name: 'produtos',
        label: 'Produtos',
        description: 'Lista de itens: descrição, NCM, CFOP, quantidade, valor unitário.',
        example: 'Notebook Dell Inspiron, NCM 8471.30.12, CFOP 5102, 2 un., R$ 3.500,00',
        required: true,
        type: 'multiselect',
        helpText: 'Cada produto precisa ter NCM cadastrado. Confira o CFOP (5102 = dentro estado / 6102 = fora estado).',
      },
      {
        name: 'cfop',
        label: 'CFOP',
        description: 'Código Fiscal de Operações — indica origem e destino da mercadoria.',
        example: '5102 — Venda dentro do estado',
        required: true,
        type: 'select',
        helpText: 'Use 5xxx para operações dentro do estado e 6xxx para fora do estado.',
        options: [
          { value: '5102', label: '5102 — Venda dentro do estado' },
          { value: '6102', label: '6102 — Venda fora do estado' },
          { value: '5405', label: '5405 — Venda com ST (dentro)' },
          { value: '6405', label: '6405 — Venda com ST (fora)' },
          { value: '5910', label: '5910 — Remessa de brinde' },
        ],
      },
      {
        name: 'formaPagamento',
        label: 'Forma de Pagamento',
        description: 'Como o cliente vai pagar pela compra.',
        example: 'PIX',
        required: true,
        type: 'select',
        helpText: 'Deve refletir o real acordo com o cliente. Em vendas a prazo, informe "a prazo".',
        options: [
          { value: 'dinheiro', label: 'Dinheiro' },
          { value: 'pix', label: 'PIX' },
          { value: 'cartao_credito', label: 'Cartão de Crédito' },
          { value: 'cartao_debito', label: 'Cartão de Débito' },
          { value: 'boleto', label: 'Boleto' },
          { value: 'transferencia', label: 'Transferência' },
        ],
      },
      {
        name: 'transportadora',
        label: 'Transportadora (se houver)',
        description: 'Empresa responsável pelo transporte da mercadoria.',
        example: 'Transportadora Rápida LTDA — CNPJ 11.222.333/0001-44',
        required: false,
        type: 'text',
        helpText: 'Obrigatório se a mercadoria for transportada. Para retirada na loja, pode deixar em branco.',
      },
    ],
    tips: [
      'Tenha CNPJ/CPF do cliente antes de iniciar — sem isso a nota não pode ser emitida',
      'Confira NCM de cada produto: código errado pode gerar autuação fiscal',
      'CFOP 5102 é para vendas dentro do próprio estado; 6102 para outros estados',
      'Após autorização pela SEFAZ, guarde o XML por pelo menos 5 anos',
      'Cancelamento só é possível em até 24h após autorização',
    ],
    estimatedTime: '5-10 minutos',
    commonErrors: [
      { error: 'CNPJ destinatário inválido', solution: 'Verifique todos os 14 dígitos. Não copie com formatação errada.' },
      { error: 'Produto sem NCM cadastrado', solution: 'Cadastre o NCM no menu Produtos antes de emitir a nota.' },
      { error: 'CFOP incompatível com operação', solution: 'Para vendas dentro do estado use 5102; fora do estado use 6102.' },
    ],
    faqs: [
      { question: 'Posso cancelar após 24h?', answer: 'Não por cancelamento. Você precisará emitir uma Nota de Devolução.' },
      { question: 'NF-e serve para serviços?', answer: 'Não. Serviços usam NFS-e (municipal). NF-e é exclusiva para produtos.' },
    ],
  },

  'lancamento-contabil': {
    title: 'Lançamento Contábil',
    whatIs: 'Lançamento contábil é o registro de uma operação financeira pelo método das partidas dobradas: para cada valor debitado numa conta, o mesmo valor é creditado em outra. É a base da contabilidade e alimenta todos os relatórios (Balanço, DRE, Razão).',
    whenToUse: 'Use para registrar compras, vendas, pagamentos, recebimentos, depreciação, provisões e qualquer evento que afete o patrimônio da empresa. Todo documento fiscal (nota, recibo, boleto) deve gerar pelo menos um lançamento.',
    variables: [
      {
        name: 'data',
        label: 'Data do Lançamento',
        description: 'Data em que a operação ocorreu (regime de competência) ou foi paga (regime de caixa).',
        example: '15/05/2026',
        required: true,
        type: 'date',
        helpText: 'Use data do documento fiscal. Lançamentos retroativos só em períodos ainda abertos.',
      },
      {
        name: 'historico',
        label: 'Histórico',
        description: 'Descrição clara da operação. Ficará gravada permanentemente.',
        example: 'Pagamento aluguel escritório ref. mai/2026 — Recibo 1234',
        required: true,
        type: 'text',
        helpText: 'Inclua: o que foi, de quem/para quem, número do documento. Mínimo 10 caracteres.',
        validationRules: ['Mínimo 10 caracteres', 'Máximo 500 caracteres'],
      },
      {
        name: 'contaDebito',
        label: 'Conta Débito',
        description: 'Conta que recebe o valor. Débito aumenta Ativos e Despesas; reduz Passivos e Receitas.',
        example: '3.1.2.01 — Despesas de Aluguel',
        required: true,
        type: 'select',
        helpText: 'Selecione do Plano de Contas. Dica: pagamento de despesa → débito na conta de despesa.',
      },
      {
        name: 'contaCredito',
        label: 'Conta Crédito',
        description: 'Conta que fornece o valor. Crédito aumenta Passivos e Receitas; reduz Ativos e Despesas.',
        example: '1.1.1.01 — Caixa',
        required: true,
        type: 'select',
        helpText: 'Para pagamento em dinheiro/pix, crédite Caixa ou Banco. Para compra a prazo, crédite Fornecedores.',
      },
      {
        name: 'valor',
        label: 'Valor',
        description: 'Valor da operação. Débito e crédito sempre devem ser iguais.',
        example: 'R$ 3.500,00',
        required: true,
        type: 'currency',
        helpText: 'Partidas dobradas: o que sai de um lado entra no outro. Valor nunca pode ser zero.',
        validationRules: ['Maior que zero', 'Débito = Crédito'],
      },
      {
        name: 'centroCusto',
        label: 'Centro de Custo',
        description: 'Departamento ou projeto ao qual a despesa pertence.',
        example: 'Administrativo',
        required: false,
        type: 'select',
        helpText: 'Opcional mas recomendado para análise gerencial. Ex: Vendas, TI, Produção.',
        options: [
          { value: 'administrativo', label: 'Administrativo' },
          { value: 'vendas', label: 'Vendas' },
          { value: 'marketing', label: 'Marketing' },
          { value: 'producao', label: 'Produção' },
          { value: 'ti', label: 'TI / Tecnologia' },
        ],
      },
    ],
    tips: [
      'Sempre tenha um documento de suporte (nota, recibo, comprovante) antes de lançar',
      'Débito = Crédito: se não bater, o lançamento está errado',
      'Histórico claro economiza horas de revisão no futuro',
      'Use centro de custo para análise gerencial por área',
      'Lançamentos em períodos já fechados geram retrabalho — lance no prazo',
    ],
    estimatedTime: '3-5 minutos por lançamento',
    commonErrors: [
      { error: 'Débito diferente de Crédito', solution: 'Revise os valores. Em partidas dobradas o total débito deve sempre igualar o total crédito.' },
      { error: 'Conta não encontrada', solution: 'Cadastre a conta no Plano de Contas antes de tentar usá-la em lançamentos.' },
      { error: 'Período já fechado', solution: 'Reabre o período em Configurações > Períodos Contábeis ou corrija a data.' },
    ],
    faqs: [
      { question: 'O que é débito e crédito na prática?', answer: 'Débito aumenta Ativo e Despesa; crédito aumenta Passivo e Receita. É o oposto do extrato bancário.' },
      { question: 'Posso lançar com data retroativa?', answer: 'Sim, se o período estiver aberto. Evite excessos — cria histórico confuso.' },
    ],
  },

  'balancete': {
    title: 'Balancete de Verificação',
    whatIs: 'Balancete de Verificação é um relatório que lista todas as contas do Plano de Contas com saldo inicial, movimentos de débito e crédito, e saldo final no período. Serve para verificar se a contabilidade está equilibrada e como ponto de partida para o Balanço Patrimonial.',
    whenToUse: 'Use mensalmente para revisar saldos antes de emitir relatórios finais. É a primeira coisa a consultar quando algo não fecha. Use também para revisar fechamento de período.',
    variables: [
      {
        name: 'periodoInicio',
        label: 'Início do Período',
        description: 'Primeiro dia do período a consultar.',
        example: '01/04/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente o primeiro dia do mês.',
      },
      {
        name: 'periodoFim',
        label: 'Fim do Período',
        description: 'Último dia do período.',
        example: '30/04/2026',
        required: true,
        type: 'date',
        helpText: 'Normalmente o último dia do mês.',
      },
      {
        name: 'nivelContas',
        label: 'Nível de Contas',
        description: 'Profundidade do plano de contas a exibir (1 = grupos, 5 = detalhes).',
        example: '3',
        required: true,
        type: 'select',
        helpText: 'Nível 1 = visão geral; Nível 3 = padrão; Nível 5 = máximo detalhe.',
        options: [
          { value: '1', label: 'Nível 1 (Grupos principais)' },
          { value: '2', label: 'Nível 2 (Subgrupos)' },
          { value: '3', label: 'Nível 3 (Padrão)' },
          { value: '4', label: 'Nível 4 (Detalhado)' },
          { value: '5', label: 'Nível 5 (Máximo detalhe)' },
        ],
      },
      {
        name: 'mostrarZeradas',
        label: 'Mostrar Contas Zeradas?',
        description: 'Exibir contas sem movimento no período.',
        example: 'Não',
        required: false,
        type: 'select',
        helpText: 'Ocultar zeradas deixa o relatório mais enxuto.',
        options: [
          { value: 'sim', label: 'Sim, mostrar todas' },
          { value: 'nao', label: 'Não, ocultar zeradas' },
        ],
      },
    ],
    tips: [
      'Gere o balancete antes de emitir Balanço e DRE — erros aparecem aqui primeiro',
      'Saldo final de Ativo deve sempre igualar Passivo + Patrimônio Líquido',
      'Contas com saldo invertido (ex: conta de ativo com crédito) indicam erro de lançamento',
      'Use nível 3 para visão gerencial diária e nível 5 para auditorias',
    ],
    estimatedTime: '2-3 minutos para gerar',
    commonErrors: [
      { error: 'Balancete não fecha (Ativo ≠ Passivo + PL)', solution: 'Procure lançamentos com débito ≠ crédito. Use relatório de partidas em aberto.' },
      { error: 'Conta com saldo invertido', solution: 'Verifique se há lançamentos errados nessa conta. Crédito em conta de ativo = alerta.' },
    ],
    faqs: [
      { question: 'Qual a diferença entre Balancete e Balanço?', answer: 'Balancete é de verificação interna (provisório). Balanço é o relatório oficial fechado.' },
    ],
  },

  'livro-razao': {
    title: 'Livro Razão',
    whatIs: 'Livro Razão exibe todos os lançamentos de uma conta contábil específica em ordem cronológica, com saldo acumulado. Permite rastrear o histórico completo de qualquer conta — como um extrato bancário, mas para qualquer conta do plano.',
    whenToUse: 'Use para investigar saldo inesperado em uma conta, auditar movimentos específicos ou preparar documentação fiscal. É a ferramenta certa para responder "por que essa conta tem este valor?"',
    variables: [
      {
        name: 'contaContabil',
        label: 'Conta Contábil',
        description: 'Código ou nome da conta que deseja investigar.',
        example: '3.1.1.01 — Receita de Prestação de Serviços',
        required: true,
        type: 'select',
        helpText: 'Selecione do Plano de Contas. Você pode buscar por código ou nome.',
      },
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Início do período de consulta.',
        example: '01/01/2026',
        required: true,
        type: 'date',
        helpText: 'Para análise anual, use 01/01/AAAA.',
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Fim do período.',
        example: '31/12/2026',
        required: true,
        type: 'date',
        helpText: 'Para análise anual, use 31/12/AAAA.',
      },
      {
        name: 'ordenacao',
        label: 'Ordenação',
        description: 'Como os lançamentos serão listados.',
        example: 'Por data (mais antigo primeiro)',
        required: false,
        type: 'select',
        helpText: 'Para auditoria use por data. Para encontrar valores use por valor.',
        options: [
          { value: 'data_asc', label: 'Data (mais antigo primeiro)' },
          { value: 'data_desc', label: 'Data (mais recente primeiro)' },
          { value: 'valor_desc', label: 'Valor (maior primeiro)' },
        ],
      },
    ],
    tips: [
      'É a ferramenta certa para entender por que uma conta tem determinado saldo',
      'Compare Razão com extratos bancários para conciliar banco',
      'Lançamentos sem histórico claro ficam difíceis de rastrear — daí a importância do histórico',
      'Guarde Livro Razão em PDF para cada exercício (obrigação legal)',
    ],
    estimatedTime: '1-2 minutos para gerar',
    commonErrors: [
      { error: 'Conta não encontrada', solution: 'Confirme o código da conta no Plano de Contas. Use a busca por nome.' },
    ],
    faqs: [
      { question: 'Para que serve o Razão?', answer: 'É como um extrato de conta bancária, mas para qualquer conta contábil. Mostra todos os movimentos.' },
    ],
  },

  'cadastro-empresa': {
    title: 'Cadastrar / Editar Empresa',
    whatIs: 'Cadastro de empresa é o perfil completo do cliente no sistema. Contém dados fiscais, tributários e de contato que são usados em todas as operações — NF-e, apuração de impostos, SPED e relatórios.',
    whenToUse: 'Use ao integrar uma nova empresa cliente no sistema ou quando houver mudança de dados (endereço, regime tributário, responsável). Dados incorretos aqui causam erros em notas fiscais e declarações.',
    variables: [
      {
        name: 'cnpj',
        label: 'CNPJ',
        description: 'CNPJ oficial da empresa, conforme Receita Federal.',
        example: '12.345.678/0001-90',
        required: true,
        type: 'cnpj',
        helpText: 'Ao digitar o CNPJ, o sistema busca automaticamente razão social e endereço na Receita.',
        validationRules: ['14 dígitos', 'CNPJ válido'],
      },
      {
        name: 'razaoSocial',
        label: 'Razão Social',
        description: 'Nome legal completo conforme contrato social.',
        example: 'Padaria Silva Comércio de Alimentos LTDA',
        required: true,
        type: 'text',
        helpText: 'Use exatamente como está no cartão CNPJ. Nomes diferentes causam rejeição de NFe.',
      },
      {
        name: 'nomeFantasia',
        label: 'Nome Fantasia',
        description: 'Nome comercial pelo qual a empresa é conhecida.',
        example: 'Padaria Silva',
        required: false,
        type: 'text',
        helpText: 'Aparece nos relatórios e comunicações. Não precisa ser igual à razão social.',
      },
      {
        name: 'regimeTributario',
        label: 'Regime Tributário',
        description: 'Define como a empresa apura e paga impostos.',
        example: 'Simples Nacional',
        required: true,
        type: 'select',
        helpText: 'Afeta cálculo de impostos, geração de guias e obrigações acessórias. Consulte contador se tiver dúvida.',
        options: [
          { value: 'simples', label: 'Simples Nacional' },
          { value: 'lucro_presumido', label: 'Lucro Presumido' },
          { value: 'lucro_real', label: 'Lucro Real' },
          { value: 'mei', label: 'MEI' },
        ],
      },
      {
        name: 'cnae',
        label: 'CNAE Principal',
        description: 'Código de atividade econômica principal da empresa.',
        example: '1091-1/02 — Fabricação de produtos de padaria e confeitaria',
        required: true,
        type: 'text',
        helpText: 'Confira no cartão CNPJ. O CNAE define qual Anexo do Simples se aplica e os impostos municipais.',
      },
      {
        name: 'endereco',
        label: 'Endereço Completo',
        description: 'Endereço fiscal da empresa (sede).',
        example: 'Rua das Flores, 100, Centro, São Paulo – SP, CEP 01310-000',
        required: true,
        type: 'text',
        helpText: 'Usado em NFe, SPED e correspondências. Deve ser o endereço do cartão CNPJ.',
      },
      {
        name: 'contadorResponsavel',
        label: 'Contador Responsável',
        description: 'Nome e CRC do contador responsável pela empresa.',
        example: 'João da Silva — CRC/SP 123456',
        required: false,
        type: 'text',
        helpText: 'Obrigatório para assinar SPED. Cadastre o CRC corretamente.',
      },
    ],
    tips: [
      'Ao digitar o CNPJ, use "Buscar na Receita" para preencher dados automaticamente',
      'Regime tributário errado gera cálculos incorretos de impostos — confirme com o cliente',
      'Mantenha e-mail atualizado — é usado para envio de guias e relatórios',
      'CNAE define qual tabela do Simples se aplica — erro pode causar pagamento a menor (multa) ou a maior (prejuízo)',
    ],
    estimatedTime: '10-15 minutos',
    commonErrors: [
      { error: 'CNPJ não encontrado na Receita', solution: 'Verifique se a empresa está ativa. CNPJs suspensos ou baixados não são encontrados.' },
      { error: 'Regime tributário incompatível com faturamento', solution: 'Simples Nacional tem limite de R$ 4,8 mi/ano. Acima disso, deve ser LP ou LR.' },
    ],
    faqs: [
      { question: 'Posso ter uma empresa em dois escritórios de contabilidade?', answer: 'No sistema, uma empresa tem um contador responsável, mas pode ter usuários de diferentes escritórios.' },
    ],
  },

  'cadastro-usuarios': {
    title: 'Gerenciar Usuários',
    whatIs: 'Gerenciamento de usuários controla quem pode acessar o sistema e o que cada pessoa pode fazer. Perfis diferentes têm permissões diferentes: admin vê tudo, contador opera, visualizador só lê.',
    whenToUse: 'Use ao contratar novo funcionário, admitir estagiário, dar acesso a cliente, ou remover acesso de alguém que saiu. Revise permissões periodicamente por segurança.',
    variables: [
      {
        name: 'nome',
        label: 'Nome Completo',
        description: 'Nome do usuário que terá acesso ao sistema.',
        example: 'Maria Fernanda Costa',
        required: true,
        type: 'text',
        helpText: 'Use nome completo para identificação nos logs de auditoria.',
      },
      {
        name: 'email',
        label: 'E-mail',
        description: 'E-mail de acesso — será o login do usuário.',
        example: 'maria.costa@escritoriocontabil.com.br',
        required: true,
        type: 'email',
        helpText: 'Um convite será enviado para este e-mail. Certifique-se de que é válido.',
        validationRules: ['E-mail válido', 'Único no sistema'],
      },
      {
        name: 'perfil',
        label: 'Perfil de Acesso',
        description: 'Nível de permissão do usuário.',
        example: 'Contador',
        required: true,
        type: 'select',
        helpText: 'Admin: acesso total. Contador: pode operar. Visualizador: só leitura. Use o perfil mínimo necessário.',
        options: [
          { value: 'admin', label: 'Administrador (acesso total)' },
          { value: 'contador', label: 'Contador (pode criar e editar)' },
          { value: 'auxiliar', label: 'Auxiliar Contábil (operações básicas)' },
          { value: 'visualizador', label: 'Visualizador (somente leitura)' },
          { value: 'cliente', label: 'Cliente (acesso restrito à própria empresa)' },
        ],
      },
      {
        name: 'empresas',
        label: 'Empresas com Acesso',
        description: 'Quais empresas o usuário pode ver e operar.',
        example: 'Padaria Silva LTDA, TechCorp ME',
        required: true,
        type: 'multiselect',
        helpText: 'Se for cliente, dê acesso apenas à própria empresa. Contador pode ter acesso a múltiplas.',
      },
    ],
    tips: [
      'Princípio do menor privilégio: dê apenas o acesso necessário para a função',
      'Estagiários e auxiliares devem ser "Auxiliar Contábil", nunca "Admin"',
      'Clientes devem ter perfil "Cliente" com acesso somente à empresa deles',
      'Revise usuários ativos a cada 6 meses e remova quem não usa mais',
      'Todo acesso é rastreado nos logs de auditoria',
    ],
    estimatedTime: '3-5 minutos',
    commonErrors: [
      { error: 'E-mail já cadastrado', solution: 'Cada e-mail só pode ter um usuário. Se a pessoa já existe, edite o perfil existente.' },
      { error: 'Usuário sem empresa associada', solution: 'Todo usuário precisa de pelo menos uma empresa associada para funcionar.' },
    ],
    faqs: [
      { question: 'O usuário recebe convite automático?', answer: 'Sim. Ao criar, ele recebe e-mail com link de ativação válido por 48h.' },
      { question: 'Como remover acesso?', answer: 'Inative o usuário. Dados e logs de auditoria são mantidos mesmo após inativação.' },
    ],
  },

  'apuracao-impostos': {
    title: 'Apuração de Impostos',
    whatIs: 'Apuração é o cálculo de quanto de imposto a empresa deve pagar em determinado período. Cada regime tributário tem sua própria forma de calcular: o Simples Nacional usa tabela progressiva por faturamento, Lucro Presumido usa percentuais fixos, e Lucro Real calcula sobre resultado real.',
    whenToUse: 'Use mensalmente (Simples e Lucro Real) ou trimestralmente (Lucro Presumido) para calcular IRPJ, CSLL, PIS, COFINS e demais tributos do período. Antes de pagar qualquer guia, faça a apuração.',
    variables: [
      {
        name: 'competencia',
        label: 'Competência',
        description: 'Mês/ano do imposto a apurar.',
        example: 'Março/2026',
        required: true,
        type: 'date',
        helpText: 'Use o mês em que as receitas ocorreram, não o mês de pagamento.',
      },
      {
        name: 'regimeTributario',
        label: 'Regime Tributário',
        description: 'Sistema tributário da empresa.',
        example: 'Simples Nacional',
        required: true,
        type: 'select',
        helpText: 'Deve ser o mesmo regime cadastrado na empresa. Confirme antes de apurar.',
        options: [
          { value: 'simples', label: 'Simples Nacional' },
          { value: 'lucro_presumido', label: 'Lucro Presumido' },
          { value: 'lucro_real', label: 'Lucro Real' },
          { value: 'mei', label: 'MEI' },
        ],
      },
      {
        name: 'receitaBruta',
        label: 'Receita Bruta do Período',
        description: 'Total de vendas/serviços do mês antes de deduções.',
        example: 'R$ 85.000,00',
        required: true,
        type: 'currency',
        helpText: 'Soma de todas as notas fiscais emitidas no período. Inclui serviços e produtos.',
      },
      {
        name: 'receitaBruta12Meses',
        label: 'Receita Bruta dos Últimos 12 Meses',
        description: 'Faturamento acumulado dos 12 meses anteriores (usado no Simples Nacional).',
        example: 'R$ 720.000,00',
        required: false,
        type: 'currency',
        helpText: 'Necessário apenas para Simples Nacional. O sistema calcula automaticamente se tiver histórico completo.',
      },
    ],
    tips: [
      'Para Simples Nacional, o faturamento dos últimos 12 meses define a alíquota — acompanhe sempre',
      'Se ultrapassar R$ 4,8 milhões/ano, a empresa sai do Simples automaticamente',
      'Lucro Real pode ser vantajoso em meses de prejuízo — converse com o contador',
      'Apure antes de emitir as guias: nunca pague sem conferir o cálculo',
    ],
    estimatedTime: '5-10 minutos',
    commonErrors: [
      { error: 'Receita 12 meses incompleta', solution: 'Confira se todos os meses têm notas cadastradas. Meses sem notas ≠ meses com R$ 0,00.' },
      { error: 'Regime tributário divergente do cadastro', solution: 'Regime da apuração deve ser igual ao da empresa. Atualize o cadastro se mudou de regime.' },
    ],
    faqs: [
      { question: 'Posso mudar de Simples para Lucro Presumido durante o ano?', answer: 'Não. Mudança de regime só ocorre em janeiro, com pedido de exclusão até o último dia útil de janeiro.' },
    ],
  },

  'das-mensal': {
    title: 'DAS Mensal — Simples Nacional',
    whatIs: 'DAS (Documento de Arrecadação do Simples Nacional) é o boleto único mensal das empresas do Simples Nacional. Ele concentra em um único pagamento: IRPJ, CSLL, PIS, COFINS, IPI, ICMS, ISS e CPP. O valor varia conforme faturamento acumulado.',
    whenToUse: 'Use todo mês para calcular e gerar o DAS. Vencimento: dia 20 do mês seguinte à competência. Não pague sem gerar pelo sistema — valores errados geram multas.',
    variables: [
      {
        name: 'competencia',
        label: 'Competência (Mês/Ano)',
        description: 'Mês de referência do DAS.',
        example: 'Maio/2026',
        required: true,
        type: 'date',
        helpText: 'DAS de maio/2026 vence em 20/06/2026.',
      },
      {
        name: 'receitaBrutaMes',
        label: 'Receita Bruta do Mês',
        description: 'Total de vendas/serviços do mês de competência.',
        example: 'R$ 45.000,00',
        required: true,
        type: 'currency',
        helpText: 'Soma de todas as notas do mês. Inclui canceladas somente se houve substituição.',
      },
      {
        name: 'receitaBruta12Meses',
        label: 'Receita Bruta Acumulada (12 meses)',
        description: 'Faturamento dos últimos 12 meses para determinar alíquota.',
        example: 'R$ 480.000,00',
        required: true,
        type: 'currency',
        helpText: 'Inclui o mês atual. Determina em qual faixa da tabela do Simples a empresa está.',
      },
      {
        name: 'anexoSimples',
        label: 'Anexo do Simples Nacional',
        description: 'Tabela de alíquotas conforme atividade da empresa.',
        example: 'Anexo III — Serviços',
        required: true,
        type: 'select',
        helpText: 'Confira no cartão CNPJ ou com o contador. Anexo errado = DAS errado.',
        options: [
          { value: 'I', label: 'Anexo I — Comércio (compra e venda)' },
          { value: 'II', label: 'Anexo II — Indústria (fabricação)' },
          { value: 'III', label: 'Anexo III — Serviços e locação de bens' },
          { value: 'IV', label: 'Anexo IV — Serviços específicos (construção, limpeza)' },
          { value: 'V', label: 'Anexo V — Serviços de maior fator R' },
        ],
      },
    ],
    tips: [
      'DAS vence no dia 20 do mês seguinte — configure lembrete na agenda',
      'Pague com 1 ou 2 dias de antecedência para evitar falha bancária',
      'Guarde o comprovante de pagamento por 5 anos',
      'Configure débito automático no portal do Simples Nacional para nunca atrasar',
      'Se o faturamento estiver próximo do limite de R$ 4,8 mi, alerte o cliente com antecedência',
    ],
    estimatedTime: '5-8 minutos',
    commonErrors: [
      { error: 'Faturamento 12 meses incorreto', solution: 'Revise todos os meses — um mês errado distorce a alíquota inteira.' },
      { error: 'Anexo do Simples errado', solution: 'Confirme a atividade principal da empresa. Empresas com atividades mistas podem ter dois anexos.' },
    ],
    faqs: [
      { question: 'O que acontece se não pagar o DAS?', answer: 'Multa de 0,33%/dia (máx 20%) + juros Selic. Empresa fica irregular e pode ser excluída do Simples.' },
      { question: 'Posso parcelar DAS em atraso?', answer: 'Sim, pelo portal do Simples Nacional. Mas há acréscimos e condições específicas.' },
    ],
  },

  'auditoria-logs': {
    title: 'Logs de Auditoria',
    whatIs: 'Logs de Auditoria registram automaticamente cada ação no sistema: quem fez, o que fez, quando, e de qual IP. Permitem rastrear alterações, detectar uso indevido e comprovar conformidade em fiscalizações.',
    whenToUse: 'Use para investigar alterações suspeitas, verificar o que um usuário específico fez, comprovar ações em caso de auditoria, ou revisar histórico de mudanças antes de fechar um período.',
    variables: [
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Início do período a consultar.',
        example: '01/05/2026',
        required: true,
        type: 'date',
        helpText: 'Para investigações rápidas, use os últimos 7 dias.',
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Fim do período.',
        example: '31/05/2026',
        required: true,
        type: 'date',
        helpText: 'Evite períodos muito longos — os logs podem ser extensos.',
      },
      {
        name: 'usuario',
        label: 'Filtrar por Usuário',
        description: 'Ver apenas ações de um usuário específico.',
        example: 'joao.silva@empresa.com.br',
        required: false,
        type: 'select',
        helpText: 'Deixe em branco para ver ações de todos os usuários.',
      },
      {
        name: 'tipoAcao',
        label: 'Tipo de Ação',
        description: 'Filtrar por categoria de operação.',
        example: 'Exclusão',
        required: false,
        type: 'select',
        helpText: 'Filtre por "Exclusão" para investigar dados deletados.',
        options: [
          { value: 'todos', label: 'Todos os tipos' },
          { value: 'criacao', label: 'Criação (inserções)' },
          { value: 'edicao', label: 'Edição (alterações)' },
          { value: 'exclusao', label: 'Exclusão (deleções)' },
          { value: 'login', label: 'Login / Logout' },
          { value: 'exportacao', label: 'Exportação de dados' },
        ],
      },
      {
        name: 'empresa',
        label: 'Empresa',
        description: 'Filtrar ações de uma empresa específica.',
        example: 'Padaria Silva LTDA',
        required: false,
        type: 'select',
        helpText: 'Deixe em branco para ver ações em todas as empresas.',
      },
    ],
    tips: [
      'Logs são imutáveis — ninguém pode apagar o histórico de ações',
      'Em caso de suspeita de fraude, exporte logs como PDF e guarde com carimbo de data',
      'Acesse logs periodicamente (quinzenalmente) como boa prática de segurança',
      'IP de acesso é registrado — logins de IPs estranhos merecem atenção',
    ],
    estimatedTime: '1-5 minutos (depende do volume)',
    commonErrors: [
      { error: 'Período muito longo — relatório demora muito', solution: 'Filtre por usuário ou tipo de ação para reduzir volume. Máximo recomendado: 90 dias.' },
    ],
    faqs: [
      { question: 'Por quanto tempo logs são guardados?', answer: 'Por padrão, 5 anos. Conforme LGPD e normas contábeis.' },
      { question: 'Posso apagar um log?', answer: 'Não. Logs de auditoria são imutáveis por design. Isso é uma garantia de segurança.' },
    ],
  },

  'obrigacoes-acessorias': {
    title: 'Obrigações Acessórias (Legacy key)',
    whatIs: 'Obrigações Acessórias são declarações e documentos que empresas devem entregar ao governo (além de impostos). Ex: DCTF, DIRF, SINTEGRA, SPED Fiscal.',
    whenToUse: 'Use para controlar prazos e gerar arquivos de obrigações mensais, trimestrais e anuais.',
    variables: [
      {
        name: 'tipoObrigacao',
        label: 'Tipo de Obrigação',
        description: 'Qual declaração gerar.',
        example: 'DCTF',
        required: true,
        type: 'select',
        helpText: 'Escolha conforme obrigação do mês.',
        options: [
          { value: 'dctf', label: 'DCTF' },
          { value: 'dirf', label: 'DIRF' },
          { value: 'sintegra', label: 'SINTEGRA' },
          { value: 'sped_fiscal', label: 'SPED Fiscal' },
        ],
      },
      {
        name: 'competencia',
        label: 'Competência',
        description: 'Período de referência.',
        example: '05/2026',
        required: true,
        type: 'date',
        helpText: 'Formato MM/AAAA.',
      },
    ],
    tips: [
      'Configure alertas de prazo',
      'Valide arquivos antes de enviar',
      'Guarde recibos por 5 anos',
    ],
    estimatedTime: '10-20 minutos',
  },
};

// =======================================================================
// SERVICES_HELP v2 — Interface compacta para SmartTooltip e ServiceOnboarding
// Exporta todos os 18 serviços com campos (fields), dicas e exemplos práticos
// =======================================================================

export interface FieldHelp {
  name: string;
  label: string;
  description: string;
  example: string;
  required: boolean;
  type: 'text' | 'number' | 'date' | 'select' | 'cnpj' | 'currency' | 'email';
  tips?: string[];
}

export interface ServiceHelpV2 {
  id: string;
  title: string;
  whatIs: string;
  whenToUse: string;
  estimatedTime: string;
  fields: FieldHelp[];
  tips: string[];
  commonErrors: string[];
  examples: {
    title: string;
    description: string;
  }[];
}

export const SERVICES_HELP: Record<string, ServiceHelpV2> = {

  // ─── 1. NF-e ───────────────────────────────────────────────────────────────
  'documento-lookup': {
    id: 'documento-lookup',
    title: 'Busca CNPJ/CPF',
    whatIs:
      'Serviço de consulta cadastral que identifica automaticamente CPF ou CNPJ e busca dados básicos para preenchimento de cadastro e emissão de documentos.',
    whenToUse:
      'Use antes de emitir NF-e ou cadastrar um cliente/fornecedor quando precisar completar nome, endereço e validação documental.',
    estimatedTime: '10-20 segundos',
    fields: [
      {
        name: 'documento',
        label: 'CPF ou CNPJ',
        description: 'Documento a ser consultado. Pode ser CPF (11 dígitos) ou CNPJ (14 dígitos).',
        example: '12.345.678/0001-90 ou 123.456.789-09',
        required: true,
        type: 'cnpj',
        tips: ['Digite somente números', 'CPF com 11 dígitos e CNPJ com 14'],
      },
    ],
    tips: [
      'Use a consulta para reduzir erro de digitação',
      'Complete o cadastro da empresa emissora para a NF-e não bloquear',
      'Se o provedor não responder, revise os dados manualmente',
    ],
    commonErrors: [
      'Documento inválido — verifique os dígitos',
      'Serviço indisponível — tente novamente em alguns instantes',
      'CNPJ/CPF não encontrado — confira se o cadastro está ativo',
    ],
    examples: [
      { title: 'NF-e com destinatário cadastrado', description: 'Digita o CNPJ e preenche razão social e endereço automaticamente.' },
      { title: 'Cadastro de fornecedor', description: 'Consulta o documento para evitar erro no endereço e na razão social.' },
    ],
  },
  'nfe-emissao': {
    id: 'nfe-emissao',
    title: 'Emissão de NF-e',
    whatIs:
      'A Nota Fiscal Eletrônica (NF-e) é o documento fiscal digital obrigatório para toda venda de produtos. ' +
      'Ela substitui a nota em papel, tem validade jurídica e é transmitida automaticamente para a SEFAZ antes de sair da empresa.',
    whenToUse:
      'Use sempre que vender um produto físico — independente do valor. ' +
      'Para prestação de serviços, emita NFS-e (municipal). Emita antes do transporte da mercadoria.',
    estimatedTime: '5-10 minutos',
    fields: [
      {
        name: 'destinatario',
        label: 'Destinatário (CNPJ ou CPF)',
        description: 'Quem está comprando. CNPJ para empresa, CPF para pessoa física.',
        example: '12.345.678/0001-90',
        required: true,
        type: 'cnpj',
        tips: ['Confira o CNPJ no cartão da empresa compradora', 'CPF deve ter 11 dígitos'],
      },
      {
        name: 'naturezaOperacao',
        label: 'Natureza da Operação',
        description: 'Tipo da venda — define o tratamento fiscal da nota.',
        example: 'Venda de Mercadoria',
        required: true,
        type: 'select',
        tips: ['Para venda normal use "Venda de Mercadoria"', 'Para devolução, use natureza de devolução'],
      },
      {
        name: 'produtos',
        label: 'Produtos (NCM, CFOP, Qtd, Valor)',
        description: 'Itens da venda com código fiscal, quantidade e preço unitário.',
        example: 'Notebook Dell, NCM 8471.30.12, CFOP 5102, 2 un., R$ 3.500,00',
        required: true,
        type: 'text',
        tips: ['NCM obrigatório por produto', 'CFOP 5102 = dentro do estado; 6102 = fora do estado'],
      },
      {
        name: 'formaPagamento',
        label: 'Forma de Pagamento',
        description: 'Como o cliente vai pagar pela mercadoria.',
        example: 'PIX',
        required: true,
        type: 'select',
        tips: ['Deve refletir o acordado com o cliente'],
      },
      {
        name: 'transportadora',
        label: 'Transportadora',
        description: 'Empresa que vai entregar a mercadoria (se houver).',
        example: 'Transportes Rápidos LTDA — CNPJ 11.222.333/0001-44',
        required: false,
        type: 'text',
        tips: ['Deixe em branco para retirada no local', 'CNPJ da transportadora é obrigatório se preenchido'],
      },
    ],
    tips: [
      'Tenha o CNPJ/CPF do cliente antes de começar — sem ele a nota não pode ser emitida',
      'Confira o NCM de cada produto: código errado pode gerar autuação fiscal',
      'Após autorização SEFAZ, guarde o XML por 5 anos (obrigação legal)',
      'Cancelamento só é possível em até 24 horas após autorização',
      'Para vendas fora do estado, verifique alíquota de ICMS do estado de destino',
    ],
    commonErrors: [
      'CNPJ do destinatário inválido — verifique todos os 14 dígitos',
      'Produto sem NCM cadastrado — cadastre o NCM em Menu > Produtos antes de emitir',
      'CFOP incompatível com o estado de destino — 5102 é dentro do estado; 6102 é fora',
      'Data de emissão futura — a data não pode ser maior que hoje',
    ],
    examples: [
      {
        title: 'Venda de notebook para empresa',
        description:
          'TechStore vende 2 notebooks Dell para a empresa ABC LTDA (SP). ' +
          'Preenche: CNPJ da ABC, natureza "Venda de Mercadoria", produto com NCM 8471.30.12, ' +
          'CFOP 5102 (ambas em SP), pagamento PIX. Sistema transmite para SEFAZ e gera DANFE.',
      },
      {
        title: 'Venda interestadual para cliente de MG',
        description:
          'Mesma TechStore vende para empresa em Minas Gerais. Usa CFOP 6102 (saída interestadual) ' +
          'e verifica alíquota de ICMS para MG. O sistema calcula a diferença de alíquota automaticamente.',
      },
    ],
  },

  // ─── 2. Lançamento Contábil ─────────────────────────────────────────────────
  'lancamento-contabil': {
    id: 'lancamento-contabil',
    title: 'Lançamento Contábil',
    whatIs:
      'Lançamento contábil é o registro de qualquer operação financeira pelo método das partidas dobradas: ' +
      'para cada R$ 1 debitado em uma conta, R$ 1 é creditado em outra. ' +
      'É a base de toda a contabilidade e alimenta Balanço, DRE e Razão.',
    whenToUse:
      'Use para registrar compras, vendas, pagamentos, recebimentos, depreciação, provisões. ' +
      'Qualquer documento fiscal (nota, boleto, recibo) deve virar um lançamento.',
    estimatedTime: '3-5 minutos por lançamento',
    fields: [
      {
        name: 'data',
        label: 'Data do Lançamento',
        description: 'Data em que a operação ocorreu (competência) ou foi paga (caixa).',
        example: '15/05/2026',
        required: true,
        type: 'date',
        tips: ['Use a data do documento fiscal', 'Lançamentos retroativos só em períodos abertos'],
      },
      {
        name: 'historico',
        label: 'Histórico',
        description: 'Descrição da operação — ficará registrada permanentemente.',
        example: 'Pagamento aluguel escritório mai/2026 — Recibo 1234',
        required: true,
        type: 'text',
        tips: ['Inclua: o que foi, de quem/para quem, número do documento', 'Mínimo 10 caracteres'],
      },
      {
        name: 'contaDebito',
        label: 'Conta Débito',
        description: 'Conta que recebe o valor. Débito aumenta Ativos e Despesas.',
        example: '3.1.2.01 — Despesas de Aluguel',
        required: true,
        type: 'select',
        tips: ['Para despesas, débite a conta de despesa', 'Selecione do Plano de Contas'],
      },
      {
        name: 'contaCredito',
        label: 'Conta Crédito',
        description: 'Conta de onde sai o valor. Crédito reduz Ativos.',
        example: '1.1.2.01 — Banco Bradesco',
        required: true,
        type: 'select',
        tips: ['Para pagamento via banco, crédite a conta bancária', 'Para compra a prazo, crédite Fornecedores'],
      },
      {
        name: 'valor',
        label: 'Valor',
        description: 'Valor da operação. Débito deve sempre igualar o Crédito.',
        example: 'R$ 3.500,00',
        required: true,
        type: 'currency',
        tips: ['Débito = Crédito é lei contábil, não opcional', 'Valor não pode ser zero'],
      },
      {
        name: 'centroCusto',
        label: 'Centro de Custo',
        description: 'Departamento ou projeto ao qual a operação pertence.',
        example: 'Administrativo',
        required: false,
        type: 'select',
        tips: ['Opcional mas recomendado para análise gerencial', 'Facilita relatórios por área'],
      },
    ],
    tips: [
      'Sempre tenha um documento de suporte antes de lançar — nota, recibo ou comprovante',
      'Débito = Crédito é uma regra absoluta. Se não bater, há um erro',
      'Histórico claro economiza horas de revisão em auditorias futuras',
      'Centre de custo facilita análise de despesas por departamento',
      'Lance no prazo: lançamentos retroativos em períodos fechados geram retrabalho',
    ],
    commonErrors: [
      'Débito diferente de Crédito — é o erro mais comum; revise os valores',
      'Conta não existe no Plano de Contas — cadastre antes de usar',
      'Período já fechado — reabre em Configurações > Períodos Contábeis',
      'Histórico vago como "pagamento" — sem detalhe é inútil na auditoria',
    ],
    examples: [
      {
        title: 'Pagamento de aluguel de escritório',
        description:
          'Data: 05/05/2026. Histórico: "Aluguel escritório mai/2026 — Recibo 88". ' +
          'Débito: 3.1.2.01 Despesas de Aluguel. Crédito: 1.1.2.01 Banco Bradesco. Valor: R$ 5.000,00.',
      },
      {
        title: 'Compra de estoque a prazo',
        description:
          'Data: 10/05/2026. Histórico: "Compra estoque ref. NF 9876 — Fornecedor XYZ". ' +
          'Débito: 1.1.4.01 Estoque de Mercadorias. Crédito: 2.1.1.01 Fornecedores. Valor: R$ 12.000,00.',
      },
    ],
  },

  // ─── 3. Contas a Receber ────────────────────────────────────────────────────
  'contas-receber': {
    id: 'contas-receber',
    title: 'Contas a Receber',
    whatIs:
      'Contas a Receber controla todos os valores que seus clientes devem pagar. ' +
      'Cada venda a prazo gera um "título a receber". ' +
      'O módulo acompanha vencimentos, emite cobranças e registra recebimentos.',
    whenToUse:
      'Use sempre que fizer uma venda a prazo ou quiser registrar uma cobrança a receber. ' +
      'Acompanhe diariamente para evitar inadimplência e garantir fluxo de caixa.',
    estimatedTime: '2-4 minutos',
    fields: [
      {
        name: 'cliente',
        label: 'Cliente',
        description: 'Nome ou razão social de quem deve pagar.',
        example: 'TechCorp Soluções LTDA',
        required: true,
        type: 'select',
        tips: ['Se não existir no cadastro, cadastre primeiro', 'Busque por nome ou CNPJ'],
      },
      {
        name: 'descricao',
        label: 'Descrição',
        description: 'O que está sendo cobrado — referência da venda ou serviço.',
        example: 'Serviços de consultoria ref. contrato 001/2026',
        required: true,
        type: 'text',
        tips: ['Inclua número da nota fiscal ou contrato', 'Descrição clara facilita identificação no extrato'],
      },
      {
        name: 'valor',
        label: 'Valor a Receber',
        description: 'Valor total que o cliente deve pagar.',
        example: 'R$ 8.500,00',
        required: true,
        type: 'currency',
        tips: ['Valor cheio sem desconto — desconto é informado no recebimento', 'Recebimentos parciais são permitidos'],
      },
      {
        name: 'dataVencimento',
        label: 'Data de Vencimento',
        description: 'Quando o cliente deve pagar sem multa.',
        example: '15/06/2026',
        required: true,
        type: 'date',
        tips: ['Após o vencimento, o título entra em atraso automaticamente', 'Defina alerta 3 dias antes'],
      },
      {
        name: 'formaCobranca',
        label: 'Forma de Cobrança',
        description: 'Como você vai cobrar o cliente.',
        example: 'Boleto Bancário',
        required: true,
        type: 'select',
        tips: ['Boleto gera cobrança automática', 'PIX: envie chave por e-mail'],
      },
    ],
    tips: [
      'Envie a cobrança assim que criar o título — não espere o vencimento chegar',
      'Configure alertas para 5 dias antes do vencimento',
      'Marque como "recebido" apenas quando o dinheiro entrar na conta bancária',
      'Taxa de inadimplência ideal é abaixo de 2% — monitore mensalmente',
      'Para clientes recorrentes, configure cobrança automática',
    ],
    commonErrors: [
      'Cliente não cadastrado — cadastre em Menu > Clientes antes de criar o título',
      'Data de vencimento anterior à emissão — vencimento deve ser futuro',
      'Baixar como recebido antes do dinheiro entrar — isso distorce o fluxo de caixa',
    ],
    examples: [
      {
        title: 'Fatura mensal de serviços',
        description:
          'Escritório contábil emite fatura para cliente TechCorp. ' +
          'Valor: R$ 1.200,00. Vencimento: dia 10 do mês. Forma: PIX. ' +
          'Sistema envia lembrete 3 dias antes e notifica ao receber.',
      },
      {
        title: 'Venda parcelada em 3x',
        description:
          'Venda de R$ 3.000,00 parcelada em 3x sem juros. ' +
          'Sistema gera automaticamente 3 títulos de R$ 1.000,00 com vencimentos em 30, 60 e 90 dias.',
      },
    ],
  },

  // ─── 4. Contas a Pagar ──────────────────────────────────────────────────────
  'contas-pagar': {
    id: 'contas-pagar',
    title: 'Contas a Pagar',
    whatIs:
      'Contas a Pagar controla todos os valores que sua empresa deve pagar. ' +
      'Registra notas de fornecedores, boletos, aluguéis, impostos — qualquer obrigação financeira futura. ' +
      'Evita atrasos, multas e surpresas no caixa.',
    whenToUse:
      'Registre imediatamente ao receber qualquer nota fiscal, boleto ou documento de cobrança. ' +
      'Nunca deixe para depois: registro tardio causa esquecimento e atraso.',
    estimatedTime: '2-4 minutos',
    fields: [
      {
        name: 'fornecedor',
        label: 'Fornecedor / Credor',
        description: 'Empresa ou pessoa para quem você deve pagar.',
        example: 'Locadora Imóveis Silva LTDA',
        required: true,
        type: 'select',
        tips: ['Cadastre o fornecedor antes se for novo', 'Busque por nome ou CNPJ'],
      },
      {
        name: 'descricao',
        label: 'Descrição',
        description: 'O que está sendo pago — referência do documento.',
        example: 'Aluguel escritório mai/2026 — Contrato 55/2024',
        required: true,
        type: 'text',
        tips: ['Inclua número da nota ou contrato', 'Quanto mais detalhado, mais fácil de conferir depois'],
      },
      {
        name: 'valor',
        label: 'Valor a Pagar',
        description: 'Valor total conforme nota fiscal ou boleto.',
        example: 'R$ 4.500,00',
        required: true,
        type: 'currency',
        tips: ['Copie o valor exato do documento', 'Diferença de centavos gera problema na conciliação'],
      },
      {
        name: 'dataVencimento',
        label: 'Data de Vencimento',
        description: 'Prazo limite para pagar sem multa.',
        example: '25/05/2026',
        required: true,
        type: 'date',
        tips: ['Configure alerta 3 dias antes', 'Multa típica: 2% + 1% ao mês de juros'],
      },
      {
        name: 'categoriaDespesa',
        label: 'Categoria de Despesa',
        description: 'Tipo de gasto para análise de custos.',
        example: 'Aluguel',
        required: true,
        type: 'select',
        tips: ['Categoria correta permite analisar despesas por tipo', 'Usada no DRE e relatórios gerenciais'],
      },
      {
        name: 'formaPagamento',
        label: 'Forma de Pagamento',
        description: 'Como você vai pagar.',
        example: 'Transferência Bancária',
        required: true,
        type: 'select',
        tips: ['Boleto tem prazo de compensação de 1 dia útil', 'PIX é imediato'],
      },
    ],
    tips: [
      'Registre ao receber o documento — nunca "depois"',
      'Organize por data de vencimento para pagar no prazo certo',
      'Negocie prazos maiores com fornecedores para melhorar fluxo de caixa',
      'Anexe sempre o boleto/nota digitalizados para auditoria',
      'Configure débito automático para despesas fixas (aluguel, assinaturas)',
    ],
    commonErrors: [
      'Fornecedor não cadastrado — cadastre antes em Menu > Fornecedores',
      'Categoria de despesa errada — afeta DRE e relatórios gerenciais',
      'Registrar pagamento antes de pagar de fato — distorce fluxo de caixa',
    ],
    examples: [
      {
        title: 'Boleto de aluguel do escritório',
        description:
          'Recebe boleto de aluguel de R$ 5.000,00 com vencimento 10/05. ' +
          'Registra: fornecedor "Imóveis XYZ", descrição "Aluguel maio/2026", categoria "Aluguel", ' +
          'vencimento 10/05. Sistema alerta em 07/05. Paga e baixa.',
      },
      {
        title: 'Nota fiscal de fornecedor de material',
        description:
          'Recebe NF de R$ 12.000,00 de papelaria. Registra em "Contas a Pagar" ' +
          'com categoria "Material de Escritório", vencimento 30 dias. Anexa o PDF da NF.',
      },
    ],
  },

  // ─── 5. Fluxo de Caixa ─────────────────────────────────────────────────────
  'fluxo-caixa': {
    id: 'fluxo-caixa',
    title: 'Fluxo de Caixa',
    whatIs:
      'Fluxo de Caixa mostra todas as entradas e saídas de dinheiro em um período. ' +
      'Responde: "Quanto dinheiro tenho hoje? Quanto vou ter em 30 dias?". ' +
      'É diferente do DRE (que usa competência) — Fluxo usa caixa (quando o dinheiro movimentou).',
    whenToUse:
      'Consulte diariamente para acompanhar saúde financeira. ' +
      'Verifique antes de fazer investimentos ou contratar. ' +
      'É essencial para evitar cheque especial e renegociar prazos com antecedência.',
    estimatedTime: '1-2 minutos para consultar',
    fields: [
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Primeiro dia do período a analisar.',
        example: '01/01/2026',
        required: true,
        type: 'date',
        tips: ['Use início do mês para análise mensal'],
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Último dia do período.',
        example: '31/01/2026',
        required: true,
        type: 'date',
        tips: ['Para previsão futura, coloque data no futuro', 'Sistema usa dados reais + previstos'],
      },
      {
        name: 'categorias',
        label: 'Categorias a Filtrar',
        description: 'Ver apenas determinadas categorias de entrada ou saída.',
        example: 'Vendas, Fornecedores',
        required: false,
        type: 'select',
        tips: ['Deixe em branco para ver tudo', 'Filtre por categoria para análise específica'],
      },
      {
        name: 'tipo',
        label: 'Tipo de Movimentação',
        description: 'Mostrar entradas, saídas ou ambos.',
        example: 'Ambos',
        required: false,
        type: 'select',
        tips: ['Ambos = visão completa do período'],
      },
    ],
    tips: [
      'Atualize lançamentos diariamente para ter dados precisos',
      'Use a visão de previsão (futura) para antecipar problemas de caixa',
      'Compare "realizado" vs "previsto" para melhorar suas estimativas',
      'Configure um saldo mínimo de segurança (ex: R$ 20.000) como alerta',
      'Fluxo negativo previsto com 2 semanas de antecedência permite negociar',
    ],
    commonErrors: [
      'Período muito curto — consulte sempre ao menos 30 dias à frente',
      'Lançamentos pendentes não registrados — fluxo incompleto induz decisões erradas',
      'Confundir Fluxo de Caixa com DRE — são complementares, não substitutos',
    ],
    examples: [
      {
        title: 'Ver fluxo do mês de janeiro 2026',
        description:
          'Seleciona período 01/01/2026 a 31/01/2026, tipo "Ambos". ' +
          'Sistema mostra: entradas R$ 120.000, saídas R$ 95.000, saldo R$ 25.000. ' +
          'Gráfico diário mostra pico de saídas no dia 10 (pagamento de folha).',
      },
      {
        title: 'Projeção dos próximos 60 dias',
        description:
          'Seleciona hoje até 60 dias no futuro. Sistema projeta usando contas a receber ' +
          'e a pagar já cadastradas. Detecta semana crítica com saldo negativo previsto.',
      },
    ],
  },

  // ─── 6. Apuração de Impostos ────────────────────────────────────────────────
  'apuracao-impostos': {
    id: 'apuracao-impostos',
    title: 'Apuração de Impostos',
    whatIs:
      'Apuração é o cálculo oficial de quanto a empresa deve pagar de imposto em determinado período. ' +
      'Cada regime tem sua forma: Simples usa tabela por faturamento, ' +
      'Lucro Presumido usa percentuais fixos e Lucro Real usa o resultado contábil real.',
    whenToUse:
      'Use mensalmente (Simples, Lucro Real mensal) ou trimestralmente (Lucro Presumido). ' +
      'Sempre apure antes de pagar qualquer guia — nunca pague sem calcular.',
    estimatedTime: '5-10 minutos',
    fields: [
      {
        name: 'competencia',
        label: 'Competência',
        description: 'Mês e ano do imposto a apurar.',
        example: 'Março/2026',
        required: true,
        type: 'date',
        tips: ['Competência = mês em que ocorreu a receita', 'Diferente do mês de pagamento da guia'],
      },
      {
        name: 'regimeTributario',
        label: 'Regime Tributário',
        description: 'Sistema de tributação da empresa.',
        example: 'Simples Nacional — Anexo III',
        required: true,
        type: 'select',
        tips: ['Deve ser igual ao cadastro da empresa', 'Regime errado = imposto errado'],
      },
      {
        name: 'receitaBruta',
        label: 'Receita Bruta do Período',
        description: 'Total de faturamento do mês (antes de deduções).',
        example: 'R$ 85.000,00',
        required: true,
        type: 'currency',
        tips: ['Soma de todas as notas emitidas', 'Inclui tanto produtos quanto serviços'],
      },
      {
        name: 'receitaBruta12Meses',
        label: 'Receita Bruta Acumulada 12 Meses',
        description: 'Faturamento total dos últimos 12 meses (para Simples Nacional).',
        example: 'R$ 720.000,00',
        required: false,
        type: 'currency',
        tips: ['Necessário apenas para Simples Nacional', 'Sistema calcula automaticamente se tiver histórico'],
      },
    ],
    tips: [
      'Para Simples Nacional, o faturamento dos últimos 12 meses determina a alíquota',
      'Se ultrapassar R$ 4,8 milhões/ano, a empresa sai do Simples — alerte com antecedência',
      'Lucro Real pode ser vantajoso em meses de prejuízo operacional',
      'Apure antes de emitir qualquer guia — nunca pague estimativa sem calcular',
    ],
    commonErrors: [
      'Receita 12 meses incompleta — um mês faltando distorce a alíquota do Simples',
      'Regime tributário diferente do cadastro da empresa — revise o cadastro',
      'Não incluir todas as notas — canceladas que geraram substituição devem entrar',
    ],
    examples: [
      {
        title: 'Apurar DAS de março 2026 — Simples Nacional Anexo III',
        description:
          'Empresa de TI no Simples Anexo III. Receita de março: R$ 80.000. ' +
          'Receita 12 meses: R$ 750.000 (faixa 3, alíquota ~13,5%). ' +
          'Sistema calcula DAS de R$ 10.800 a pagar até 20/04/2026.',
      },
      {
        title: 'Apurar IRPJ/CSLL Lucro Presumido — Trimestre 1/2026',
        description:
          'Empresa de serviços no Lucro Presumido. Receita do trimestre: R$ 300.000. ' +
          'Percentual de presunção: 32%. Base: R$ 96.000. ' +
          'IRPJ 15%: R$ 14.400. CSLL 9%: R$ 8.640. Total: R$ 23.040.',
      },
    ],
  },

  // ─── 7. DAS Mensal ──────────────────────────────────────────────────────────
  'das-mensal': {
    id: 'das-mensal',
    title: 'DAS Mensal — Simples Nacional',
    whatIs:
      'O DAS (Documento de Arrecadação do Simples Nacional) é o boleto único mensal das empresas no Simples. ' +
      'Reúne IRPJ, CSLL, PIS, COFINS, CPP e ICMS/ISS em um único pagamento. ' +
      'O valor é calculado com base no faturamento acumulado dos últimos 12 meses.',
    whenToUse:
      'Todo mês, para empresas no Simples Nacional. ' +
      'Vence no dia 20 do mês seguinte à competência. ' +
      'DAS de janeiro/2026 vence em 20/02/2026.',
    estimatedTime: '5-8 minutos',
    fields: [
      {
        name: 'competencia',
        label: 'Competência (Mês/Ano)',
        description: 'Mês de referência do DAS.',
        example: 'Maio/2026',
        required: true,
        type: 'date',
        tips: ['DAS de mai/2026 vence em 20/jun/2026', 'Não confunda competência com vencimento'],
      },
      {
        name: 'receitaBrutaMes',
        label: 'Receita Bruta do Mês',
        description: 'Faturamento total do mês de competência.',
        example: 'R$ 45.000,00',
        required: true,
        type: 'currency',
        tips: ['Soma de todas as notas do mês', 'Exclua apenas cancelamentos formais'],
      },
      {
        name: 'receitaBruta12Meses',
        label: 'Receita Acumulada (12 meses)',
        description: 'Soma dos últimos 12 meses para determinar a faixa de alíquota.',
        example: 'R$ 480.000,00',
        required: true,
        type: 'currency',
        tips: [
          'Inclui o mês atual',
          'Define em qual faixa da tabela progressiva a empresa está',
          'Quanto maior o acumulado, maior a alíquota',
        ],
      },
      {
        name: 'anexoSimples',
        label: 'Anexo do Simples Nacional',
        description: 'Tabela de alíquotas conforme atividade econômica.',
        example: 'Anexo III — Serviços',
        required: true,
        type: 'select',
        tips: ['Confira no cartão CNPJ ou com o contador', 'Anexo errado = DAS calculado errado'],
      },
    ],
    tips: [
      'Configure débito automático no portal do Simples Nacional — nunca atrase',
      'DAS vence dia 20 do mês seguinte — pague com 2 dias de folga',
      'Guarde comprovante de pagamento por mínimo 5 anos',
      'Acompanhe se está próximo do limite de R$ 4,8 mi/ano para não ser excluído',
      'Empresas que não pagam 3 DAS consecutivos são excluídas do Simples',
    ],
    commonErrors: [
      'Faturamento 12 meses incompleto — um mês errado afeta a alíquota de todos os próximos',
      'Anexo errado — empresa de serviços no Anexo I (comércio) paga imposto incorreto',
      'Competência errada — pagar DAS do mês errado não quita a competência correta',
    ],
    examples: [
      {
        title: 'Gerar DAS de maio 2026',
        description:
          'Empresa de consultoria (Anexo III). Receita de maio: R$ 60.000. ' +
          'Acumulado 12 meses: R$ 650.000 (faixa 3, alíquota efetiva ~14,5%). ' +
          'DAS a pagar: R$ 8.700 até 20/06/2026.',
      },
    ],
  },

  // ─── 8. Balanço Patrimonial ─────────────────────────────────────────────────
  'balanco-patrimonial': {
    id: 'balanco-patrimonial',
    title: 'Balanço Patrimonial',
    whatIs:
      'O Balanço Patrimonial é uma "fotografia" do patrimônio da empresa em uma data específica. ' +
      'Mostra o que a empresa possui (Ativo), o que deve (Passivo) e o capital dos sócios (Patrimônio Líquido). ' +
      'A regra matemática é sempre: Ativo = Passivo + Patrimônio Líquido.',
    whenToUse:
      'Use ao fechar o ano fiscal, ao solicitar empréstimos bancários, para apresentar a investidores, ' +
      'ou para entender a saúde patrimonial da empresa. Obrigatório anualmente.',
    estimatedTime: '2-3 minutos para gerar',
    fields: [
      {
        name: 'dataReferencia',
        label: 'Data de Referência',
        description: 'Data para a qual o balanço será calculado (normalmente último dia do mês/ano).',
        example: '31/12/2025',
        required: true,
        type: 'date',
        tips: ['Use sempre o último dia do mês', 'Certifique-se que todos os lançamentos do período estão registrados'],
      },
      {
        name: 'tipoDemonstracao',
        label: 'Tipo de Demonstração',
        description: 'Nível de detalhe do relatório.',
        example: 'Sintético (Resumido)',
        required: true,
        type: 'select',
        tips: ['Sintético para apresentação a investidores', 'Analítico para análise interna detalhada'],
      },
      {
        name: 'compararPeriodoAnterior',
        label: 'Comparar com Período Anterior?',
        description: 'Exibir balanço de dois períodos lado a lado para comparação.',
        example: '31/12/2024',
        required: false,
        type: 'date',
        tips: ['Útil para mostrar crescimento patrimonial', 'Banco e investidores sempre pedem comparativo'],
      },
    ],
    tips: [
      'Feche todos os lançamentos do período antes de gerar — dados incompletos = balanço errado',
      'Ativo deve sempre igualar Passivo + PL; se não fechar, há erro nos lançamentos',
      'Gere mensalmente para acompanhar evolução patrimonial',
      'Balanços anuais devem ser guardados por tempo indeterminado',
      'Use comparativo com ano anterior para evidenciar crescimento',
    ],
    commonErrors: [
      'Ativo ≠ Passivo + PL — indica lançamentos com débito ≠ crédito; use o balancete para localizar',
      'Gerar antes de fechar lançamentos — dados incompletos tornam o balanço inválido',
      'Data de referência no meio do mês — sempre use o último dia do mês',
    ],
    examples: [
      {
        title: 'Balanço em 31/12/2025',
        description:
          'Empresa fecha o exercício de 2025. Gera balanço em 31/12/2025, sintético, ' +
          'com comparativo de 31/12/2024. Mostra: Ativo Total R$ 850.000, ' +
          'Passivo R$ 320.000, PL R$ 530.000. Crescimento de 18% sobre 2024.',
      },
    ],
  },

  // ─── 9. DRE ────────────────────────────────────────────────────────────────
  'dre': {
    id: 'dre',
    title: 'DRE — Demonstração do Resultado',
    whatIs:
      'A DRE mostra se a empresa teve lucro ou prejuízo em um período. ' +
      'Parte das Receitas, subtrai Custos, Despesas e Impostos, chegando ao Resultado Líquido. ' +
      'Usa regime de competência: registra quando a receita/despesa ocorreu, não quando o dinheiro moveu.',
    whenToUse:
      'Use mensalmente para saber o resultado real da empresa. ' +
      'Indispensável para decisões de preço, corte de custos e apresentação a sócios. ' +
      'Obrigatório anualmente para entrega ao Fisco.',
    estimatedTime: '2-3 minutos',
    fields: [
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Início do período da DRE.',
        example: '01/01/2026',
        required: true,
        type: 'date',
        tips: ['Para DRE mensal: primeiro dia do mês', 'Para DRE anual: 01/01/AAAA'],
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Fim do período.',
        example: '31/03/2026',
        required: true,
        type: 'date',
        tips: ['Para DRE mensal: último dia do mês', 'Para trimestral: 31/03, 30/06, 30/09 ou 31/12'],
      },
      {
        name: 'nivelDetalhe',
        label: 'Nível de Detalhe',
        description: 'Quantidade de informação exibida no relatório.',
        example: 'Padrão',
        required: true,
        type: 'select',
        tips: ['Resumido: para reunião com sócios', 'Detalhado: para análise de custos e auditoria'],
      },
    ],
    tips: [
      'Gere mensalmente — resultado mensal ruim detectado cedo permite correção',
      'Compare com o mês anterior para identificar tendências',
      'Margem Líquida = Lucro Líquido ÷ Receita Total: objetivo mínimo de 10%',
      'Se estiver no prejuízo, analise qual grupo de despesas está acima do normal',
      'DRE e Fluxo de Caixa são complementares — use os dois juntos',
    ],
    commonErrors: [
      'Período com lançamentos incompletos — DRE será imprecisa; feche os lançamentos antes',
      'Confundir Lucro Bruto com Lucro Líquido — impostos e despesas financeiras ainda faltam descontar',
      'Usar DRE para planejamento de caixa — para isso, use Fluxo de Caixa',
    ],
    examples: [
      {
        title: 'DRE do 1º trimestre de 2026',
        description:
          'Período: 01/01/2026 a 31/03/2026. Nível: Padrão. ' +
          'Resultado: Receita R$ 360.000, CPV R$ 180.000, Lucro Bruto R$ 180.000, ' +
          'Despesas R$ 90.000, Lucro Líquido R$ 90.000 (margem 25%).',
      },
    ],
  },

  // ─── 10. Balancete ─────────────────────────────────────────────────────────
  'balancete': {
    id: 'balancete',
    title: 'Balancete de Verificação',
    whatIs:
      'O Balancete lista todas as contas do Plano de Contas com saldo inicial, ' +
      'débitos, créditos e saldo final do período. ' +
      'É o "raio-X" da contabilidade: se os lançamentos estão corretos, o balancete fecha (Ativo = Passivo + PL).',
    whenToUse:
      'Use antes de gerar Balanço e DRE para verificar que os dados estão corretos. ' +
      'Use também ao investigar por que um relatório não está fechando.',
    estimatedTime: '2-3 minutos para gerar',
    fields: [
      {
        name: 'periodoInicio',
        label: 'Início do Período',
        description: 'Primeiro dia do período a verificar.',
        example: '01/04/2026',
        required: true,
        type: 'date',
      },
      {
        name: 'periodoFim',
        label: 'Fim do Período',
        description: 'Último dia do período.',
        example: '30/04/2026',
        required: true,
        type: 'date',
      },
      {
        name: 'nivelContas',
        label: 'Nível de Contas',
        description: 'Profundidade do plano de contas exibido (1 = grupos, 5 = máximo detalhe).',
        example: '3',
        required: true,
        type: 'select',
        tips: ['Nível 3 é o mais usado no dia a dia', 'Nível 5 para auditoria detalhada'],
      },
      {
        name: 'mostrarZeradas',
        label: 'Mostrar Contas Zeradas?',
        description: 'Exibir contas sem movimento no período.',
        example: 'Não',
        required: false,
        type: 'select',
        tips: ['Ocultar deixa o relatório mais limpo'],
      },
    ],
    tips: [
      'Sempre gere o balancete antes do Balanço Patrimonial — erros aparecem aqui primeiro',
      'Saldo total de débito deve igualar saldo total de crédito',
      'Conta com saldo invertido (ex: Ativo credor) indica erro de lançamento',
      'Use nível 5 para auditorias e nível 3 para verificação rotineira',
    ],
    commonErrors: [
      'Débitos totais ≠ Créditos totais — procure lançamentos desequilibrados',
      'Saldo negativo em conta de Ativo — indica crédito excessivo na conta; confira lançamentos',
    ],
    examples: [
      {
        title: 'Balancete de abril 2026 — nível 3',
        description:
          'Período 01/04 a 30/04/2026, nível 3, sem contas zeradas. ' +
          'Total débitos = R$ 1.240.000 = Total créditos. ' +
          'Balancete equilibrado: seguro gerar Balanço e DRE.',
      },
    ],
  },

  // ─── 11. Livro Razão ───────────────────────────────────────────────────────
  'livro-razao': {
    id: 'livro-razao',
    title: 'Livro Razão',
    whatIs:
      'O Livro Razão exibe todos os lançamentos de uma conta contábil específica em ordem cronológica, ' +
      'com saldo acumulado após cada movimentação. ' +
      'Funciona como um extrato bancário detalhado para qualquer conta do Plano de Contas.',
    whenToUse:
      'Use para investigar saldo inesperado em qualquer conta, rastrear um lançamento específico, ' +
      'ou preparar documentação para auditoria. A resposta para "por que esta conta tem este valor?" está no Razão.',
    estimatedTime: '1-2 minutos para gerar',
    fields: [
      {
        name: 'contaContabil',
        label: 'Conta Contábil',
        description: 'Código ou nome da conta a investigar.',
        example: '3.1.1.01 — Receita de Prestação de Serviços',
        required: true,
        type: 'select',
        tips: ['Busque por código ou nome', 'Pode consultar qualquer conta do Plano de Contas'],
      },
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Início do período de consulta.',
        example: '01/01/2026',
        required: true,
        type: 'date',
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Fim do período.',
        example: '31/12/2026',
        required: true,
        type: 'date',
      },
      {
        name: 'ordenacao',
        label: 'Ordenação',
        description: 'Como os lançamentos serão ordenados.',
        example: 'Por data (mais antigo primeiro)',
        required: false,
        type: 'select',
        tips: ['Para auditoria use por data', 'Para encontrar um valor específico use por valor decrescente'],
      },
    ],
    tips: [
      'É a ferramenta ideal para rastrear por que uma conta tem determinado saldo',
      'Compare o Razão da conta bancária com o extrato real para conciliação',
      'Guarde PDF do Razão para cada exercício — é uma obrigação legal',
      'Para auditorias, ordene por data e exporte com histórico completo',
    ],
    commonErrors: [
      'Conta não localizada — confirme o código exato no Plano de Contas',
      'Período muito longo sem filtro — gera arquivo enorme; filtre por trimestre',
    ],
    examples: [
      {
        title: 'Razão da conta Receita de Serviços em 2026',
        description:
          'Conta 3.1.1.01, período 01/01 a 31/12/2026. ' +
          'Mostra todos os lançamentos de crédito (receitas registradas) em ordem cronológica. ' +
          'Saldo final credor de R$ 960.000 = faturamento total do exercício.',
      },
    ],
  },

  // ─── 12. Cadastro de Empresa ───────────────────────────────────────────────
  'cadastro-empresa': {
    id: 'cadastro-empresa',
    title: 'Cadastrar / Editar Empresa',
    whatIs:
      'O cadastro de empresa é o perfil completo de um cliente no sistema. ' +
      'Contém dados fiscais, tributários e de contato usados em todas as operações: ' +
      'emissão de NF-e, cálculo de impostos, SPED e relatórios.',
    whenToUse:
      'Use ao integrar uma nova empresa no sistema ou ao atualizar dados (endereço, regime tributário, CNAE). ' +
      'Dados errados aqui causam problemas em notas fiscais e declarações.',
    estimatedTime: '10-15 minutos',
    fields: [
      {
        name: 'cnpj',
        label: 'CNPJ',
        description: 'CNPJ oficial conforme Receita Federal.',
        example: '12.345.678/0001-90',
        required: true,
        type: 'cnpj',
        tips: [
          'Ao digitar, clique em "Buscar na Receita" para preencher automático',
          'CNPJ deve estar ativo; suspenso ou baixado não funciona',
        ],
      },
      {
        name: 'razaoSocial',
        label: 'Razão Social',
        description: 'Nome legal exato conforme contrato social e cartão CNPJ.',
        example: 'Padaria Silva Comércio de Alimentos LTDA',
        required: true,
        type: 'text',
        tips: ['Deve ser idêntico ao cartão CNPJ — qualquer diferença rejeita NF-e'],
      },
      {
        name: 'nomeFantasia',
        label: 'Nome Fantasia',
        description: 'Nome comercial pelo qual a empresa é conhecida.',
        example: 'Padaria Silva',
        required: false,
        type: 'text',
        tips: ['Aparece nos relatórios internos e comunicações com clientes'],
      },
      {
        name: 'regimeTributario',
        label: 'Regime Tributário',
        description: 'Como a empresa apura e paga impostos.',
        example: 'Simples Nacional',
        required: true,
        type: 'select',
        tips: ['Afeta cálculo de impostos e obrigações acessórias', 'Confirme com o cliente antes de definir'],
      },
      {
        name: 'cnae',
        label: 'CNAE Principal',
        description: 'Código da atividade econômica principal.',
        example: '1091-1/02 — Fabricação de produtos de padaria',
        required: true,
        type: 'text',
        tips: [
          'Confira no cartão CNPJ',
          'Para Simples Nacional, o CNAE define qual Anexo se aplica',
          'CNAE errado = imposto errado',
        ],
      },
      {
        name: 'contadorResponsavel',
        label: 'Contador Responsável (CRC)',
        description: 'Nome e número de CRC do contador que assina a escrituração.',
        example: 'João da Silva — CRC/SP 123456/O-8',
        required: false,
        type: 'text',
        tips: ['Obrigatório para assinar SPED Contábil', 'CRC deve estar ativo no CFC'],
      },
    ],
    tips: [
      'Use "Buscar Dados na Receita" ao digitar CNPJ — preenche razão social e endereço automaticamente',
      'Regime tributário errado gera cálculos incorretos de impostos',
      'CNAE errado afeta qual tabela do Simples se aplica e pode gerar multa',
      'Mantenha e-mail e telefone atualizados — usados para envio de guias',
    ],
    commonErrors: [
      'CNPJ não encontrado — verifique se a empresa está ativa na Receita Federal',
      'Razão social diferente do cartão CNPJ — NF-e será rejeitada pela SEFAZ',
      'Regime tributário incompatível com o faturamento — Simples tem limite de R$ 4,8 mi/ano',
    ],
    examples: [
      {
        title: 'Cadastrar nova empresa: Padaria Silva LTDA',
        description:
          'Digita o CNPJ, clica em "Buscar na Receita". ' +
          'Sistema preenche razão social, endereço e CNAE automaticamente. ' +
          'Define regime: Simples Nacional Anexo I. Salva. ' +
          'Empresa já disponível para emitir NF-e e calcular DAS.',
      },
    ],
  },

  // ─── 13. Cadastro de Usuários ──────────────────────────────────────────────
  'cadastro-usuarios': {
    id: 'cadastro-usuarios',
    title: 'Gerenciar Usuários',
    whatIs:
      'Gerenciamento de usuários define quem pode acessar o sistema e o que cada pessoa pode fazer. ' +
      'Cada usuário tem um perfil (Admin, Contador, Auxiliar, Visualizador, Cliente) ' +
      'com permissões específicas e acesso limitado às empresas permitidas.',
    whenToUse:
      'Use ao contratar novo colaborador, dar acesso a cliente, integrar estagiário, ' +
      'ou ao remover acesso de quem saiu. Revise a lista de usuários ativos a cada 6 meses.',
    estimatedTime: '3-5 minutos',
    fields: [
      {
        name: 'nome',
        label: 'Nome Completo',
        description: 'Nome do novo usuário.',
        example: 'Maria Fernanda Costa',
        required: true,
        type: 'text',
        tips: ['Nome completo para identificação nos logs de auditoria'],
      },
      {
        name: 'email',
        label: 'E-mail de Acesso',
        description: 'E-mail usado como login. Um convite será enviado para este endereço.',
        example: 'maria.costa@escritorioabc.com.br',
        required: true,
        type: 'email',
        tips: ['Deve ser um e-mail válido — convite expira em 48h', 'Não pode ser duplicado no sistema'],
      },
      {
        name: 'perfil',
        label: 'Perfil de Acesso',
        description: 'Nível de permissão no sistema.',
        example: 'Auxiliar Contábil',
        required: true,
        type: 'select',
        tips: [
          'Use sempre o perfil mínimo necessário para a função',
          'Admin tem acesso total — use com critério',
          'Cliente só vê dados da própria empresa',
        ],
      },
      {
        name: 'empresas',
        label: 'Empresas com Acesso',
        description: 'Quais empresas este usuário pode visualizar e operar.',
        example: 'Padaria Silva LTDA, TechCorp ME',
        required: true,
        type: 'select',
        tips: ['Contador pode ter acesso a múltiplas empresas', 'Cliente deve ter acesso apenas à própria empresa'],
      },
    ],
    tips: [
      'Princípio do menor privilégio: dê apenas o acesso necessário para a função',
      'Estagiários usam perfil "Auxiliar" — nunca "Admin"',
      'Remova acesso imediatamente ao desligar um colaborador',
      'Todo acesso fica gravado nos logs de auditoria',
      'Revise usuários ativos a cada 6 meses',
    ],
    commonErrors: [
      'E-mail já cadastrado — cada e-mail só pode ter um usuário; edite o existente',
      'Usuário criado sem empresas associadas — não vai conseguir acessar nada',
      'Perfil muito permissivo para a função — risco de segurança',
    ],
    examples: [
      {
        title: 'Adicionar estagiário com acesso somente leitura',
        description:
          'Nome: Lucas Pereira. E-mail: lucas@escritorioabc.com.br. ' +
          'Perfil: Visualizador. Empresas: apenas Padaria Silva LTDA. ' +
          'Lucas recebe convite por e-mail e acessa com permissão de leitura.',
      },
    ],
  },

  // ─── 14. Plano de Contas ───────────────────────────────────────────────────
  'plano-contas': {
    id: 'plano-contas',
    title: 'Plano de Contas',
    whatIs:
      'O Plano de Contas é a estrutura de todas as contas contábeis da empresa. ' +
      'Organiza Ativos, Passivos, Patrimônio Líquido, Receitas e Despesas em hierarquia numerada. ' +
      'É a base de toda a contabilidade — cada lançamento usa contas do plano.',
    whenToUse:
      'Configure uma vez no início. Adicione contas novas conforme necessário. ' +
      'Nunca delete contas com lançamentos — apenas inative. ' +
      'Revise anualmente.',
    estimatedTime: '2-3 minutos por conta nova',
    fields: [
      {
        name: 'codigo',
        label: 'Código da Conta',
        description: 'Número hierárquico único. Estrutura: Grupo.Subgrupo.Conta.Subconta.',
        example: '3.1.1.01',
        required: true,
        type: 'text',
        tips: [
          '1 = Ativo, 2 = Passivo, 3 = Receita, 4 = Despesa, 5 = Custo',
          'Siga sequência do grupo pai (ex: 3.1.x.xx para sub-receitas)',
        ],
      },
      {
        name: 'nome',
        label: 'Nome da Conta',
        description: 'Nome descritivo e objetivo.',
        example: 'Receita de Serviços de TI',
        required: true,
        type: 'text',
        tips: ['Seja específico — "Receita de Serviços" é genérico demais', 'Máximo 60 caracteres'],
      },
      {
        name: 'tipo',
        label: 'Tipo de Conta',
        description: 'Classificação patrimonial/resultado.',
        example: 'Receita',
        required: true,
        type: 'select',
        tips: [
          'Define onde aparece no Balanço (Ativo/Passivo/PL) ou na DRE (Receita/Despesa/Custo)',
          'Tipo errado = conta aparece no relatório errado',
        ],
      },
      {
        name: 'contaPai',
        label: 'Conta Pai (Sintética)',
        description: 'Conta agrupadora a que esta pertence.',
        example: '3.1.1 — Receitas de Serviços',
        required: true,
        type: 'select',
        tips: ['Toda conta analítica deve ter uma conta sintética pai', 'A hierarquia define o agrupamento nos relatórios'],
      },
      {
        name: 'natureza',
        label: 'Natureza (Devedora/Credora)',
        description: 'Define se o saldo normal da conta é devedor ou credor.',
        example: 'Credora',
        required: true,
        type: 'select',
        tips: ['Ativo e Despesa = Devedora', 'Passivo, PL e Receita = Credora'],
      },
    ],
    tips: [
      'Use o plano de contas padrão como base — adapte apenas o necessário',
      'Não delete contas com lançamentos — inative para não aparecer nos filtros',
      'Hierarquia clara facilita relatórios e análises',
      'Contas analíticas (que recebem lançamentos) ficam nos últimos níveis',
    ],
    commonErrors: [
      'Código repetido — cada código deve ser único no plano',
      'Tipo de conta errado — conta de despesa cadastrada como ativo não aparece no DRE',
      'Conta analítica sem conta pai definida — viola a hierarquia do plano',
    ],
    examples: [
      {
        title: 'Criar subconta: Receitas de Serviços de TI',
        description:
          'Código: 3.1.1.02. Nome: Receita de Serviços de TI. ' +
          'Tipo: Receita. Conta pai: 3.1.1 Receitas de Serviços. ' +
          'Natureza: Credora. A conta passa a estar disponível nos lançamentos.',
      },
    ],
  },

  // ─── 15. Conciliação Bancária ──────────────────────────────────────────────
  'conciliacao-bancaria': {
    id: 'conciliacao-bancaria',
    title: 'Conciliação Bancária',
    whatIs:
      'Conciliação bancária é o processo de comparar o extrato bancário real com os lançamentos contábeis. ' +
      'Identifica transações não registradas, erros de valor e lançamentos duplicados. ' +
      'Garante que a contabilidade reflete fielmente o que aconteceu no banco.',
    whenToUse:
      'Use mensalmente — idealmente antes de fechar o mês. ' +
      'Se houver Open Finance integrado, use semanalmente para manter tudo atualizado.',
    estimatedTime: '15-30 minutos',
    fields: [
      {
        name: 'contaBancaria',
        label: 'Banco / Conta Corrente',
        description: 'Qual conta bancária conciliar.',
        example: 'Banco do Brasil — CC 12345-6',
        required: true,
        type: 'select',
        tips: ['Concilie cada conta separadamente', 'Conta poupança e CC são contas diferentes'],
      },
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Primeiro dia do extrato a conciliar.',
        example: '01/03/2026',
        required: true,
        type: 'date',
        tips: ['Use sempre o primeiro dia do mês', 'Não deixe gaps entre conciliações'],
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Último dia do extrato.',
        example: '31/03/2026',
        required: true,
        type: 'date',
      },
      {
        name: 'saldoExtrato',
        label: 'Saldo Final Conforme Extrato',
        description: 'Saldo do último dia do período conforme extrato bancário oficial.',
        example: 'R$ 42.500,00',
        required: true,
        type: 'currency',
        tips: ['Copie exatamente do extrato bancário', 'Este é o valor "verdade" — a contabilidade deve igualar'],
      },
      {
        name: 'arquivoOFX',
        label: 'Arquivo OFX / CSV do Banco',
        description: 'Extrato digital baixado do internet banking.',
        example: 'extrato_bradesco_mar2026.ofx',
        required: false,
        type: 'text',
        tips: ['OFX importa automaticamente e agiliza muito a conciliação', 'Disponível no internet banking de todos os grandes bancos'],
      },
    ],
    tips: [
      'Faça conciliação antes de fechar qualquer mês — é obrigatória para confiabilidade dos relatórios',
      'Importe o OFX para automatizar a comparação linha a linha',
      'Tarifas bancárias (TED, manutenção) frequentemente ficam de fora — registre como despesa bancária',
      'Divergências acima de R$ 100 devem ser investigadas imediatamente',
      'Guarde extratos conciliados em PDF por 5 anos',
    ],
    commonErrors: [
      'Saldo contábil ≠ saldo do extrato — procure tarifas bancárias não lançadas e transações duplicadas',
      'Tarifas bancárias não registradas — cada tarifa é uma despesa que precisa de lançamento',
      'Conciliar meses pulados — sempre concilie em sequência, sem gaps',
    ],
    examples: [
      {
        title: 'Conciliar extrato do Bradesco — março 2026',
        description:
          'Importa OFX do Bradesco de março. Sistema cruza automaticamente 87 de 92 transações. ' +
          '5 transações sem correspondência: 3 tarifas não lançadas e 2 TEDs sem histórico. ' +
          'Lança os 5 itens faltantes. Saldo bate: conciliação completa.',
      },
    ],
  },

  // ─── 16. SPED Contábil ─────────────────────────────────────────────────────
  'sped-contabil': {
    id: 'sped-contabil',
    title: 'SPED Contábil — ECD',
    whatIs:
      'SPED Contábil (ECD — Escrituração Contábil Digital) é a entrega anual dos livros contábeis à Receita Federal em formato digital. ' +
      'Substitui os livros Diário e Razão em papel. ' +
      'Obrigatório para empresas no Lucro Real e algumas no Lucro Presumido.',
    whenToUse:
      'Uma vez por ano, para escriturar o exercício encerrado. ' +
      'Prazo: último dia útil de maio do ano seguinte. ' +
      'ECD de 2025 vence em maio de 2026.',
    estimatedTime: '10-15 minutos para gerar o arquivo',
    fields: [
      {
        name: 'anoExercicio',
        label: 'Ano de Exercício',
        description: 'Ano fiscal da escrituração a ser enviada.',
        example: '2025',
        required: true,
        type: 'number',
        tips: ['Sempre 4 dígitos', 'Não pode ser futuro'],
      },
      {
        name: 'tipoEscrituracao',
        label: 'Tipo de Escrituração',
        description: 'Original = primeiro envio. Substituta = correção de envio anterior.',
        example: 'Original (G)',
        required: true,
        type: 'select',
        tips: ['Se for primeira entrega do ano, sempre "Original"', 'Substituta requer recibo da original'],
      },
      {
        name: 'responsavelTecnico',
        label: 'Responsável Técnico (CRC)',
        description: 'Nome e CRC do contador que assina a escrituração.',
        example: 'João da Silva — CRC/SP 123456/O-8',
        required: true,
        type: 'text',
        tips: ['CRC deve estar ativo', 'Assina digitalmente com certificado e-CPF do contador'],
      },
      {
        name: 'assinaturaDigital',
        label: 'Certificado Digital',
        description: 'Certificado e-CNPJ ou e-CPF para assinar o arquivo.',
        example: 'e-CNPJ da empresa ou e-CPF do contador',
        required: true,
        type: 'text',
        tips: ['Sem assinatura digital o arquivo é rejeitado', 'Validade do certificado deve cobrir a data de envio'],
      },
    ],
    tips: [
      'Feche TODOS os lançamentos do exercício antes de gerar — lançamento em aberto = arquivo inválido',
      'Valide o arquivo no PVA (Programa Validador da Receita) antes de transmitir',
      'Assine com certificado digital válido (e-CNPJ ou e-CPF do contador)',
      'Guarde o recibo de entrega por tempo indeterminado',
      'Se encontrar erro após envio, envie escrituração Substituta (exige recibo da original)',
    ],
    commonErrors: [
      'Saldos não balanceados — confira débito = crédito em todos os lançamentos do exercício',
      'Plano de contas com código inválido — siga estrutura da Receita (1=Ativo, 2=Passivo, 3=PL, 4=Receita, 5=Despesa)',
      'Certificado digital expirado — renove antes de tentar transmitir',
      'Enviar sem validar no PVA — o PVA detecta erros que o sistema pode não detectar',
    ],
    examples: [
      {
        title: 'Gerar ECD do exercício 2025',
        description:
          'Fecha todos os lançamentos de 2025. Gera arquivo ECD (tipo G). ' +
          'Valida no PVA da Receita: 0 erros. ' +
          'Assina com e-CNPJ da empresa. ' +
          'Transmite: recibo gerado. Guarda recibo em pasta do cliente.',
      },
    ],
  },

  // ─── 17. Logs de Auditoria ─────────────────────────────────────────────────
  'auditoria-logs': {
    id: 'auditoria-logs',
    title: 'Logs de Auditoria',
    whatIs:
      'Os logs de auditoria registram automaticamente cada ação no sistema: ' +
      'quem fez, o que fez, quando e de qual IP. ' +
      'São imutáveis — ninguém pode apagá-los. ' +
      'Permitem rastrear alterações, detectar usos indevidos e comprovar conformidade.',
    whenToUse:
      'Use para investigar alterações suspeitas, verificar o que um usuário fez em determinado período, ' +
      'comprovar ações em fiscalizações, ou revisar histórico antes de fechar um período.',
    estimatedTime: '1-5 minutos (depende do volume)',
    fields: [
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Início do período a consultar.',
        example: '01/05/2026',
        required: true,
        type: 'date',
        tips: ['Para investigações rápidas, use os últimos 7 dias'],
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Fim do período.',
        example: '31/05/2026',
        required: true,
        type: 'date',
        tips: ['Evite períodos muito longos — máximo recomendado: 90 dias por consulta'],
      },
      {
        name: 'usuario',
        label: 'Filtrar por Usuário',
        description: 'Ver apenas ações de um usuário específico.',
        example: 'joao.silva@empresa.com.br',
        required: false,
        type: 'select',
        tips: ['Deixe em branco para ver ações de todos', 'Útil para investigar usuário específico'],
      },
      {
        name: 'tipoAcao',
        label: 'Tipo de Ação',
        description: 'Filtrar por categoria de operação.',
        example: 'Exclusão',
        required: false,
        type: 'select',
        tips: [
          'Filtre por "Exclusão" para investigar dados deletados',
          'Filtre por "Login" para ver acessos ao sistema',
        ],
      },
      {
        name: 'empresa',
        label: 'Empresa',
        description: 'Filtrar ações em uma empresa específica.',
        example: 'Padaria Silva LTDA',
        required: false,
        type: 'select',
        tips: ['Deixe em branco para ver ações em todas as empresas'],
      },
    ],
    tips: [
      'Logs são imutáveis — nenhum usuário, nem admin, pode apagá-los',
      'Exporte como PDF com data/hora para usar como evidência em fiscalizações',
      'Logins de IPs desconhecidos merecem investigação imediata',
      'Revise logs de exclusão periodicamente como boa prática de segurança',
    ],
    commonErrors: [
      'Período muito longo sem filtros — gera volume excessivo; filtre por usuário ou tipo',
      'Esquecer de exportar antes de entregar evidência — exporte em PDF com assinatura eletrônica',
    ],
    examples: [
      {
        title: 'Ver o que o usuário João fez nos últimos 7 dias',
        description:
          'Filtro: usuário "joao.silva@empresa.com.br", período últimos 7 dias, todas as ações. ' +
          'Resultado: 42 lançamentos criados, 3 editados, 1 excluído às 23h47 do dia 15/05. ' +
          'Investigação: lançamento excluído era duplicata legítima.',
      },
    ],
  },

  // ─── 18. Relatório de Vendas ───────────────────────────────────────────────
  'relatorio-vendas': {
    id: 'relatorio-vendas',
    title: 'Relatório de Vendas / Faturamento',
    whatIs:
      'Relatório de Vendas consolida todo o faturamento em um período: ' +
      'notas emitidas, produtos/serviços vendidos, clientes atendidos, margem e comparativos. ' +
      'É a base para decisões comerciais, metas de vendas e planejamento de estoque.',
    whenToUse:
      'Use mensalmente para acompanhar performance comercial. ' +
      'Consulte ao definir metas, negociar com fornecedores, ou apresentar resultados a sócios.',
    estimatedTime: '2-3 minutos',
    fields: [
      {
        name: 'periodoInicio',
        label: 'Data Inicial',
        description: 'Início do período de análise.',
        example: '01/01/2026',
        required: true,
        type: 'date',
        tips: ['Para análise semestral: 01/01 a 30/06'],
      },
      {
        name: 'periodoFim',
        label: 'Data Final',
        description: 'Fim do período.',
        example: '30/06/2026',
        required: true,
        type: 'date',
        tips: ['Quanto maior o período, mais contexto estratégico'],
      },
      {
        name: 'agruparPor',
        label: 'Agrupar Por',
        description: 'Como agregar os dados do relatório.',
        example: 'Cliente',
        required: true,
        type: 'select',
        tips: [
          'Por Cliente: identifica quem gera mais receita',
          'Por Produto: identifica produtos estrela',
          'Por Mês: identifica sazonalidade',
        ],
      },
      {
        name: 'formato',
        label: 'Formato de Exibição',
        description: 'Como os dados serão apresentados.',
        example: 'Tabela + Gráfico',
        required: false,
        type: 'select',
        tips: ['Gráfico é melhor para apresentações', 'Tabela é melhor para análise detalhada'],
      },
    ],
    tips: [
      'Compare com o mesmo período do ano anterior para detectar crescimento real',
      'Identifique os 3 clientes que mais faturaram — foque em fidelizá-los',
      'Produtos com margem baixa (<10%) merecem revisão de preço',
      'Use para definir metas do próximo mês com base em dados reais',
      'Exporte para Excel para análise avançada',
    ],
    commonErrors: [
      'Período muito curto — análise de 1 semana não é representativa; use ao menos 1 mês',
      'Não filtrar notas canceladas — distorce o faturamento real',
    ],
    examples: [
      {
        title: 'Faturamento por cliente no 1º semestre de 2026',
        description:
          'Período 01/01 a 30/06/2026, agrupado por cliente. ' +
          'Resultado: top 3 clientes respondem por 62% do faturamento. ' +
          'Identifica cliente inativo que costumava comprar: oportunidade de reativação.',
      },
      {
        title: 'Análise de sazonalidade por mês',
        description:
          'Período 01/01 a 31/12/2025, agrupado por mês. ' +
          'Gráfico mostra picos em março, julho e novembro. ' +
          'Usado para planejar estoque e equipe com antecedência.',
      },
    ],
  },

}; // fim SERVICES_HELP
