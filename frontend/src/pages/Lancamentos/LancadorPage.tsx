/**
 * LancadorPage — Formulário de lançamento contábil por partidas dobradas
 * Lei 6.404/76 — Débitos = Créditos (Ativo = Passivo + PL)
 * Inspiração UX: Xero Journal Entry + QuickBooks Advanced Journal
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, AlertCircle, CheckCircle2, BookOpen, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { JournalService } from '../../services/journalService';
import { AccountService, type APIAccount } from '../../services/accountService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

// ─── Constants ────────────────────────────────────────────────────────────────

const REF_TYPES = [
  { value: '',       label: '—'      },
  { value: 'NF',     label: 'NF-e'   },
  { value: 'RPA',    label: 'RPA'    },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'MANUAL', label: 'Manual' },
] as const;

function brl(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(v: string): number {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const lineSchema = z.object({
  account_id:  z.string().min(1, 'Conta obrigatória'),
  debit:       z.number().min(0),
  credit:      z.number().min(0),
  description: z.string().optional(),
});

const schema = z.object({
  entry_date:       z.string().min(1, 'Data obrigatória'),
  description:      z.string().optional(),
  reference_type:   z.string().optional(),
  reference_number: z.string().optional(),
  reference_issuer: z.string().optional(),
  lines: z.array(lineSchema).min(2, 'Mínimo 2 linhas'),
}).refine((d) => {
  const td = d.lines.reduce((s, l) => s + l.debit,  0);
  const tc = d.lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(td - tc) < 0.01;
}, { message: 'Total débitos ≠ total créditos', path: ['lines'] });

type FormValues = z.infer<typeof schema>;

// ─── Account Select ───────────────────────────────────────────────────────────

interface AccountSelectProps {
  accounts: APIAccount[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}

function AccountSelect({ accounts, value, onChange, error }: AccountSelectProps) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);

  const selected = accounts.find((a) => a.id === value);

  const filtered = query.length >= 1
    ? accounts.filter((a) =>
        a.is_analytical &&
        (a.code.toLowerCase().includes(query.toLowerCase()) ||
         a.name.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 12)
    : [];

  const pick = (a: APIAccount) => {
    onChange(a.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <div
        className={clsx(
          'input-field flex items-center gap-2 cursor-pointer',
          error && 'border-red-400',
          open && 'ring-2 ring-primary-500 border-primary-500'
        )}
        onClick={() => { setOpen(true); setQuery(''); }}
      >
        {selected
          ? <span className="flex-1 text-sm text-gray-900 truncate">{selected.code} — {selected.name}</span>
          : <span className="flex-1 text-sm text-gray-400">Selecione a conta...</span>
        }
      </div>

      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <input
            autoFocus
            type="text"
            className="w-full px-3 py-2 text-sm border-b border-gray-200 focus:outline-none"
            placeholder="Buscar código ou nome..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {filtered.length === 0 && query.length > 0 && (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">Nenhuma conta analítica encontrada</div>
          )}
          {filtered.length === 0 && query.length === 0 && (
            <div className="px-3 py-3 text-xs text-gray-400 text-center">Digite para buscar contas analíticas</div>
          )}
          <ul className="max-h-48 overflow-y-auto">
            {filtered.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-primary-50 cursor-pointer text-sm"
                onMouseDown={() => pick(a)}
              >
                <span className="font-mono text-xs text-gray-500 w-16 flex-none">{a.code}</span>
                <span className="flex-1 truncate text-gray-900">{a.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="input-error mt-1">{error}</p>}
    </div>
  );
}

// ─── Amount field ─────────────────────────────────────────────────────────────

interface AmountFieldProps {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

function AmountField({ value, onChange, placeholder = '0,00', disabled }: AmountFieldProps) {
  const [raw, setRaw] = useState(value > 0 ? brl(value) : '');

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      className={clsx(
        'input-field text-right tabular-nums',
        disabled && 'bg-gray-50 text-gray-400 cursor-not-allowed'
      )}
      placeholder={placeholder}
      value={raw}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d,]/g, '');
        setRaw(v);
        onChange(parseBRL(v));
      }}
      onBlur={() => {
        const n = parseBRL(raw);
        setRaw(n > 0 ? brl(n) : '');
        onChange(n);
      }}
    />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LancadorPage() {
  const navigate = useNavigate();
  const { currentCompanyId } = useAuthStore();
  const [apiError, setApiError] = useState('');
  const [posted,   setPosted]   = useState(false);

  // Load all analytical accounts for autocomplete
  const { data: accountData } = useQuery({
    queryKey: ['accounts-all', currentCompanyId],
    queryFn:  () => AccountService.list(currentCompanyId!, { limit: 500 }),
    enabled:  !!currentCompanyId,
    staleTime: 60_000,
  });
  const accounts = accountData?.data ?? [];

  // Form
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      lines: [
        { account_id: '', debit: 0, credit: 0, description: '' },
        { account_id: '', debit: 0, credit: 0, description: '' },
      ],
    },
  });

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  // Live totals
  const lines = watch('lines');
  const totalDebit  = lines.reduce((s, l) => s + (l.debit  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01;

  // Mutation
  const createMut = useMutation({
    mutationFn: (v: FormValues) => JournalService.create(currentCompanyId!, {
      ...v,
      reference_type: (v.reference_type as 'NF' | 'RPA' | 'CHEQUE' | 'BOLETO' | 'MANUAL' | undefined) || undefined,
      lines: v.lines.map((l) => ({
        account_id:  l.account_id,
        debit:       l.debit  || 0,
        credit:      l.credit || 0,
        description: l.description || undefined,
      })),
    }),
    onSuccess: (entry) => {
      if (posted) {
        JournalService.post(currentCompanyId!, entry.id)
          .then(() => navigate('/lancamentos'))
          .catch((e: Error) => setApiError(e.message));
      } else {
        navigate('/lancamentos');
      }
    },
    onError: (e: Error) => setApiError(e.message),
  });

  const addLine = useCallback(() => {
    append({ account_id: '', debit: 0, credit: 0, description: '' });
  }, [append]);

  const onSubmit = (v: FormValues) => { setApiError(''); createMut.mutate(v); };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!currentCompanyId) {
    return (
      <div className="p-8 text-center">
        <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <p className="text-gray-500">Selecione uma empresa para registrar lançamentos.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/lancamentos')}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Novo Lançamento Contábil</h1>
          <p className="text-sm text-gray-500 mt-0.5">Partidas dobradas — débitos = créditos (Lei 6.404/76)</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

        {/* Header fields */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Identificação do Lançamento</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Data"
              type="date"
              error={errors.entry_date?.message}
              {...register('entry_date')}
            />
            <div className="sm:col-span-2">
              <Input
                label="Descrição / Histórico"
                placeholder="Ex: Pagamento de fornecedor, Recebimento de cliente..."
                {...register('description')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-4">
            <div>
              <label className="input-label">Tipo de Documento</label>
              <select className="input-field" {...register('reference_type')}>
                {REF_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Input
              label="Número do Documento"
              placeholder="Ex: 001234"
              {...register('reference_number')}
            />
            <Input
              label="Emissor"
              placeholder="Ex: Empresa X Ltda"
              {...register('reference_issuer')}
            />
          </div>
        </div>

        {/* Lines */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Partidas Contábeis</h2>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              <Plus className="h-4 w-4" /> Adicionar linha
            </button>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_160px_160px_200px_40px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide font-medium">
            <span>Conta</span>
            <span className="text-right">Débito (R$)</span>
            <span className="text-right">Crédito (R$)</span>
            <span>Histórico da linha</span>
            <span />
          </div>

          {/* Lines */}
          <div className="divide-y divide-gray-100">
            {fields.map((field, idx) => (
              <div
                key={field.id}
                className="grid grid-cols-[1fr_160px_160px_200px_40px] gap-2 px-4 py-2.5 items-start"
              >
                {/* Account */}
                <Controller
                  name={`lines.${idx}.account_id`}
                  control={control}
                  render={({ field: f, fieldState }) => (
                    <AccountSelect
                      accounts={accounts}
                      value={f.value}
                      onChange={(id) => f.onChange(id)}
                      error={fieldState.error?.message}
                    />
                  )}
                />

                {/* Debit */}
                <Controller
                  name={`lines.${idx}.debit`}
                  control={control}
                  render={({ field: f }) => (
                    <AmountField
                      value={f.value}
                      onChange={(v) => {
                        f.onChange(v);
                        if (v > 0) setValue(`lines.${idx}.credit`, 0);
                      }}
                    />
                  )}
                />

                {/* Credit */}
                <Controller
                  name={`lines.${idx}.credit`}
                  control={control}
                  render={({ field: f }) => (
                    <AmountField
                      value={f.value}
                      onChange={(v) => {
                        f.onChange(v);
                        if (v > 0) setValue(`lines.${idx}.debit`, 0);
                      }}
                    />
                  )}
                />

                {/* Description */}
                <input
                  type="text"
                  className="input-field text-sm"
                  placeholder="Histórico..."
                  {...register(`lines.${idx}.description`)}
                />

                {/* Remove */}
                <button
                  type="button"
                  disabled={fields.length <= 2}
                  onClick={() => remove(idx)}
                  className="rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-0.5"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-[1fr_160px_160px_200px_40px] gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-2">
              {balanced
                ? <span className="flex items-center gap-1.5 text-xs font-medium text-green-700"><CheckCircle2 className="h-4 w-4" /> Balanceado</span>
                : <span className="flex items-center gap-1.5 text-xs font-medium text-red-600"><AlertCircle className="h-4 w-4" /> Diferença: R$ {brl(Math.abs(totalDebit - totalCredit))}</span>
              }
            </div>
            <div className={clsx(
              'text-right text-sm font-bold tabular-nums',
              balanced ? 'text-gray-900' : 'text-red-600'
            )}>
              {brl(totalDebit)}
            </div>
            <div className={clsx(
              'text-right text-sm font-bold tabular-nums',
              balanced ? 'text-gray-900' : 'text-red-600'
            )}>
              {brl(totalCredit)}
            </div>
            <div />
            <div />
          </div>

          {/* Lines error */}
          {errors.lines?.root?.message && (
            <div className="px-4 pb-3 text-sm text-red-600">{errors.lines.root.message}</div>
          )}
        </div>

        {/* API error */}
        {apiError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={() => navigate('/lancamentos')}>
            Cancelar
          </Button>
          <div className="flex gap-3">
            <Button
              type="submit"
              variant="secondary"
              loading={createMut.isPending && !posted}
              onClick={() => setPosted(false)}
              disabled={!balanced}
            >
              Salvar como Rascunho
            </Button>
            <Button
              type="submit"
              loading={createMut.isPending && posted}
              onClick={() => setPosted(true)}
              disabled={!balanced}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              Salvar e Postar
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
