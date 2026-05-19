import type { UserRole } from '../types';

const FULL_ACCESS: UserRole[] = ['admin', 'accountant'];
const REPORT_ACCESS: UserRole[] = ['admin', 'accountant', 'manager', 'auditor'];
const CLIENT_ACCESS: UserRole[] = ['admin', 'accountant', 'manager', 'auditor', 'viewer'];
const TAX_ACCESS: UserRole[] = ['admin', 'accountant', 'manager'];
const AUDIT_ACCESS: UserRole[] = ['admin', 'auditor'];
const SETTINGS_ACCESS: UserRole[] = ['admin', 'accountant', 'manager', 'auditor', 'viewer'];

export function getDefaultRoute(role?: UserRole | null): string {
  switch (role) {
    case 'viewer':
      return '/cliente';
    case 'auditor':
      return '/auditoria';
    default:
      return '/dashboard';
  }
}

export function canAccessPath(role: UserRole | undefined, path: string): boolean {
  if (!role) return false;

  if (path === '/cliente') return CLIENT_ACCESS.includes(role);
  if (path === '/configuracoes') return SETTINGS_ACCESS.includes(role);
  if (path === '/auditoria') return AUDIT_ACCESS.includes(role);
  if (path === '/impostos') return TAX_ACCESS.includes(role);
  if (path.startsWith('/relatorios/')) return REPORT_ACCESS.includes(role);
  if (path === '/dashboard') return role !== 'viewer';
  if (
    [
      '/empresas',
      '/contas',
      '/lancamentos',
      '/documentos',
      '/contas-receber',
      '/contas-pagar',
    ].some((item) => path === item || path.startsWith(`${item}/`))
  ) {
    return FULL_ACCESS.includes(role);
  }

  if (
    ['/saude', '/simulador', '/benchmark', '/risco-fiscal', '/open-finance', '/copiloto', '/prova-hash']
      .some((item) => path === item || path.startsWith(`${item}/`))
  ) {
    return role === 'admin' || role === 'accountant' || role === 'manager';
  }

  return role === 'admin';
}
