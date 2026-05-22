import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, ChevronDown, PanelLeft, Sparkles } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { AuthService } from '../../services/authService';
import { PUBLIC_ACCESS_ENABLED } from '../../config/publicAccess';
import { getOperationalStatusMeta, getServiceDefinition } from '../../config/serviceCatalog';

// ─── Breadcrumb map ───────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':          'Dashboard',
  '/cliente':            'Cliente',
  '/empresas':           'Empresas',
  '/contas':             'Plano de Contas',
  '/lancamentos':        'Lançamentos Contábeis',
  '/relatorios/fluxo-caixa': 'Fluxo de Caixa',
  '/relatorios/balanco': 'Balanço Patrimonial',
  '/relatorios/dre':     'DRE',
  '/relatorios/outros':  'Outros Relatórios',
  '/impostos':           'Apuração de Impostos',
  '/auditoria':          'Auditoria & Logs',
  '/servicos':           'Guia Operacional',
  '/configuracoes':      'Configurações',
  '/saude':             'Saúde Financeira',
  '/simulador':         'Simulador Fiscal',
  '/benchmark':         'Benchmark Setorial',
  '/risco-fiscal':      'Risco Fiscal SPED',
  '/open-finance':      'Open Finance',
  '/copiloto':          'Copiloto IA',
  '/prova-hash':        'Prova Criptográfica',
};

interface HeaderProps {
  onToggleSidebar: () => void;
}

function resolvePageTitle(pathname: string): string {
  if (pathname.startsWith('/lancamentos/novo')) return 'Novo Lançamento';
  if (pathname.includes('/editar')) return 'Editar Lançamento';
  return PAGE_TITLES[pathname] ?? 'Central Operacional';
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const location = useLocation();
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);
  const storeLogout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await AuthService.logout();
    storeLogout();
    navigate('/login', { replace: true });
  };

  const pageTitle = resolvePageTitle(location.pathname);
  const service = getServiceDefinition(location.pathname);
  const serviceStatus = service ? getOperationalStatusMeta(service.status) : null;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-white/60 bg-white/65 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="glass-strip flex min-h-[72px] items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-2xl border border-ink-100 bg-white/80 p-2.5 text-ink-700 transition hover:border-primary-200 hover:text-primary-700 lg:hidden"
            aria-label="Abrir menu"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <p className="shell-title">Painel de navegação</p>
            <h1 className="truncate text-lg font-extrabold tracking-tight text-ink-900">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden rounded-2xl border border-primary-100 bg-primary-50 px-3 py-2 text-right sm:block">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-700/70">
              <Sparkles className="h-3.5 w-3.5" />
              {PUBLIC_ACCESS_ENABLED ? 'Modo demo' : 'Modo real'}
            </div>
            <p className="mt-1 text-sm font-semibold text-ink-800">
              {serviceStatus ? `${serviceStatus.label} · ${service?.title}` : 'Estrutura contábil ativa'}
            </p>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/85 px-3 py-2.5 text-sm shadow-sm transition hover:border-primary-200 hover:bg-white"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold text-white shadow-glow">
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="hidden text-left sm:block">
                <p className="font-semibold leading-tight text-ink-900">{user?.name ?? '—'}</p>
                <p className="text-xs capitalize text-ink-400">{user?.role ?? ''}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-[24px] border border-white/80 bg-white/92 py-2 shadow-panel backdrop-blur-xl animate-fade-in">
                <div className="border-b border-ink-100 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">Conta ativa</p>
                  <p className="mt-1 truncate text-sm font-semibold text-ink-900">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/configuracoes');
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink-700 transition hover:bg-primary-50"
                >
                  <UserIcon className="h-4 w-4" />
                  Meu Perfil
                </button>
                {!PUBLIC_ACCESS_ENABLED && (
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
