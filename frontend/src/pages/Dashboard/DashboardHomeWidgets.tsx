import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight,
  CalendarClock,
  CloudDownload,
  Landmark,
  Plus,
  Receipt,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { DashboardService } from '../../services/dashboardService';
import { ContasPagarService } from '../../services/contasPagarService';
import { ContasReceberService } from '../../services/contasReceberService';
import { FiscalCaptureService } from '../../services/fiscalCaptureService';
import { PageLoader } from '../../components/ui/LoadingSpinner';

function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

interface HomeWidgetProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function HomeWidget({ title, children, action, className = '' }: HomeWidgetProps) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="card-body pt-4">{children}</div>
    </div>
  );
}

interface TaskItem {
  id: string;
  label: string;
  detail?: string;
  href: string;
  tone?: 'default' | 'warning' | 'info';
}

export default function DashboardHomeWidgets() {
  const companyId = useAuthStore((s) => s.currentCompanyId);
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const monthStart = useMemo(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'), []);

  const qBalance = useQuery({
    queryKey: ['dashboard', 'balance-sheet', companyId],
    queryFn: () => DashboardService.getBalanceSheet(companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const qDre = useQuery({
    queryKey: ['dashboard', 'dre-month', companyId, monthStart],
    queryFn: () => DashboardService.getDRE(companyId!, monthStart, todayStr),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const qPagar = useQuery({
    queryKey: ['dashboard', 'stats-pagar', companyId],
    queryFn: () => ContasPagarService.getEstatisticas(),
    enabled: !!companyId,
  });

  const qReceber = useQuery({
    queryKey: ['dashboard', 'stats-receber', companyId],
    queryFn: () => ContasReceberService.getEstatisticas(),
    enabled: !!companyId,
  });

  const qFiscal = useQuery({
    queryKey: ['dashboard', 'fiscal', companyId],
    queryFn: () => FiscalCaptureService.getStatus(),
    enabled: !!companyId,
  });

  const loading =
    qBalance.isLoading || qDre.isLoading || qPagar.isLoading || qReceber.isLoading;

  if (loading) return <PageLoader />;

  const balance = qBalance.data;
  const dre = qDre.data;
  const pagar = qPagar.data;
  const receber = qReceber.data;
  const fiscal = qFiscal.data;

  const caixaBancos = (balance?.ativo.circulante ?? [])
    .filter((a) => /caixa|banco|dispon/i.test(a.accountName))
    .reduce((sum, a) => sum + a.balance, 0);

  const lucroMes = dre?.lucroLiquido ?? 0;

  const tasks: TaskItem[] = [];

  if ((pagar?.total_vencido ?? 0) > 0) {
    const qtd = pagar?.por_status?.vencido?.quantidade ?? 0;
    tasks.push({
      id: 'pagar-vencido',
      label: `Pagar ${qtd || ''} conta(s) vencida(s)`.trim(),
      detail: brl(pagar!.total_vencido),
      href: '/contas-pagar?somente_atrasadas=1',
      tone: 'warning',
    });
  }

  if ((receber?.total_vencido ?? 0) > 0) {
    const qtd = receber?.por_status?.vencido?.quantidade ?? 0;
    tasks.push({
      id: 'receber-vencido',
      label: `Cobrar ${qtd || ''} título(s) em atraso`.trim(),
      detail: brl(receber!.total_vencido),
      href: '/contas-receber',
      tone: 'warning',
    });
  }

  if ((pagar?.proximos_7_dias ?? 0) > 0) {
    tasks.push({
      id: 'pagar-7d',
      label: 'Contas a pagar nos próximos 7 dias',
      detail: brl(pagar!.proximos_7_dias),
      href: '/contas-pagar',
    });
  }

  if (!fiscal?.certificate) {
    tasks.push({
      id: 'cert-a1',
      label: 'Cadastrar certificado A1 para captura de XML',
      href: '/documentos',
      tone: 'info',
    });
  } else if ((fiscal.captures_total ?? 0) === 0) {
    tasks.push({
      id: 'captura-xml',
      label: 'Executar primeira captura de NF-e / NFS-e',
      href: '/documentos',
      tone: 'info',
    });
  }

  for (const sync of fiscal?.sync ?? []) {
    if (sync.last_status === 'error' && sync.last_error) {
      tasks.push({
        id: `sync-${sync.doc_type}`,
        label: `Corrigir captura ${sync.doc_type.toUpperCase()}`,
        detail: sync.last_error.slice(0, 80),
        href: '/documentos',
        tone: 'warning',
      });
    }
  }

  tasks.push({
    id: 'open-finance',
    label: 'Conectar extrato bancário (Open Finance)',
    href: '/open-finance',
  });

  if (tasks.length === 0) {
    tasks.push({
      id: 'ok',
      label: 'Nenhuma pendência urgente — tudo em dia',
      href: '/lancamentos',
    });
  }

  const copilotPrompts = [
    { q: 'Quanto tenho a pagar esta semana?', href: '/copiloto' },
    { q: 'Qual o lucro do mês?', href: '/copiloto' },
    { q: 'Resumo das contas a receber', href: '/copiloto' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <HomeWidget
          title="Saldo em caixa e bancos"
          action={
            <Link to="/open-finance" className="text-xs font-medium text-primary-600 hover:underline">
              Conectar banco
            </Link>
          }
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">{brl(caixaBancos)}</p>
              <p className="text-xs text-gray-500 mt-1">No plano de contas (contas circulantes)</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Landmark className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Integração Open Finance em breve para comparar saldo banco × sistema.
          </p>
        </HomeWidget>

        <HomeWidget
          title="Contas a receber"
          action={
            <Link to="/contas-receber" className="text-xs font-medium text-primary-600 hover:underline">
              Ver todas
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xl font-bold text-gray-900">{brl(receber?.total_aberto ?? 0)}</p>
              <p className="text-xs text-gray-500">Em aberto</p>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-600">{brl(receber?.total_vencido ?? 0)}</p>
              <p className="text-xs text-gray-500">Vencido</p>
            </div>
          </div>
          <Link
            to="/contas-receber"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova conta a receber
          </Link>
        </HomeWidget>

        <HomeWidget
          title="Contas a pagar"
          action={
            <Link to="/contas-pagar" className="text-xs font-medium text-primary-600 hover:underline">
              Ver todas
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xl font-bold text-gray-900">{brl(pagar?.total_aberto ?? 0)}</p>
              <p className="text-xs text-gray-500">Em aberto</p>
            </div>
            <div>
              <p className="text-xl font-bold text-red-600">{brl(pagar?.total_vencido ?? 0)}</p>
              <p className="text-xs text-gray-500">Vencido</p>
            </div>
          </div>
          <Link
            to="/contas-pagar"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova conta a pagar
          </Link>
        </HomeWidget>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HomeWidget title="Tarefas de hoje">
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  to={task.href}
                  className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 transition hover:border-primary-200 hover:bg-primary-50/40"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {(task.tone === 'warning' && (
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    )) ||
                      (task.tone === 'info' && (
                        <CloudDownload className="h-4 w-4 shrink-0 text-primary-500 mt-0.5" />
                      )) || (
                        <CalendarClock className="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
                      )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{task.label}</p>
                      {task.detail && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{task.detail}</p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        </HomeWidget>

        <div className="space-y-4">
          <HomeWidget title="Resultado do mês">
            <div className="flex items-end justify-between">
              <div>
                <p
                  className={`text-2xl font-bold ${
                    lucroMes >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {brl(lucroMes)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Lucro líquido · {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-gray-200" />
            </div>
            <Link
              to="/relatorios/dre"
              className="mt-4 inline-flex text-sm font-medium text-primary-600 hover:underline"
            >
              Ver DRE completa
            </Link>
          </HomeWidget>

          <HomeWidget
            title="Captura fiscal"
            action={
              <Link to="/documentos" className="text-xs font-medium text-primary-600 hover:underline">
                Painel XML
              </Link>
            }
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{fiscal?.captures_total ?? 0}</p>
                <p className="text-xs text-gray-500">
                  {fiscal?.certificate ? 'XMLs capturados · certificado OK' : 'Sem certificado A1'}
                </p>
              </div>
            </div>
          </HomeWidget>
        </div>
      </div>

      <HomeWidget title="Pergunte ao Copiloto" className="lg:max-w-2xl">
        <p className="text-sm text-gray-500 mb-3">
          Atalhos rápidos — abre o Copiloto com contexto da empresa.
        </p>
        <div className="flex flex-wrap gap-2">
          {copilotPrompts.map((p) => (
            <Link
              key={p.q}
              to={p.href}
              state={{ initialQuestion: p.q }}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-primary-300 hover:text-primary-700"
            >
              {p.q}
            </Link>
          ))}
        </div>
      </HomeWidget>
    </div>
  );
}
