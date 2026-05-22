import type { User } from '../types';

const rawValue = import.meta.env.VITE_PUBLIC_ACCESS;

export const PUBLIC_ACCESS_ENABLED = rawValue != null
  ? false
  : false;

export const DEMO_COMPANY_ID = 'company-demo-public';

export const PUBLIC_ACCESS_USER: User = {
  id: 'public-access-user',
  email: 'acesso-publico@procontador.com.br',
  name: 'Demo Publico',
  role: 'admin',
  mfaEnabled: false,
  companyId: DEMO_COMPANY_ID,
};
