/**
 * OpenFinancePage.tsx — Reconciliação Open Finance
 * Exibe transações de extrato bancário e sugere automaticamente
 * lançamentos contábeis para cada movimentação.
 * INÉDITO: engine de sugestão por pattern matching + contexto contábil.
 */
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, XCircle, Landmark, RefreshCw, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface BankTransaction {
  id:          string;
  date:        string;   // ISO
  description: string;
  amount:      number;   // positivo = crédito, negativo = débito
  type:        'credit' | 'debit';
  category?:   string;
}

interface SuggestedEntry {
  debit:   string;   // conta débito
  credit:  string;   // conta crédito
  history: string;   // histórico
  confidence: number; // 0–1
}

// ─── Mock: feed bancário simulado ────────────────────────────────────────────

const MOCK_FEED: BankTransaction[] = [
  { id: 'T1',  date: '2025-07-01', description: 'PIX RECEBIDO CLIENTE ALFA LTDA',           amount:  12_500.00, type: 'credit' },
  { id: 'T2',  date: '2025-07-01', description: 'PAGTO BOLETO FORNECEDOR DELTA',             amount:  -3_800.00, type: 'debit'  },
  { id: 'T3',  date: '2025-07-02', description: 'TED SALARIOS FUNCIONARIOS',                 amount: -15_000.00, type: 'debit'  },
  { id: 'T4',  date: '2025-07-02', description: 'RECEBIMENTO NF 1042 CLIENTE BETA',          amount:   8_200.00, type: 'credit' },
  { id: 'T5',  date: '2025-07-03', description: 'DAS SIMPLES NACIONAL',                      amount:  -1_260.00, type: 'debit'  },
  { id: 'T6',  date: '2025-07-03', description: 'ALUGUEL SEDE EMPRESA IMOVEIS SA',           amount:  -4_500.00, type: 'debit'  },
  { id: 'T7',  date: '2025-07-04', description: 'ENERGIA ELETRICA CEMIG',                    amount:    -380.00, type: 'debit'  },
  { id: 'T8',  date: '2025-07-04', description: 'RECEITA SERVICOS CONSULTORIA MES JUNHO',   amount:   6_000.00, type: 'credit' },
  { id: 'T9',  date: '2025-07-05', description: 'IOF OPERACAO CAMBIO',                       amount:     -42.00, type: 'debit'  },
  { id: 'T10', date: '2025-07-05', description: 'REEMBOLSO DESPESAS VIAGEM VENDEDOR',        amount:    -650.00, type: 'debit'  },
  { id: 'T11', date: '2025-07-07', description: 'PIX RECEBIDO CLIENTE GAMA COMERCIO',        amount:   5_400.00, type: 'credit' },
  { id: 'T12', date: '2025-07-07', description: 'MANUTENCAO SOFTWARE SISTEMA ERP',           amount:    -890.00, type: 'debit'  },
  { id: 'T13', date: '2025-07-08', description: 'APLICACAO FINANCEIRA CDB',                  amount: -10_000.00, type: 'debit'  },
  { id: 'T14', date: '2025-07-08', description: 'RESGATE CDB BANCO BRADESCO',                amount:  10_120.00, type: 'credit' },
  { id: 'T15', date: '2025-07-09', description: 'PAGTO INSS FOLHA JULHO',                    amount:  -2_100.00, type: 'debit'  },
];

// ─── Motor de sugestão por pattern matching ───────────────────────────────────

