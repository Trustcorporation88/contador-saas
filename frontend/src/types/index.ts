// ─── Auth ───────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'accountant' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  mfaEnabled: boolean;
  companyId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  totpToken?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  cnpj: string;
  companyName: string;
  taxRegime: TaxRegime;
}

// ─── Company ─────────────────────────────────────────────────────────────────

export type TaxRegime = 'simples_nacional' | 'lucro_presumido' | 'lucro_real';

export interface Company {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  regimeTributario: TaxRegime;
  exercicioFiscal: number;
  ativo: boolean;
  endereco?: CompanyAddress;
  createdAt: string;
}

export interface CompanyAddress {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

// ─── Accounts (Plano de Contas) ───────────────────────────────────────────────

export type AccountType =
  | 'ativo'
  | 'passivo'
  | 'patrimonio_liquido'
  | 'receita'
  | 'despesa'
  | 'custo';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  isAnalytical: boolean;
  taxCode?: string;
  balance?: number;
  children?: Account[];
  companyId: string;
}

// ─── Journal Entries ─────────────────────────────────────────────────────────

export interface JournalLine {
  id?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  costCenterId?: string;
  description?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  companyId: string;
  lines: JournalLine[];
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
  documentNumber?: string;
  documentType?: string;
  totalDebit?: number;
  totalCredit?: number;
}

export interface CreateJournalEntryPayload {
  date: string;
  description: string;
  lines: Omit<JournalLine, 'id' | 'accountCode' | 'accountName'>[];
  documentNumber?: string;
  documentType?: string;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface BalanceSheetItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
  children?: BalanceSheetItem[];
}

export interface BalanceSheet {
  date: string;
  ativo: {
    circulante: BalanceSheetItem[];
    naoCirculante: BalanceSheetItem[];
    total: number;
  };
  passivo: {
    circulante: BalanceSheetItem[];
    naoCirculante: BalanceSheetItem[];
    total: number;
  };
  patrimonioLiquido: {
    items: BalanceSheetItem[];
    total: number;
  };
}

export interface DREItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  value: number;
}

export interface DRE {
  startDate: string;
  endDate: string;
  receitaBruta: DREItem[];
  deducoes: DREItem[];
  receitaLiquida: number;
  custoVendas: number;
  lucroBruto: number;
  despesasOperacionais: DREItem[];
  resultadoOperacional: number;
  receitasFinanceiras: number;
  despesasFinanceiras: number;
  resultadoAntesIR: number;
  impostos: number;
  lucroLiquido: number;
}

// ─── Tax Calculation ─────────────────────────────────────────────────────────

export type TaxType = 'IRPJ' | 'CSLL' | 'PIS' | 'COFINS' | 'ISS' | 'ICMS' | 'DAS';

export interface TaxCalculationResult {
  id: string;
  companyId: string;
  taxType: TaxType;
  period: string;
  calculatedAmount: number;
  baseAmount: number;
  aliquota: number;
  status: 'calculado' | 'ajustado' | 'pago';
  details: Record<string, number>;
  createdAt: string;
}

// ─── NF-e ─────────────────────────────────────────────────────────────────────

export type NfeStatus = 'RASCUNHO' | 'PENDENTE' | 'AUTORIZADA' | 'CANCELADA' | 'DENEGADA';

export interface NfeRecord {
  id: string;
  companyId: string;
  numero: number;
  serie: string;
  chaveAcesso: string;
  status: NfeStatus;
  dataEmissao: string;
  valorTotal: number;
  destinatarioNome: string;
  destinatarioCnpj?: string;
  createdAt: string;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  userId: string;
  userEmail?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'EXPORT';
  entity: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, string[]>;
}
