import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CompanyService } from '../../services/companyService';
import { useAuthStore } from '../../store/authStore';
import type {
  ContraparteTipo,
  DocumentoFiscal,
  DocumentoFiscalPayload,
  TipoDocumentoFiscal,
} from '../../services/documentoFiscalService';

const itemSchema = z.object({
  descricao: z.string().min(2, 'Informe o item'),
  quantidade: z.coerce.number().positive('Quantidade deve ser maior que zero'),
  valor_unitario: z.coerce.number().positive('Valor unitário deve ser maior que zero'),
});

const schema = z.object({
  tipo: z.enum(['nfe', 'boleto', 'recibo', 'cupom_fiscal']),
  numero: z.string().min(1, 'Número obrigatório'),
  serie: z.string().min(1, 'Série obrigatória'),
  descricao: z.string().min(5, 'Descreva o documento'),
  data_emissao: z.string().min(1, 'Data de emissão obrigatória'),
  data_vencimento: z.string().optional(),
  valor_impostos: z.coerce.number().min(0).optional(),
  valor_desconto: z.coerce.number().min(0).optional(),
  contraparte_tipo: z.enum(['cliente', 'fornecedor']).optional(),
  contraparte_cnpj: z.string().optional(),
  contraparte_nome: z.string().min(2, 'Nome obrigatório'),
  contraparte_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  contraparte_telefone: z.string().optional(),
  itens: z.array(itemSchema).min(1, 'Adicione pelo menos um item'),
});

type FormValues = z.infer<typeof schema>;

const tipoOptions: Array<{ value: TipoDocumentoFiscal; label: string }> = [
  { value: 'nfe', label: 'NF-e' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'recibo', label: 'Recibo' },
  { value: 'cupom_fiscal', label: 'Cupom fiscal' },
];

const contraparteOptions: Array<{ value: ContraparteTipo; label: string }> = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'fornecedor', label: 'Fornecedor' },
];

function maskCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

interface DocumentoFormProps {
  initialData?: DocumentoFiscal;
  loading?: boolean;
  apiError?: string;
  onSubmit: (payload: DocumentoFiscalPayload) => void;
  onCancel: () => void;
}

