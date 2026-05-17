/**
 * ConfiguracoesPage — Configurações da empresa, perfil do usuário e segurança
 * Task 3.13
 * UX: Superior a QuickBooks Settings + Xero Organization Settings
 * Seções: Empresa | Perfil | Segurança (MFA) | Sobre
 */
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, User, ShieldCheck, Info,
  CheckCircle, AlertTriangle, Eye, EyeOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { CompanyService } from '../../services/companyService';
import api from '../../config/api';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const companySchema = z.object({
  name:               z.string().min(2, 'Nome obrigatório'),
  email:              z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone:              z.string().optional(),
  tax_regime:         z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real']),
  fiscal_year_start:  z.coerce.number().int().min(1).max(12),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Senha atual obrigatória'),
  new_password:     z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Deve conter letra maiúscula')
    .regex(/[0-9]/, 'Deve conter número'),
  confirm_password: z.string(),
}).refine((v) => v.new_password === v.confirm_password, {
  message: 'Senhas não conferem',
  path: ['confirm_password'],
});

type CompanyForm   = z.infer<typeof companySchema>;
type PasswordForm  = z.infer<typeof passwordSchema>;
type Tab = 'empresa' | 'perfil' | 'seguranca' | 'sobre';

// ─── Toast helper ─────────────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const show = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };
  return { msg, show };
}

function Toast({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null;
  return (
    <div className={clsx(
      'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg text-sm font-medium transition-all',
      msg.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
    )}>
      {msg.ok ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      {msg.text}
    </div>
  );
}

// ─── Empresa tab ──────────────────────────────────────────────────────────────

function EmpresaTab({ companyId, toast }: { companyId: string; toast: (t: string, ok?: boolean) => void }) {
  const qc = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company-detail', companyId],
    queryFn:  () => CompanyService.getById(companyId),
    staleTime: 60_000,
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  });

  useEffect(() => {
    if (company) {
      reset({
        name:              company.name,
        email:             company.email ?? '',
        phone:             company.phone ?? '',
        tax_regime:        company.tax_regime,
        fiscal_year_start: company.fiscal_year_start ?? 1,
      });
    }
  }, [company, reset]);

  const mut = useMutation({
    mutationFn: (vals: CompanyForm) => CompanyService.update(companyId, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-detail', companyId] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      toast('Empresa atualizada com sucesso!');
    },
    onError: () => toast('Erro ao atualizar empresa', false),
  });

  if (isLoading) return <div className="text-gray-400 text-sm py-8 text-center">Carregando...</div>;

  return (
    <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-5 max-w-xl">
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Dados da Empresa</h3>

        {/* CNPJ imutável */}
        <div>
          <label className="input-label">CNPJ</label>
          <div className="input-field bg-gray-50 text-gray-500 select-none cursor-not-allowed">
            {company?.cnpj ?? '—'}
          </div>
          <p className="text-xs text-gray-400 mt-1">O CNPJ não pode ser alterado.</p>
        </div>

        <div>
          <label className="input-label">Razão Social *</label>
          <input {...register('name')} className={clsx('input-field', errors.name && 'input-error')} />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">E-mail</label>
            <input {...register('email')} type="email" className={clsx('input-field', errors.email && 'input-error')} />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="input-label">Telefone</label>
            <input {...register('phone')} className="input-field" placeholder="(11) 99999-9999" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Regime Tributário</label>
            <select {...register('tax_regime')} className="input-field">
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>
          <div>
            <label className="input-label">Início do Exercício (mês)</label>
            <select {...register('fiscal_year_start')} className="input-field">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString('pt-BR', { month: 'long' })} ({m})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!isDirty || mut.isPending}
          className="btn btn-primary"
        >
          {mut.isPending ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
}

// ─── Password tab ─────────────────────────────────────────────────────────────

