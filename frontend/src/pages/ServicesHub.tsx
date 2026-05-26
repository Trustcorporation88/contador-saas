/**
 * 🎯 SERVICES HUB - Catálogo Interativo de Serviços
 * 
 * Exibe todos os serviços disponíveis em scroll horizontal
 * Clique em um serviço → Abre modal com instruções completas
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';

// Tipos
interface ServiceField {
  name: string;
  type: 'text' | 'email' | 'date' | 'number' | 'select';
  required: boolean;
  placeholder: string;
}

interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  modalTitle: string;
  modalDescription: string;
  requiredFields: ServiceField[];
  expectedResult: string;
  howToUse: string;
  tips: string[];
  estimatedTime: string;
}

// TODOS OS SERVIÇOS
const SERVICES: Service[] = [
  {
    id: 's1',
    name: 'Gerar DAS',
    category: 'Impostos',
    description: 'Gera automaticamente DAS todo mês',
    icon: '📋',
    color: '#FF6B6B',
    modalTitle: 'Gerar DAS Automático',
    modalDescription: 'Sistema gera guia de recolhimento mensal conforme dados contábeis',
    requiredFields: [
      { name: 'Empresa', type: 'select', required: true, placeholder: 'Selecione sua empresa' },
      { name: 'Mês', type: 'select', required: false, placeholder: 'Mês atual se em branco' },
    ],
    expectedResult: 'Guia de recolhimento DAS pronta para pagamento',
    howToUse: 'Menu → Impostos → DAS → Botão "Gerar DAS" → Selecione mês → Clique "Gerar" → Arquivo PDF pronto',
    tips: [
      'Sistema calcula automaticamente baseado em lançamentos contábeis',
      'Valida com RFB antes de gerar',
      'Pode baixar, imprimir ou enviar diretamente',
    ],
    estimatedTime: '< 1 minuto',
  },
  {
    id: 's2',
    name: 'Listar DAS',
    category: 'Impostos',
    description: 'Visualiza todos os DAS gerados',
    icon: '📄',
    color: '#4ECDC4',
    modalTitle: 'Visualizar Histórico de DAS',
    modalDescription: 'Veja todos os DAS já gerados com seu status atual',
    requiredFields: [],
    expectedResult: 'Lista completa de DAS com status (Pendente/Pago/Vencido)',
    howToUse: 'Menu → Impostos → DAS → Aba "Histórico" → Filtre por status → Clique em um DAS para detalhes',
    tips: [
      'Filtre por status: Pendente, Pago, Vencido, Cancelado',
      'Ordene por data ou valor',
      'Exporte lista para Excel',
    ],
    estimatedTime: '< 1 minuto',
  },
  {
    id: 's3',
    name: 'Registrar Pagamento',
    category: 'Impostos',
    description: 'Marca DAS como pago',
    icon: '✅',
    color: '#95E1D3',
    modalTitle: 'Confirmar Pagamento de DAS',
    modalDescription: 'Registre que um DAS foi pago (banco/pix/boleto)',
    requiredFields: [
      { name: 'DAS', type: 'select', required: true, placeholder: 'Selecione um DAS' },
      { name: 'Data do Pagamento', type: 'date', required: true, placeholder: 'Data real do pagamento' },
      { name: 'Comprovante', type: 'text', required: false, placeholder: 'Link ou descrição (opcional)' },
    ],
    expectedResult: 'DAS marcado como "PAGO" com data e comprovante em arquivo',
    howToUse: 'Menu → Impostos → DAS → Clique em DAS pendente → Botão "Registrar Pagamento" → Preencha → Confirme',
    tips: [
      'Salve screenshot do comprovante bancário',
      'Use a data real do pagamento, não a data de hoje',
      'Sistema notifica automaticamente ao contador',
      'Comprovante pode ser adicionado depois',
    ],
    estimatedTime: '2-3 minutos',
  },
  {
    id: 's4',
    name: 'Upload Extrato',
    category: 'Contabilidade',
    description: 'Envia arquivo CSV/PDF do banco',
    icon: '📥',
    color: '#F38181',
    modalTitle: 'Reconciliação Automática de Banco',
    modalDescription: 'Sistema faz matching inteligente entre transações bancárias e contábeis',
    requiredFields: [
      { name: 'Arquivo', type: 'text', required: true, placeholder: 'CSV ou PDF do banco' },
      { name: 'Período Início', type: 'date', required: true, placeholder: 'Data inicial' },
      { name: 'Período Fim', type: 'date', required: true, placeholder: 'Data final' },
    ],
    expectedResult: 'Sugestões de reconciliação com score de confiança (0-100%)',
    howToUse: 'Menu → Contabilidade → Reconciliação → Botão "Upload Extrato" → Selecione arquivo → Sistema processa → Revise → Confirme',
    tips: [
      'Export CSV do seu banco (Banco do Brasil, Caixa, Itaú, etc)',
      'Arquivo não pode estar vazio (mínimo 1 transação)',
      'Suporta PDF e CSV dos principais bancos',
      'Score >70% = alta confiança',
    ],
    estimatedTime: '5-10 minutos',
  },
  {
    id: 's5',
    name: 'Confirmar Reconciliação',
    category: 'Contabilidade',
    description: 'Aceita sugestões de matching',
    icon: '🔗',
    color: '#AA96DA',
    modalTitle: 'Confirmar Matching de Transações',
    modalDescription: 'Revise e confirme as sugestões automáticas de reconciliação',
    requiredFields: [
      { name: 'Upload ID', type: 'text', required: true, placeholder: 'ID do upload anterior' },
    ],
    expectedResult: 'Transações reconciliadas com marcação de data e valor',
    howToUse: 'Menu → Contabilidade → Reconciliação → Revise sugestões → Aceite/ajuste cada uma → Botão "Confirmar" → Pronto',
    tips: [
      'Score >70% = aceite automaticamente',
      'Score 50-70% = revise antes de aceitar',
      'Pode ajustar manualmente se achar discrepância',
      'Histórico salvo e auditado automaticamente',
    ],
    estimatedTime: '3-5 minutos',
  },
  {
    id: 's6',
    name: 'Upload NF-e',
    category: 'Documentos',
    description: 'PDF/imagem de nota fiscal',
    icon: '📸',
    color: '#FCBAD3',
    modalTitle: 'Extração Automática de NF-e',
    modalDescription: 'Sistema lê e extrai dados automaticamente via OCR inteligente',
    requiredFields: [
      { name: 'Arquivo', type: 'text', required: true, placeholder: 'PDF ou imagem JPG/PNG' },
      { name: 'Tipo', type: 'select', required: true, placeholder: 'Entrada/Saída' },
    ],
    expectedResult: 'Lançamento contábil pronto para confirmar (débito/crédito automáticos)',
    howToUse: 'Menu → Documentos → NF-e → Botão "Upload" → Selecione arquivo → Sistema extrai → Revise → Confirme',
    tips: [
      'Foto clara e em boa resolução da nota fiscal',
      'Formato aceito: PDF ou JPG/PNG',
      'Sistema valida na Sefaz automaticamente',
      'Chave NF-e extraída e validada',
    ],
    estimatedTime: '1-2 minutos',
  },
  {
    id: 's7',
    name: 'Validar Sefaz',
    category: 'Documentos',
    description: 'Verifica autenticidade na Sefaz',
    icon: '🔍',
    color: '#FFD3B6',
    modalTitle: 'Validação Sefaz de NF-e',
    modalDescription: 'Confirma autenticidade e legalidade da NF-e junto à Sefaz',
    requiredFields: [
      { name: 'Chave NF-e', type: 'text', required: true, placeholder: '44 dígitos' },
      { name: 'CNPJ Emissor', type: 'text', required: true, placeholder: '00.000.000/0000-00' },
    ],
    expectedResult: 'Status: Válida/Inválida com detalhes da Sefaz',
    howToUse: 'Menu → Documentos → NF-e → Clique em NF-e → Botão "Validar Sefaz" → Sistema consulta RFB → Resultado em 5 seg',
    tips: [
      'Conecta diretamente com webservice da Sefaz',
      'Resultado vinculado ao lançamento contábil',
      'Auditoria automática de validações',
      'Resultado em tempo real',
    ],
    estimatedTime: '< 30 segundos',
  },
  {
    id: 's8',
    name: 'Criar Recorrência',
    category: 'Contabilidade',
    description: 'Lançamento que se repete automático',
    icon: '🔁',
    color: '#D4A5A5',
    modalTitle: 'Automatizar Lançamentos Recorrentes',
    modalDescription: 'Cria templates de operações que se repetem todo mês (aluguel, folha, etc)',
    requiredFields: [
      { name: 'Descrição', type: 'text', required: true, placeholder: 'Ex: Aluguel, Folha, Água' },
      { name: 'Valor', type: 'number', required: true, placeholder: '0.00' },
      { name: 'Conta Débito', type: 'select', required: true, placeholder: 'Selecione' },
      { name: 'Conta Crédito', type: 'select', required: true, placeholder: 'Selecione' },
      { name: 'Frequência', type: 'select', required: true, placeholder: 'Diário/Mensal/Anual' },
    ],
    expectedResult: 'Template criado → Sistema cria lançamentos automaticamente no período',
    howToUse: 'Menu → Contabilidade → Lançamentos → Botão "Nova Recorrência" → Preencha dados → Defina frequência → Confirme',
    tips: [
      'Use para operações que se repetem 3+ vezes/mês',
      'Sistema cria automaticamente no período definido',
      'Edite ou desative a recorrência a qualquer momento',
      'Economiza 20+ horas/mês em lançamentos manuais',
    ],
    estimatedTime: '3-5 minutos',
  },
  {
    id: 's9',
    name: 'Listar Lançamentos',
    category: 'Contabilidade',
    description: 'Visualiza todos os lançamentos',
    icon: '📊',
    color: '#F3A097',
    modalTitle: 'Histórico de Lançamentos',
    modalDescription: 'Veja todos os lançamentos contábeis registrados com saldo em tempo real',
    requiredFields: [
      { name: 'Período Início', type: 'date', required: false, placeholder: 'Data inicial (opcional)' },
      { name: 'Período Fim', type: 'date', required: false, placeholder: 'Data final (opcional)' },
    ],
    expectedResult: 'Lista completa com: Data, Descrição, Débito, Crédito, Saldo',
    howToUse: 'Menu → Contabilidade → Lançamentos → Revise lista → Filtre por período → Clique para detalhes',
    tips: [
      'Exporte para Excel com um clique',
      'Filtre por data, descrição ou valor',
      'Veja saldo progressivo em tempo real',
      'Histórico completo auditado',
    ],
    estimatedTime: '< 1 minuto',
  },
  {
    id: 's10',
    name: 'Gerar EFD',
    category: 'Impostos',
    description: 'Arquivo EFD conforme RFB',
    icon: '📝',
    color: '#FFCCCC',
    modalTitle: 'EFD Automático - Escrituração Fiscal',
    modalDescription: 'Sistema gera arquivo .txt conforme layout RFB 4.0 pronto para envio',
    requiredFields: [
      { name: 'Mês', type: 'select', required: true, placeholder: 'Selecione mês' },
      { name: 'Ano', type: 'select', required: true, placeholder: 'Selecione ano' },
    ],
    expectedResult: 'Arquivo EFD.txt validado e pronto para envio à RFB',
    howToUse: 'Menu → Impostos → EFD → Botão "Gerar EFD" → Selecione mês → Sistema valida → Baixe arquivo .txt → Envie RFB',
    tips: [
      'Validação automática conforme RFB',
      'Arquivo pronto para Sefaz (sem ajustes)',
      'Histórico de gerações salvo para auditoria',
      'Diferencial único no mercado!',
    ],
    estimatedTime: '1-2 minutos',
  },
  {
    id: 's11',
    name: 'Dashboard',
    category: 'Análise',
    description: 'Métricas em tempo real',
    icon: '📈',
    color: '#B4E7FF',
    modalTitle: 'Seu Dashboard Executivo',
    modalDescription: 'Métricas principais do seu negócio: MRR, Clientes, Churn, NPS, CAC, LTV',
    requiredFields: [],
    expectedResult: 'Dashboard com 10+ métricas atualizadas a cada 5-10 minutos',
    howToUse: 'Menu → Dashboard → Visualize todas as métricas → Clique em métrica para detalhes → Exporte relatórios',
    tips: [
      'Atualiza a cada 5-10 minutos',
      'Trending de últimos 6 meses',
      'Alertas automáticos se houver anomalias',
      'Exporte relatórios em PDF/Excel',
    ],
    estimatedTime: '< 1 minuto',
  },
  {
    id: 's12',
    name: 'Chat Suporte',
    category: 'Suporte',
    description: 'Fale com especialista em tempo real',
    icon: '💬',
    color: '#E2F0CB',
    modalTitle: 'Suporte via Chat',
    modalDescription: 'Conecte com especialista da plataforma para resolver dúvidas',
    requiredFields: [],
    expectedResult: 'Conversa com especialista + soluções rápidas',
    howToUse: 'Menu → Suporte → Botão "Chat" ou ícone de balão → Escreva sua dúvida → Especialista responde em < 5 min',
    tips: [
      'Disponível 9h-18h horário de Brasília',
      'Histórico de conversas salvo',
      'Transferência automática se precisar de suporte técnico',
      'FAQ com 100+ respostas comuns',
    ],
    estimatedTime: 'Variável (5-30 min)',
  },
];

export default function ServicesHub() {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  // Agrupar serviços por categoria
  const categories = ['Todos', ...Array.from(new Set(SERVICES.map(s => s.category)))];
  const filteredServices = activeCategory === 'Todos' 
    ? SERVICES 
    : SERVICES.filter(s => s.category === activeCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
          🎯 Central de Serviços
        </h1>
        <p className="text-lg text-slate-600">
          Clique em qualquer serviço para ver instruções completas e dados necessários
        </p>
      </div>

      {/* CATEGORY FILTER */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-blue-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* SERVICES GRID */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map(service => (
            <button
              key={service.id}
              onClick={() => setSelectedService(service)}
              className="group relative overflow-hidden rounded-xl bg-white p-6 shadow-md hover:shadow-xl transition-all hover:scale-105 border-2 border-transparent hover:border-blue-500"
            >
              {/* Background gradient effect */}
              <div
                className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity"
                style={{ backgroundColor: service.color }}
              />

              {/* Content */}
              <div className="relative z-10">
                <div className="text-4xl mb-4">{service.icon}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{service.name}</h3>
                <p className="text-sm text-slate-600 mb-3">{service.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {service.category}
                  </span>
                  <span className="text-xs font-medium text-blue-600">
                    {service.estimatedTime}
                  </span>
                </div>
              </div>

              {/* Click to open indicator */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg">
                  →
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {selectedService && (
        <ServiceModal service={selectedService} onClose={() => setSelectedService(null)} />
      )}
    </div>
  );
}

// COMPONENT: Service Modal
function ServiceModal({
  service,
  onClose,
}: {
  service: Service;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div
          className="p-8 text-white"
          style={{ backgroundColor: service.color }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-5xl mb-4">{service.icon}</div>
              <h2 className="text-3xl font-bold mb-2">{service.modalTitle}</h2>
              <p className="text-sm opacity-90">{service.modalDescription}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:opacity-70 transition-opacity"
            >
              <X size={28} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* O que precisa ser inserido */}
          {service.requiredFields.length > 0 && (
            <section>
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                📝 Dados Necessários
              </h3>
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                {service.requiredFields.map((field, idx) => (
                  <div key={idx}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {field.name} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Resultado esperado */}
          <section>
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              ✅ Resultado Esperado
            </h3>
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-slate-700">
              {service.expectedResult}
            </div>
          </section>

          {/* Como usar */}
          <section>
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              🎯 Passo a Passo
            </h3>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-slate-700">
              {service.howToUse}
            </div>
          </section>

          {/* Dicas */}
          {service.tips.length > 0 && (
            <section>
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                💡 Dicas Úteis
              </h3>
              <ul className="space-y-2">
                {service.tips.map((tip, idx) => (
                  <li
                    key={idx}
                    className="flex gap-3 text-slate-700"
                  >
                    <span className="text-lg">✨</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition-colors"
            >
              Fechar
            </button>
            <button
              style={{ backgroundColor: service.color }}
              className="flex-1 px-6 py-3 text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              Usar Serviço
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
