import { LucideIcon } from 'lucide-react';

export type ServiceCategory = 'fiscal' | 'financeiro' | 'contabil' | 'relatorios' | 'gestao' | 'auditoria';

export type ServiceStatus = 'active' | 'warning' | 'error' | 'disabled';

export interface QuickAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}

export interface ServiceMetric {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export interface ServiceHelp {
  summary: string;
  requiredInputs?: string[];
  examples?: string[];
  automation?: string;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: ServiceCategory;
  route: string;
  externalUrl?: string;
  status?: ServiceStatus;
  badge?: string | number;
  metrics?: ServiceMetric[];
  quickActions?: QuickAction[];
  help?: ServiceHelp;
  automated?: boolean;
}

export interface CategoryConfig {
  name: string;
  color: string;
  icon: LucideIcon;
  description: string;
}
