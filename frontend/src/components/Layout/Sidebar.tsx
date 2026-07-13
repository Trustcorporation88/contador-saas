import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types';
import { canAccessPath } from '../../utils/access';
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
  ClipboardList,
  HeartPulse,
  Sliders,
  GitCompareArrows,
  ShieldAlert,
  Landmark,
  Bot,
  Lock,
  Users,
  X,
} from 'lucide-react';

// â”€â”€â”€ Nav structure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  badge?: string;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard',          icon: LayoutDashboard, path: '/dashboard'              },
  { label: 'Cliente',            icon: Users,           path: '/cliente'                },
  { label: 'Empresas',           icon: Building2,       path: '/empresas'               },
  { label: 'Plano de Contas',    icon: BookOpen,        path: '/contas'                 },
  { label: 'Lançamentos',        icon: FileText,        path: '/lancamentos'            },
  { label: 'Documentos Fiscais', icon: FileText,        path: '/documentos'             },
  { label: 'Emissão NF-e',       icon: FileText,        path: '/documentos/nfe'         },
  { label: 'Contas a Receber',   icon: FileText,        path: '/contas-receber'         },
  { label: 'Contas a Pagar',     icon: FileText,        path: '/contas-pagar'           },
  {
    label: 'Relatórios',
    icon: BarChart3,
    children: [
      { label: 'Fluxo de Caixa',      path: '/relatorios/fluxo-caixa' },
      { label: 'Balanço Patrimonial', path: '/relatorios/balanco' },
      { label: 'DRE',                 path: '/relatorios/dre'     },
      { label: 'Outros Relatórios',   path: '/relatorios/outros'  },
    ],
  },
  { label: 'Apuração Impostos',  icon: Calculator,  path: '/impostos'      },
  { label: 'Auditoria & Logs',   icon: Shield,      path: '/auditoria'     },
  { label: 'Central de Serviços', icon: ClipboardList, path: '/servicos/hub'   },
  { label: 'Guia Operacional',   icon: BookOpen, path: '/servicos'    },
  { label: 'Configurações',      icon: Settings,    path: '/configuracoes' },
  // â”€â”€ Módulos inovadores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { label: 'Saúde Financeira',   icon: HeartPulse,  path: '/saude',        badge: 'âœ¦' },
  { label: 'Simulador Fiscal',   icon: Sliders,     path: '/simulador',    badge: 'âœ¦' },
  { label: 'Benchmark Setorial', icon: GitCompareArrows, path: '/benchmark', badge: 'âœ¦' },
  { label: 'Risco Fiscal SPED',  icon: ShieldAlert, path: '/risco-fiscal', badge: 'âœ¦' },
  { label: 'Open Finance',       icon: Landmark,    path: '/open-finance', badge: 'âœ¦' },
  { label: 'Copiloto IA',        icon: Bot,         path: '/copiloto',     badge: 'âœ¦' },
  { label: 'Prova Criptográfica',icon: Lock,        path: '/prova-hash',   badge: 'âœ¦' },
];

// â”€â”€â”€ Divider between standard and innovative â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const INNOVATIVE_PATHS = ['/saude', '/simulador', '/benchmark', '/risco-fiscal', '/open-finance', '/copiloto', '/prova-hash'];

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const role = useAuthStore((state) => state.user?.role) as UserRole | undefined;
  const [reportsOpen, setReportsOpen] = useState(
    location.pathname.startsWith('/relatorios')
  );

  const visibleItems = navItems
    .filter((item) => {
      if (item.path) return canAccessPath(role, item.path);
      return item.children?.some((child) => canAccessPath(role, child.path));
    })
    .map((item) => {
      if (!item.children) return item;
      return {
        ...item,
        children: item.children.filter((child) => canAccessPath(role, child.path)),
      };
    });

  return (
    <>
      <div
        className={clsx(
          'fixed inset-0 z-30 bg-ink-950/35 backdrop-blur-sm transition-opacity lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-[18rem] max-w-[88vw] flex-col border-r border-white/70 bg-[rgba(11,28,23,0.9)] text-white shadow-2xl backdrop-blur-2xl transition-transform duration-300 lg:static lg:z-auto lg:w-72 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
      {/* Brand */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 shadow-glow">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight tracking-tight text-white">Pro Contador</p>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Lei 6.404/76</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 p-2 text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item, idx) => {
          // Divider before innovative section
          const prevPath = navItems[idx - 1]?.path;
          const showDivider = item.badge === 'âœ¦' && (!prevPath || !INNOVATIVE_PATHS.includes(prevPath));

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
                  <div className="ml-7 mt-1 space-y-1 border-l border-white/10 pl-3 animate-slide-in-left">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                          clsx('nav-item text-xs text-white/70', isActive && 'nav-item-active')
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
                <div className="px-2 pb-2 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary-300/85">
                    Camada Inteligente
                  </p>
                </div>
              )}
              <NavLink
                to={item.path!}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx('nav-item', !isActive && 'text-white/72 hover:text-white', isActive && 'nav-item-active')
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-100">
                    IA
                  </span>
                )}
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Version footer */}
      <div className="border-t border-white/10 px-5 py-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Workspace</p>
          <p className="mt-1 text-sm font-semibold text-white">Console Contábil</p>
          <p className="mt-2 text-xs text-white/50">v1.0.0 Â· {new Date().getFullYear()}</p>
        </div>
      </div>
      </aside>
    </>
  );
}