const PATTERNS: { regex: RegExp; debit: string; credit: string; history: string; confidence: number }[] = [
  // Receitas
  { regex: /pix recebido|recebimento nf|receita servicos|ted recebido/i,
    debit: '1.1.1 - Caixa e Bancos',          credit: '3.1 - Receita de Serviços/Vendas', history: 'Recebimento de cliente',           confidence: 0.92 },
  // Fornecedores / contas a pagar
  { regex: /pagto boleto fornecedor|pagamento fornecedor/i,
    debit: '2.1.2 - Fornecedores',             credit: '1.1.1 - Caixa e Bancos',           history: 'Pagamento a fornecedor',          confidence: 0.90 },
  // Salários
  { regex: /salario|salarios|folha/i,
    debit: '3.4.1 - Despesas com Pessoal',     credit: '1.1.1 - Caixa e Bancos',           history: 'Pagamento de salários',           confidence: 0.95 },
  // DAS / impostos
  { regex: /das simples|das-simples|imposto das|guia das/i,
    debit: '2.1.4 - Impostos a Pagar',         credit: '1.1.1 - Caixa e Bancos',           history: 'Pagamento DAS Simples Nacional', confidence: 0.97 },
  { regex: /inss|fgts/i,
    debit: '2.1.5 - Obrigações Trabalhistas',  credit: '1.1.1 - Caixa e Bancos',           history: 'Pagamento INSS/FGTS',            confidence: 0.96 },
  { regex: /iof/i,
    debit: '3.5.2 - Despesas Financeiras',     credit: '1.1.1 - Caixa e Bancos',           history: 'IOF sobre operação financeira',  confidence: 0.93 },
  // Aluguel
  { regex: /aluguel|locacao|locação/i,
    debit: '3.4.3 - Despesas com Aluguel',     credit: '1.1.1 - Caixa e Bancos',           history: 'Pagamento de aluguel',           confidence: 0.94 },
  // Energia / serviços públicos
  { regex: /energia eletrica|cemig|eletropaulo|enel|copel/i,
    debit: '3.4.5 - Despesas com Energia',     credit: '1.1.1 - Caixa e Bancos',           history: 'Conta de energia elétrica',      confidence: 0.95 },
  // Software / tecnologia
  { regex: /software|sistema|erp|manutencao.*sistema|assinatura.*sistema/i,
    debit: '3.4.6 - Despesas com Software/TI', credit: '1.1.1 - Caixa e Bancos',           history: 'Licença/manutenção de software', confidence: 0.88 },
  // Viagem
  { regex: /viagem|hospedagem|passagem|reembolso/i,
    debit: '3.4.7 - Despesas com Viagens',     credit: '1.1.1 - Caixa e Bancos',           history: 'Despesas de viagem',             confidence: 0.82 },
  // Aplicação financeira
  { regex: /aplicacao financeira|investimento cdb|aplicacao cdb/i,
    debit: '1.1.3 - Aplicações Financeiras',   credit: '1.1.1 - Caixa e Bancos',           history: 'Aplicação em CDB',               confidence: 0.91 },
  // Resgate
  { regex: /resgate cdb|resgate.*banco|rendimento/i,
    debit: '1.1.1 - Caixa e Bancos',           credit: '1.1.3 - Aplicações Financeiras',   history: 'Resgate de aplicação financeira',confidence: 0.89 },
];

function suggestEntry(tx: BankTransaction): SuggestedEntry | null {
  for (const p of PATTERNS) {
    if (p.regex.test(tx.description)) {
      return { debit: p.debit, credit: p.credit, history: p.history, confidence: p.confidence };
    }
  }
  // fallback genérico
  if (tx.type === 'credit') {
    return { debit: '1.1.1 - Caixa e Bancos', credit: '3.1 - Receita a Classificar', history: tx.description, confidence: 0.40 };
  }
  return { debit: '3.9 - Despesa a Classificar', credit: '1.1.1 - Caixa e Bancos', history: tx.description, confidence: 0.40 };
}

// ─── Componente de linha ──────────────────────────────────────────────────────

type TxStatus = 'pending' | 'accepted' | 'rejected';

