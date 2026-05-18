import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CompanyService } from '../../services/companyService';
import type { CategoriaContaReceber, ContaReceber, ContaReceberPayload } from '../../services/contasReceberService';

const schema = z.object({
  categoria: z.enum(['boleto', 'duplicata', 'promissoria', 'pix', 'outro']),
  numero_titulo: z.string().min(1, 'Número obrigatório'),
  descricao: z.string().min(5, 'Descreva o título'),
  cliente_nome: z.string().min(2, 'Nome obrigatório'),
  cliente_cnpj: z.string().optional(),
  cliente_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cliente_telefone: z.string().optional(),
  data_emissao: z.string().min(1, 'Data de emissão obrigatória'),
  data_vencimento: z.string().min(1, 'Data de vencimento obrigatória'),
  valor_original: z.coerce.number().positive('Valor deve ser maior que zero'),
  juros: z.coerce.number().min(0).optional(),
  multa: z.coerce.number().min(0).optional(),
  desconto: z.coerce.number().min(0).optional(),
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const categoriaOptions: Array<{ value: CategoriaContaReceber; label: string }> = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'duplicata', label: 'Duplicata' },
  { value: 'promissoria', label: 'Promissória' },
  { value: 'pix', label: 'Pix a receber' },
  { value: 'outro', label: 'Outro título' },
];

function maskCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

interface ContaReceberFormProps {
  initialData?: ContaReceber;
  loading?: boolean;
  apiError?: string;
  onSubmit: (payload: ContaReceberPayload) => void;
  onCancel: () => void;
}

export default function ContaReceberForm({ initialData, loading, apiError, onSubmit, onCancel }: ContaReceberFormProps) {
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoria: initialData?.categoria ?? 'boleto',
      numero_titulo: initialData?.numero_titulo ?? '',
      descricao: initialData?.descricao ?? '',
      cliente_nome: initialData?.cliente_nome ?? '',
      cliente_cnpj: initialData?.cliente_cnpj ? maskCnpj(initialData.cliente_cnpj) : '',
      cliente_email: initialData?.cliente_email ?? '',
      cliente_telefone: initialData?.cliente_telefone ?? '',
      data_emissao: initialData?.data_emissao?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      data_vencimento: initialData?.data_vencimento?.slice(0, 10) ?? '',
      valor_original: initialData?.valor_original ?? 0,
      juros: initialData?.juros ?? 0,
      multa: initialData?.multa ?? 0,
      desconto: initialData?.desconto ?? 0,
      observacoes: initialData?.observacoes ?? '',
    },
  });

  const { control, handleSubmit, register, setValue, watch, formState: { errors } } = form;

  const lookupCnpj = async () => {
    const current = watch('cliente_cnpj') || '';
    const clean = current.replace(/\D/g, '');
    if (clean.length !== 14) {
      setLookupMessage('Digite um CNPJ com 14 dígitos para consultar.');
      return;
    }

    setLookupLoading(true);
    setLookupMessage('');
    try {
      const result = await CompanyService.lookupCNPJ(clean);
      setValue('cliente_nome', result.razao_social || result.nome_fantasia || '');
      setValue('cliente_email', result.contato?.email || '');
      setValue('cliente_telefone', result.contato?.telefone || '');
      setLookupMessage('Dados do cliente preenchidos automaticamente.');
    } catch {
      setLookupMessage('Não foi possível consultar esse CNPJ agora.');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit({ ...values, cliente_cnpj: values.cliente_cnpj?.replace(/\D/g, '') }))}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="input-label">Categoria do título</label>
          <select className="input-field" {...register('categoria')}>
            {categoriaOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <Input label="Número do título" error={errors.numero_titulo?.message} {...register('numero_titulo')} />
      </div>

      <Input label="Descrição" error={errors.descricao?.message} {...register('descricao')} />

      <div className="grid gap-4 sm:grid-cols-[1.4fr_auto]">
        <Controller
          name="cliente_cnpj"
          control={control}
          render={({ field }) => (
            <Input
              label="CNPJ do cliente"
              value={field.value || ''}
              onChange={(event) => field.onChange(maskCnpj(event.target.value))}
              placeholder="00.000.000/0000-00"
            />
          )}
        />
        <Button type="button" variant="secondary" className="self-end" loading={lookupLoading} icon={<Search className="h-4 w-4" />} onClick={lookupCnpj}>
          Consultar CNPJ
        </Button>
      </div>

      {lookupMessage && <p className="text-sm text-gray-500">{lookupMessage}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Cliente" error={errors.cliente_nome?.message} {...register('cliente_nome')} />
        <Input label="E-mail" type="email" error={errors.cliente_email?.message} {...register('cliente_email')} />
        <Input label="Telefone" {...register('cliente_telefone')} />
        <Input label="Valor do título" type="number" step="0.01" error={errors.valor_original?.message} {...register('valor_original', { valueAsNumber: true })} />
        <Input label="Data de emissão" type="date" error={errors.data_emissao?.message} {...register('data_emissao')} />
        <Input label="Data de vencimento" type="date" error={errors.data_vencimento?.message} {...register('data_vencimento')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Juros previstos" type="number" step="0.01" {...register('juros', { valueAsNumber: true })} />
        <Input label="Multa prevista" type="number" step="0.01" {...register('multa', { valueAsNumber: true })} />
        <Input label="Desconto previsto" type="number" step="0.01" {...register('desconto', { valueAsNumber: true })} />
      </div>

      <div>
        <label className="input-label">Observações</label>
        <textarea className="input-field min-h-28" {...register('observacoes')} />
      </div>

      {apiError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</div>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={loading}>{initialData ? 'Salvar alterações' : 'Criar título'}</Button>
      </div>
    </form>
  );
}