function PerfilTab({ toast }: { toast: (t: string, ok?: boolean) => void }) {
  const { user } = useAuthStore();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const mut = useMutation({
    mutationFn: (vals: PasswordForm) =>
      api.post('/auth/change-password', {
        current_password: vals.current_password,
        new_password:     vals.new_password,
      }),
    onSuccess: () => { toast('Senha alterada com sucesso!'); reset(); },
    onError:   () => toast('Senha atual incorreta ou erro no servidor', false),
  });

  return (
    <div className="space-y-5 max-w-xl">
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Informações da Conta</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-400 text-xs">E-mail</p>
            <p className="font-medium text-gray-800">{user?.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Perfil</p>
            <p className="font-medium text-gray-800 capitalize">{user?.role ?? '—'}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Alterar Senha</h3>

        <div className="relative">
          <label className="input-label">Senha Atual</label>
          <div className="relative">
            <input
              {...register('current_password')}
              type={showCurrent ? 'text' : 'password'}
              className={clsx('input-field pr-10', errors.current_password && 'input-error')}
            />
            <button type="button" onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.current_password && <p className="text-xs text-red-600 mt-1">{errors.current_password.message}</p>}
        </div>

        <div className="relative">
          <label className="input-label">Nova Senha</label>
          <div className="relative">
            <input
              {...register('new_password')}
              type={showNew ? 'text' : 'password'}
              className={clsx('input-field pr-10', errors.new_password && 'input-error')}
            />
            <button type="button" onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.new_password && <p className="text-xs text-red-600 mt-1">{errors.new_password.message}</p>}
          <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres, 1 maiúscula, 1 número.</p>
        </div>

        <div>
          <label className="input-label">Confirmar Nova Senha</label>
          <input
            {...register('confirm_password')}
            type="password"
            className={clsx('input-field', errors.confirm_password && 'input-error')}
          />
          {errors.confirm_password && <p className="text-xs text-red-600 mt-1">{errors.confirm_password.message}</p>}
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={mut.isPending} className="btn btn-primary">
            {mut.isPending ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── MFA tab ──────────────────────────────────────────────────────────────────

function SegurancaTab({ toast }: { toast: (t: string, ok?: boolean) => void }) {
  const { user } = useAuthStore();
  const [qrCode, setQrCode]   = useState<string | null>(null);
  const [secret, setSecret]   = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [phase, setPhase]     = useState<'idle' | 'setup' | 'done'>('idle');

  const enableMut = useMutation({
    mutationFn: () => api.post('/auth/enable-mfa'),
    onSuccess: (res) => {
      setQrCode((res.data as { qrCode?: string }).qrCode ?? null);
      setSecret((res.data as { secret?: string }).secret ?? null);
      setPhase('setup');
    },
    onError: () => toast('Erro ao gerar QR Code MFA', false),
  });

  const verifyMut = useMutation({
    mutationFn: () => api.post('/auth/verify-mfa', { token: totpCode }),
    onSuccess: () => { toast('MFA ativado com sucesso!'); setPhase('done'); },
    onError: () => toast('Código inválido. Tente novamente.', false),
  });

  return (
    <div className="space-y-5 max-w-xl">
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Autenticação de Dois Fatores (MFA)</h3>
            <p className="text-xs text-gray-500">TOTP compatível com Google Authenticator, Authy, 1Password</p>
          </div>
        </div>

        {phase === 'idle' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              <strong>Recomendado:</strong> MFA protege sua conta mesmo se sua senha for comprometida.
            </div>
            <button
              onClick={() => enableMut.mutate()}
              disabled={enableMut.isPending}
              className="btn btn-primary"
            >
              {enableMut.isPending ? 'Gerando QR Code...' : 'Ativar MFA'}
            </button>
          </div>
        )}

        {phase === 'setup' && qrCode && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              1. Abra seu aplicativo de autenticação.<br />
              2. Escaneie o QR Code abaixo.<br />
              3. Digite o código de 6 dígitos para confirmar.
            </p>
            <div className="flex justify-center">
              <img src={qrCode} alt="QR Code MFA" className="w-40 h-40 border border-gray-200 rounded-lg" />
            </div>
            {secret && (
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Chave manual:</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono tracking-widest">
                  {secret}
                </code>
              </div>
            )}
            <div>
              <label className="input-label">Código TOTP (6 dígitos)</label>
              <div className="flex gap-3">
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-field text-center tracking-widest font-mono w-36"
                  placeholder="000000"
                  maxLength={6}
                />
                <button
                  onClick={() => verifyMut.mutate()}
                  disabled={totpCode.length !== 6 || verifyMut.isPending}
                  className="btn btn-primary"
                >
                  Verificar
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 flex-none" />
            <div>
              <p className="text-sm font-semibold text-green-800">MFA ativado com sucesso!</p>
              <p className="text-xs text-green-600">Será solicitado na próxima sessão.</p>
            </div>
          </div>
        )}
      </div>

      {/* Sessões info */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Informações de Segurança</h3>
        <div className="text-sm text-gray-500 space-y-2">
          <div className="flex justify-between">
            <span>Usuário</span>
            <span className="font-mono text-xs">{user?.id?.slice(0, 8) ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span>Tokens JWT</span>
            <span>Access 1h / Refresh 7d</span>
          </div>
          <div className="flex justify-between">
            <span>Criptografia</span>
            <span>HS256 + SHA-256 Audit Hash</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sobre tab ────────────────────────────────────────────────────────────────

function SobreTab() {
  const features = [
    { label: 'Multi-tenant SaaS',        desc: 'Isolamento total de dados por empresa via Row-Level Security' },
    { label: 'Lei 6.404/76',             desc: 'Partidas dobradas obrigatórias, imutabilidade de lançamentos postados' },
    { label: 'SPED Contábil',            desc: 'Exportação ECD/ECF conforme IN RFB 1.774/2017' },
    { label: 'NF-e / NFS-e',            desc: 'Emissão e recebimento de notas fiscais integrado' },
    { label: 'Plano de Contas COSIF',    desc: 'Hierarquia 5 níveis, contas sintéticas e analíticas' },
    { label: 'Apuração automática',      desc: 'IRPJ, CSLL, PIS, COFINS, ISS, DAS — alíquotas 2025/2026' },
    { label: 'Trilha de Auditoria',      desc: 'SHA-256 hash em cada lançamento, log imutável de todas as ações' },
    { label: 'MFA TOTP',                 desc: 'Autenticação de dois fatores, compatível com Google Authenticator' },
  ];

  const benchmarks = [
    { name: 'Omie ERP',      country: '🇧🇷', price: 'R$569+/mês',   highlight: 'ERP completo' },
    { name: 'Contabilizei',  country: '🇧🇷', price: 'R$89+/mês',    highlight: 'Serviço gerenciado' },
    { name: 'QuickBooks',    country: '🇺🇸', price: '$19–137/mês',  highlight: '#1 EUA, IA Intuit' },
    { name: 'Xero',          country: '🇦🇺', price: '$25–90/mês',   highlight: 'JAX AI superagent' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Contador SaaS</h3>
            <p className="text-xs text-gray-500">v1.0.0 · Multi-tenant · Lei 6.404/76</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {features.map(({ label, desc }) => (
            <div key={label} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
              <CheckCircle className="h-4 w-4 text-green-500 flex-none mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Benchmark de Mercado</h3>
        <div className="space-y-2">
          {benchmarks.map(({ name, country, price, highlight }) => (
            <div key={name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span>{country}</span>
                <span className="text-sm font-medium text-gray-700">{name}</span>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-gray-600">{price}</p>
                <p className="text-xs text-gray-400">{highlight}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 mt-1 rounded-lg bg-primary-50 px-3 border border-primary-200">
            <div className="flex items-center gap-2">
              <span>🇧🇷</span>
              <span className="text-sm font-bold text-primary-800">Contador SaaS</span>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono text-primary-700 font-bold">Seu sistema</p>
              <p className="text-xs text-primary-600">Lei 6.404 + SPED + NF-e</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 text-xs text-gray-400 space-y-1">
        <p>Stack: React 18 + TypeScript + Electron 31 + Express + PostgreSQL + Knex.js</p>
        <p>Segurança: JWT HS256 + MFA TOTP + SHA-256 + OWASP Top 10</p>
        <p>Repositório: github.com/Trustcorporation88/contador-saas (privado)</p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const { currentCompanyId } = useAuthStore();
  const [tab, setTab] = useState<Tab>('empresa');
  const { msg, show } = useToast();

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'empresa',   label: 'Empresa',   icon: <Building2 className="h-4 w-4" /> },
    { key: 'perfil',    label: 'Meu Perfil', icon: <User className="h-4 w-4" /> },
    { key: 'seguranca', label: 'Segurança',  icon: <ShieldCheck className="h-4 w-4" /> },
    { key: 'sobre',     label: 'Sobre',      icon: <Info className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Toast msg={msg} />

      <h1 className="text-xl font-bold text-gray-900 mb-6">Configurações</h1>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <nav className="w-44 flex-none">
          <ul className="space-y-1">
            {tabs.map(({ key, label, icon }) => (
              <li key={key}>
                <button
                  onClick={() => setTab(key)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    tab === key
                      ? 'bg-primary-50 text-primary-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-100',
                  )}
                >
                  {icon} {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'empresa' && currentCompanyId && (
            <EmpresaTab companyId={currentCompanyId} toast={show} />
          )}
          {tab === 'empresa' && !currentCompanyId && (
            <div className="text-gray-400 text-sm py-8 text-center">
              Selecione uma empresa no menu para editar as configurações.
            </div>
          )}
          {tab === 'perfil'    && <PerfilTab toast={show} />}
          {tab === 'seguranca' && <SegurancaTab toast={show} />}
          {tab === 'sobre'     && <SobreTab />}
        </div>
      </div>
    </div>
  );
}
