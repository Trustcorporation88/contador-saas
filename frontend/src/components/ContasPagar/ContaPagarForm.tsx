import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CompanyService } from '../../services/companyService';
import type { CategoriaContaPagar, ContaPagar, ContaPagarPayload } from '../../services/contasPagarService';

const schema = z.object({
  categoria: z.enum(['boleto', 'fornecedor', 'imposto', 'salario', 'aluguel', 'outro']),
  numero_titulo: z.string().min(1, 'Número obrigatório'),
  descricao: z.string().min(5, 'Descreva a obrigação'),
  fornecedor_nome: z.string().min(2, 'Fornecedor obrigatório'),
  fornecedor_cnpj: z.string().optional(),
  fornecedor_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  fornecedor_telefone: z.string().optional(),
  data_emissao: z.string().min(1, 'Data de emissão obrigatória'),
  data_vencimento: z.string().min(1, 'Data de vencimento obrigatória'),
  valor_original: z.coerce.number().positive('Valor deve ser maior que zero'),
  juros: z.coerce.number().min(0).optional(),
  multa: z.coerce.number().min(0).optional(),
  desconto: z.coerce.number().min(0).optional(),
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const categoriaOptions: Array<{ value: CategoriaContaPagar; label: string }> = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'imposto', label: 'Imposto' },
  { value: 'salario', label: 'Salário' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'outro', label: 'Outro' },
];

function maskCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

interface ContaPagarFormProps {
  initialData?: ContaPagar;
  loading?: boolean;
  apiError?: string;
  onSubmit: (payload: ContaPagarPayload) => void;
  onCancel: () => void;
}

export default function ContaPagarForm({ initialData, loading, apiError, onSubmit, onCancel }: ContaPagarFormProps) {
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoria: initialData?.categoria ?? 'boleto',
      numero_titulo: initialData?.numero_titulo ?? '',
      descricao: initialData?.descricao ?? '',
      fornecedor_nome: initialData?.fornecedor_nome ?? '',
      fornecedor_cnpj: initialData?.fornecedor_cnpj ? maskCnpj(initialData.fornecedor_cnpj) : '',
      fornecedor_email: initialData?.fornecedor_email ?? '',
      fornecedor_telefone: initialData?.fornecedor_telefone ?? '',
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
    const current = watch('fornecedor_cnpj') || '';
    const clean = current.replace(/\D/g, '');
    if (clean.length !== 14) {
      setLookupMessage('Digite um CNPJ com 14 dígitos para consultar.');
      return;
    }

    setLookupLoading(true);
    setLookupMessage('');
    try {
      const result = await CompanyService.lookupCNPJ(clean);
      setValue('fornecedor_nome', result.razao_social || result.nome_fantasia || '');
      setValue('fornecedor_email', result.contato?.email || '');
      setValue('fornecedor_telefone', result.contato?.telefone || '');
      setLookupMessage('Dados do fornecedor preenchidos automaticamente.');
    } catch {
      setLookupMessage('Não foi possível consultar esse CNPJ agora.');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit({ ...values, fornecedor_cnpj: values.fornecedor_cnpj?.replace(/\D/g, '') }))}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="input-label">Categoria da obrigação</label>
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
          name="fornecedor_cnpj"
          control={control}
          render={({ field }) => (
            <Input
              label="CNPJ do fornecedor"
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
        <Input label="Fornecedor" error={errors.fornecedor_nome?.message} {...register('fornecedor_nome')} />
        <Input label="E-mail" type="email" error={errors.fornecedor_email?.message} {...register('fornecedor_email')} />
        <Input label="Telefone" {...register('fornecedor_telefone')} />
        <Input label="Valor da obrigação" type="number" step="0.01" error={errors.valor_original?.message} {...register('valor_original', { valueAsNumber: true })} />
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
        <Button type="submit" loading={loading}>{initialData ? 'Salvar alterações' : 'Criar obrigação'}</Button>
      </div>
    </form>
  );
}