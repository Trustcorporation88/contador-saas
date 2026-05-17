import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  FileText,
  BarChart3,
  Calculator,
  Shield,
  Settings,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  HeartPulse,
  Sliders,
  GitCompareArrows,
  ShieldAlert,
  Landmark,
  Bot,
  Lock,
} from 'lucide-react';

// ─── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  badge?: string;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard',          icon: LayoutDashboard, path: '/dashboard'              },
  { label: 'Empresas',           icon: Building2,       path: '/empresas'               },
  { label: 'Plano de Contas',    icon: BookOpen,        path: '/contas'                 },
  { label: 'Lançamentos',        icon: FileText,        path: '/lancamentos'            },
  {
    label: 'Relatórios',
    icon: BarChart3,
    children: [
      { label: 'Balanço Patrimonial', path: '/relatorios/balanco' },
      { label: 'DRE',                 path: '/relatorios/dre'     },
      { label: 'Outros Relatórios',   path: '/relatorios/outros'  },
    ],
  },
  { label: 'Apuração Impostos',  icon: Calculator,  path: '/impostos'      },
  { label: 'Auditoria & Logs',   icon: Shield,      path: '/auditoria'     },
  { label: 'Configurações',      icon: Settings,    path: '/configuracoes' },
  // ── Módulos inovadores ──────────────────────────────────────────────────
  { label: 'Saúde Financeira',   icon: HeartPulse,  path: '/saude',        badge: '✦' },
  { label: 'Simulador Fiscal',   icon: Sliders,     path: '/simulador',    badge: '✦' },
  { label: 'Benchmark Setorial', icon: GitCompareArrows, path: '/benchmark', badge: '✦' },
  { label: 'Risco Fiscal SPED',  icon: ShieldAlert, path: '/risco-fiscal', badge: '✦' },
  { label: 'Open Finance',       icon: Landmark,    path: '/open-finance', badge: '✦' },
  { label: 'Copiloto IA',        icon: Bot,         path: '/copiloto',     badge: '✦' },
  { label: 'Prova Criptográfica',icon: Lock,        path: '/prova-hash',   badge: '✦' },
];

// ─── Divider between standard and innovative ─────────────────────────────────
const INNOVATIVE_PATHS = ['/saude', '/simulador', '/benchmark', '/risco-fiscal', '/open-finance', '/copiloto', '/prova-hash'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const location = useLocation();
  const [reportsOpen, setReportsOpen] = useState(
    location.pathname.startsWith('/relatorios')
  );

  return (
    <aside className="flex w-64 flex-col bg-white border-r border-gray-200 shrink-0">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-gray-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">O Contador</p>
          <p className="text-xs text-gray-400">Lei 6.404/76</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item, idx) => {
          // Divider before innovative section
          const prevPath = navItems[idx - 1]?.path;
          const showDivider = item.badge === '✦' && (!prevPath || !INNOVATIVE_PATHS.includes(prevPath));

          if (item.children) {
            const isGroupActive = item.children.some((c) =>
              location.pathname.startsWith(c.path)
            );
            return (
              <div key={item.label}>
                <button
                  onClick={() => setReportsOpen((o) => !o)}
                  className={clsx(
                    'nav-item w-full justify-between',
                    isGroupActive && 'nav-item-active'
                  )}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </span>
                  {reportsOpen
                    ? <ChevronDown className="h-3.5 w-3.5" />
                    : <ChevronRight className="h-3.5 w-3.5" />}
                </button>

                {reportsOpen && (
                  <div className="ml-7 mt-0.5 space-y-0.5 border-l border-gray-100 pl-3">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          clsx('nav-item text-xs', isActive && 'nav-item-active')
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={item.path}>
              {showDivider && (
                <div className="pt-3 pb-1 px-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-500">
                    ✦ Exclusivo
                  </p>
                </div>
              )}
              <NavLink
                to={item.path!}
                className={({ isActive }) =>
                  clsx('nav-item', isActive && 'nav-item-active')
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Version footer */}
      <div className="px-6 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">v1.0.0 · {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}