export default function DocumentoForm({ initialData, loading, apiError, onSubmit, onCancel }: DocumentoFormProps) {
  const currentCompanyId = useAuthStore((s) => s.currentCompanyId);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: initialData?.tipo ?? 'nfe',
      numero: initialData?.numero ?? '',
      serie: initialData?.serie ?? '',
      descricao: initialData?.descricao ?? '',
      data_emissao: initialData?.data_emissao?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      data_vencimento: initialData?.data_vencimento?.slice(0, 10) ?? '',
      valor_impostos: initialData?.valor_impostos ?? 0,
      valor_desconto: initialData?.valor_desconto ?? 0,
      contraparte_tipo: initialData?.contraparte_tipo ?? 'fornecedor',
      contraparte_cnpj: initialData?.contraparte_cnpj ? maskCnpj(initialData.contraparte_cnpj) : '',
      contraparte_nome: initialData?.contraparte_nome ?? '',
      contraparte_email: initialData?.contraparte_email ?? '',
      contraparte_telefone: initialData?.contraparte_telefone ?? '',
      itens: initialData?.itens?.length
        ? initialData.itens.map((item) => ({
            descricao: item.descricao,
            quantidade: Number(item.quantidade),
            valor_unitario: Number(item.valor_unitario),
          }))
        : [{ descricao: '', quantidade: 1, valor_unitario: 0 }],
    },
  });

  const { control, handleSubmit, register, setValue, watch, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });
  const itens = watch('itens');
  const total = useMemo(
    () => itens.reduce((acc, item) => acc + (Number(item.quantidade || 0) * Number(item.valor_unitario || 0)), 0),
    [itens]
  );

  const handleLookupCnpj = async () => {
    const current = watch('contraparte_cnpj') || '';
    const clean = current.replace(/\D/g, '');
    if (clean.length !== 14) {
      setLookupMessage('Digite um CNPJ com 14 dígitos para consultar.');
      return;
    }

    setLookupLoading(true);
    setLookupMessage('');
    try {
      const result = await CompanyService.lookupCNPJ(clean);
      setValue('contraparte_nome', result.razao_social || result.nome_fantasia || '');
      setValue('contraparte_email', result.contato?.email || '');
      setValue('contraparte_telefone', result.contato?.telefone || '');
      setLookupMessage('Dados da contraparte preenchidos automaticamente.');
    } catch {
      setLookupMessage('Não foi possível consultar esse CNPJ agora.');
    } finally {
      setLookupLoading(false);
    }
  };

  const submit = (values: FormValues) => {
    if (!currentCompanyId) return;
    onSubmit({
      company_id: currentCompanyId,
      ...values,
      contraparte_cnpj: values.contraparte_cnpj?.replace(/\D/g, ''),
      valor_total: Number(total.toFixed(2)),
      itens: values.itens.map((item, index) => ({
        ...item,
        ordem: index,
        valor_total: Number((item.quantidade * item.valor_unitario).toFixed(2)),
      })),
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      {!currentCompanyId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ Selecione uma empresa no topo da página para registrar este documento.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="input-label">Tipo</label>
          <select className="input-field" {...register('tipo')}>
            {tipoOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Contraparte</label>
          <select className="input-field" {...register('contraparte_tipo')}>
            {contraparteOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Número" error={errors.numero?.message} {...register('numero')} />
        <Input label="Série" error={errors.serie?.message} {...register('serie')} />
        <Input label="Data de emissão" type="date" error={errors.data_emissao?.message} {...register('data_emissao')} />
      </div>

      <Input label="Descrição" error={errors.descricao?.message} {...register('descricao')} />

      <div className="grid gap-4 sm:grid-cols-[1.4fr_auto]">
        <Controller
          name="contraparte_cnpj"
          control={control}
          render={({ field }) => (
            <Input
              label="CNPJ da contraparte"
              value={field.value || ''}
              onChange={(event) => field.onChange(maskCnpj(event.target.value))}
              placeholder="00.000.000/0000-00"
            />
          )}
        />
        <Button type="button" variant="secondary" className="self-end" loading={lookupLoading} icon={<Search className="h-4 w-4" />} onClick={handleLookupCnpj}>
          Consultar CNPJ
        </Button>
      </div>

      {lookupMessage && <p className="text-sm text-gray-500">{lookupMessage}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nome da contraparte" error={errors.contraparte_nome?.message} {...register('contraparte_nome')} />
        <Input label="Data de vencimento" type="date" {...register('data_vencimento')} />
        <Input label="E-mail" type="email" error={errors.contraparte_email?.message} {...register('contraparte_email')} />
        <Input label="Telefone" {...register('contraparte_telefone')} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Itens do documento</h3>
            <p className="text-xs text-gray-500">O total geral é recalculado automaticamente.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => append({ descricao: '', quantidade: 1, valor_unitario: 0 })}>
            Adicionar item
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const itemTotal = Number(itens[index]?.quantidade || 0) * Number(itens[index]?.valor_unitario || 0);
            return (
              <div key={field.id} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[1.6fr_0.7fr_0.7fr_auto]">
                <Input label={`Item ${index + 1}`} error={errors.itens?.[index]?.descricao?.message} {...register(`itens.${index}.descricao`)} />
                <Input label="Quantidade" type="number" step="0.01" error={errors.itens?.[index]?.quantidade?.message} {...register(`itens.${index}.quantidade`, { valueAsNumber: true })} />
                <Input label="Valor unitário" type="number" step="0.01" error={errors.itens?.[index]?.valor_unitario?.message} {...register(`itens.${index}.valor_unitario`, { valueAsNumber: true })} />
                <div className="flex flex-col justify-end gap-2">
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-right text-sm font-semibold text-gray-700">
                    R$ {itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => remove(index)}>
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Impostos" type="number" step="0.01" {...register('valor_impostos', { valueAsNumber: true })} />
        <Input label="Desconto" type="number" step="0.01" {...register('valor_desconto', { valueAsNumber: true })} />
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Total do documento</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {apiError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={loading} disabled={!currentCompanyId}>{initialData ? 'Salvar alterações' : 'Criar documento'}</Button>
      </div>
    </form>
  );
}