/**
 * TypeScript type definitions and interfaces
 */

// User
export interface IUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'auditor' | 'accountant' | 'manager' | 'viewer';
  companyId: string;
  active: boolean;
  twoFactorEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Company
export interface ICompany {
  id: string;
  name: string;
  cnpj: string;
  taxRegime: 'lucro_real' | 'lucro_presumido' | 'simples_nacional';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Account
export interface IAccount {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  analytical: boolean;
  parentId?: string;
  taxCode?: string;
  companyId: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Journal Entry
export interface IJournalEntry {
  id: string;
  date: Date;
  description: string;
  status: 'draft' | 'posted' | 'cancelled' | 'reversed';
  companyId: string;
  items: IJournalItem[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJournalItem {
  id: string;
  journalId: string;
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

// API Response Types
export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: Date;
}

export interface IPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: Date;
}

export default {
  IUser,
  ICompany,
  IAccount,
  IJournalEntry,
  IJournalItem,
  IApiResponse,
  IPaginatedResponse,
};