function TransactionRow({
  tx,
  suggestion,
  status,
  onAccept,
  onReject,
}: {
  tx: BankTransaction;
  suggestion: SuggestedEntry | null;
  status: TxStatus;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isCredit = tx.type === 'credit';
  const conf = suggestion?.confidence ?? 0;
  const confColor = conf >= 0.9 ? 'text-emerald-600' : conf >= 0.7 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className={`card card-body py-3 px-4 flex flex-col gap-2 transition-opacity ${
      status === 'rejected' ? 'opacity-40' : ''
    }`}>
      {/* Linha superior */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isCredit
            ? <ArrowDownLeft className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            : <ArrowUpRight  className="h-4 w-4 text-red-500 flex-shrink-0" />
          }
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
            <p className="text-xs text-gray-400">
              {format(parseISO(tx.date), "dd MMM yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <span className={`font-bold text-sm flex-shrink-0 ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
          {isCredit ? '+' : ''}{tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </div>

      {/* Sugestão */}
      {suggestion && status === 'pending' && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs flex items-start justify-between gap-3">
          <div>
            <p className="text-gray-500 mb-0.5">Lançamento sugerido:</p>
            <p className="font-medium text-gray-700">D: {suggestion.debit}</p>
            <p className="font-medium text-gray-700">C: {suggestion.credit}</p>
            <p className="text-gray-500 mt-1">Histórico: {suggestion.history}</p>
            <p className={`mt-0.5 ${confColor} font-medium`}>
              Confiança: {(conf * 100).toFixed(0)}%
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onAccept}
              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
              title="Aceitar sugestão"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
            <button
              onClick={onReject}
              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
              title="Rejeitar"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Status final */}
      {status === 'accepted' && (
        <div className="bg-emerald-50 rounded-lg px-3 py-1.5 text-xs text-emerald-700 flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5" /> Lançamento aceito e registrado
        </div>
      )}
      {status === 'rejected' && (
        <div className="bg-gray-100 rounded-lg px-3 py-1.5 text-xs text-gray-500 flex items-center gap-1.5">
          <XCircle className="h-3.5 w-3.5" /> Ignorado — lançamento manual necessário
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function OpenFinancePage() {
  const companyId = useAuthStore((s) => s.currentCompanyId);
  const [statuses, setStatuses] = useState<Record<string, TxStatus>>({});

  const suggestions = useMemo(
    () => Object.fromEntries(MOCK_FEED.map((tx) => [tx.id, suggestEntry(tx)])),
    []
  );

  const pending  = MOCK_FEED.filter((tx) => !statuses[tx.id] || statuses[tx.id] === 'pending').length;
  const accepted = Object.values(statuses).filter((s) => s === 'accepted').length;

  function setStatus(id: string, s: TxStatus) {
    setStatuses((prev) => ({ ...prev, [id]: s }));
  }

  function acceptAll() {
    const all: Record<string, TxStatus> = {};
    MOCK_FEED.forEach((tx) => { all[tx.id] = 'accepted'; });
    setStatuses(all);
  }

  if (!companyId) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="card card-body max-w-sm text-center py-12">
          <Landmark className="mx-auto h-10 w-10 text-gray-300 mb-4" />
          <p className="text-gray-500 text-sm">Selecione uma empresa para usar a reconciliação bancária.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary-600" />
          Reconciliação Open Finance
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Transações bancárias com sugestões automáticas de lançamento contábil.
          <span className="ml-2 inline-flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full border border-primary-200">
            ✦ Exclusivo Pro Contador
          </span>
        </p>
      </div>

      {/* Resumo + ações */}
      <div className="card card-body flex items-center justify-between gap-4 bg-blue-50 border-blue-200">
        <div>
          <p className="font-semibold text-blue-800">
            {accepted} lançados · {pending} pendentes
          </p>
          <p className="text-xs text-gray-500">
            Extrato de julho/2025 · {MOCK_FEED.length} transações importadas
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={acceptAll} className="btn btn-primary text-xs flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Aceitar tudo
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {MOCK_FEED.map((tx) => (
          <TransactionRow
            key={tx.id}
            tx={tx}
            suggestion={suggestions[tx.id]}
            status={statuses[tx.id] ?? 'pending'}
            onAccept={() => setStatus(tx.id, 'accepted')}
            onReject={() => setStatus(tx.id, 'rejected')}
          />
        ))}
      </div>

      {/* Nota */}
      <div className="card card-body bg-gray-50 border-dashed text-xs text-gray-500">
        <p className="font-semibold text-gray-600 mb-1">Como funciona</p>
        <p>As transações são importadas via Open Finance (Banco Central). O motor de sugestões usa reconhecimento de padrões para propor o lançamento contábil correto. Você revisa e aprova — em um clique.</p>
      </div>
    </div>
  );
}
