/**
 * validationMessages — mensagens de validação educativas e amigáveis
 *
 * Objetivo: substituir mensagens genéricas como "Campo inválido" por mensagens
 * que orientam o usuário a corrigir o problema, com exemplos práticos quando útil.
 *
 * Usar em conjunto com Zod, react-hook-form ou validações manuais.
 *
 * Exemplo com Zod:
 * ```ts
 * cnpj: z.string()
 *   .min(14, validationMessages.required('CNPJ', '12.345.678/0001-90'))
 *   .refine(isValidCNPJ, validationMessages.invalid('CNPJ', 'Verifique os dígitos verificadores'));
 * ```
 */

// ─── Builders genéricos ──────────────────────────────────────────────────────

/** Mensagem para campo obrigatório, opcionalmente com exemplo. */
export const required = (field: string, example?: string): string =>
  example
    ? `${field} é obrigatório. Exemplo: ${example}`
    : `${field} é obrigatório.`;

/** Mensagem para campo com formato inválido, opcionalmente com dica. */
export const invalid = (field: string, hint?: string): string =>
  hint
    ? `${field} inválido. ${hint}`
    : `${field} inválido. Verifique o formato.`;

/** Mensagem para valor abaixo do mínimo. */
export const minValue = (field: string, min: number | string, unit = ''): string =>
  `${field} deve ser maior ou igual a ${min}${unit ? ` ${unit}` : ''}.`;

/** Mensagem para valor acima do máximo. */
export const maxValue = (field: string, max: number | string, unit = ''): string =>
  `${field} deve ser menor ou igual a ${max}${unit ? ` ${unit}` : ''}.`;

/** Mensagem para comprimento mínimo de texto. */
export const minLength = (field: string, n: number): string =>
  `${field} deve ter pelo menos ${n} caractere${n === 1 ? '' : 's'}.`;

/** Mensagem para comprimento máximo de texto. */
export const maxLength = (field: string, n: number): string =>
  `${field} deve ter no máximo ${n} caractere${n === 1 ? '' : 's'}.`;

/** Mensagem para data fora de um intervalo. */
export const dateRange = (field: string, from?: string, to?: string): string => {
  if (from && to) return `${field} deve estar entre ${from} e ${to}.`;
  if (from) return `${field} deve ser igual ou posterior a ${from}.`;
  if (to) return `${field} deve ser igual ou anterior a ${to}.`;
  return `${field} fora do intervalo permitido.`;
};

// ─── Mensagens prontas (mais usadas no domínio contábil/fiscal BR) ──────────

export const fieldMessages = {
  cnpj: {
    required: required('CNPJ', '12.345.678/0001-90'),
    invalid: invalid('CNPJ', 'Verifique os 14 dígitos e os dígitos verificadores.'),
  },
  cpf: {
    required: required('CPF', '123.456.789-09'),
    invalid: invalid('CPF', 'Verifique os 11 dígitos e os dígitos verificadores.'),
  },
  email: {
    required: required('E-mail', 'usuario@empresa.com.br'),
    invalid: invalid('E-mail', 'Use o formato nome@dominio.com.'),
  },
  telefone: {
    required: required('Telefone', '(11) 98765-4321'),
    invalid: invalid('Telefone', 'Use DDD + número, ex.: (11) 98765-4321.'),
  },
  cep: {
    required: required('CEP', '01310-100'),
    invalid: invalid('CEP', 'Use 8 dígitos, ex.: 01310-100.'),
  },
  valor: {
    required: required('Valor', 'R$ 1.250,00'),
    invalid: invalid('Valor', 'Use vírgula como separador decimal.'),
    positive: 'Valor deve ser maior que zero.',
  },
  data: {
    required: required('Data', '25/05/2026'),
    invalid: invalid('Data', 'Use o formato DD/MM/AAAA.'),
    future: 'Data não pode estar no futuro.',
    past: 'Data não pode estar no passado.',
  },
  conta: {
    required: required('Conta contábil', 'ex.: 1.1.1.01 - Caixa'),
    invalid: invalid('Conta contábil', 'Selecione uma conta válida do plano de contas.'),
  },
  competencia: {
    required: required('Competência', '05/2026'),
    invalid: invalid('Competência', 'Use o formato MM/AAAA.'),
  },
  nfe: {
    invalidNumber: invalid('Número da NFe', 'Use somente dígitos, até 9 caracteres.'),
    invalidCFOP: invalid('CFOP', 'Use 4 dígitos, ex.: 5102.'),
    invalidNCM: invalid('NCM', 'Use 8 dígitos, ex.: 8471.3019.'),
  },
} as const;

// ─── Helper unificado ──────────────────────────────────────────────────────

/**
 * Objeto único para uso direto em schemas. Mantém compatibilidade com o plano original.
 *
 * @example
 * z.string().min(1, validationMessages.required('Nome'));
 */
export const validationMessages = {
  required,
  invalid,
  minValue,
  maxValue,
  minLength,
  maxLength,
  dateRange,
  field: fieldMessages,
};

export default validationMessages;
