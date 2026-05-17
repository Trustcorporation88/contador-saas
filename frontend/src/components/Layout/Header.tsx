import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { AuthService } from '../../services/authService';

// ─── Breadcrumb map ───────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':          'Dashboard',
  '/empresas':           'Empresas',
  '/contas':             'Plano de Contas',
  '/lancamentos':        'Lançamentos Contábeis',
  '/relatorios/balanco': 'Balanço Patrimonial',
  '/relatorios/dre':     'DRE',
  '/relatorios/outros':  'Outros Relatórios',
  '/impostos':           'Apuração de Impostos',
  '/auditoria':          'Auditoria & Logs',
  '/configuracoes':      'Configurações',
};

export default function Header() {
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

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Contador SaaS';

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
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shrink-0">
      {/* Page title */}
      <h1 className="text-base font-semibold text-gray-900">{pageTitle}</h1>

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm
                     hover:bg-gray-100 transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white text-xs font-semibold">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="font-medium text-gray-900 leading-tight">{user?.name ?? '—'}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role ?? ''}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white
                          border border-gray-200 shadow-lg py-1 z-50 animate-fade-in">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <a
              href="/configuracoes"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <UserIcon className="h-4 w-4" />
              Meu Perfil
            </a>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600
                         hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
