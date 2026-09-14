/**
 * Atividade da empresa (comércio, serviços ou os dois)
 *
 * Deduzida dos CNAEs do cartão do CNPJ na importação, e editável depois: a
 * sugestão acerta na maioria, mas o responsável pela empresa é quem manda.
 *
 * A régua é a divisão do CNAE (os dois primeiros dígitos do código de 7):
 *
 *   01 a 03  agropecuária          ) produto: a empresa vende mercadoria e
 *   05 a 09  indústria extrativa   ) emite nota de PRODUTO (NF-e), então
 *   10 a 33  indústria de transf.  ) entra como "comércio" para efeito de
 *   45 a 47  comércio e veículos   ) qual nota ela emite
 *
 *   demais divisões (35 a 43, 49 a 99): serviço, nota de SERVIÇO (NFS-e)
 *
 * Havendo CNAEs dos dois grupos entre o principal e os secundários, a empresa
 * é COMERCIO_SERVICO. O código 0 ou ausente é ignorado (cartão incompleto).
 */

export type Atividade = 'COMERCIO' | 'COMERCIO_SERVICO' | 'SERVICOS';

export const ATIVIDADES: Array<{ valor: Atividade; rotulo: string }> = [
  { valor: 'COMERCIO', rotulo: 'Comércio' },
  { valor: 'COMERCIO_SERVICO', rotulo: 'Comércio e Serviço' },
  { valor: 'SERVICOS', rotulo: 'Serviços' },
];

const VALORES = ATIVIDADES.map((a) => a.valor);

export function atividadeValida(v: unknown): v is Atividade {
  return typeof v === 'string' && (VALORES as string[]).includes(v);
}

export function rotuloAtividade(v: string | null | undefined): string {
  return ATIVIDADES.find((a) => a.valor === v)?.rotulo ?? '';
}

/** Divisão do CNAE: os dois primeiros dígitos do código de 7 posições. */
export function divisaoDoCnae(codigo: number | string | null | undefined): number | null {
  if (codigo === null || codigo === undefined || codigo === '') return null;
  // Só dígitos: o código pode vir "47.72-5/00", "4772500" ou 4772500.
  const digitos = String(codigo).replace(/\D/g, '');
  if (!digitos || Number(digitos) === 0) return null;
  // Zeros à esquerda somem quando o código chega como número (agro 0111301
  // vira 111301), então repõe até 7 antes de ler a divisão.
  const completo = digitos.padStart(7, '0');
  const divisao = Number(completo.slice(0, 2));
  return Number.isFinite(divisao) ? divisao : null;
}

/** A divisão emite nota de produto (comércio/indústria/agro)? */
export function ehProduto(divisao: number): boolean {
  if (divisao >= 1 && divisao <= 33) return true;   // agro, extrativa, indústria
  if (divisao >= 45 && divisao <= 47) return true;  // comércio e veículos
  return false;
}

/**
 * Sugere a atividade a partir do CNAE principal e dos secundários.
 * Retorna null quando não há nenhum CNAE utilizável (aí a tela deixa o campo
 * em branco para preenchimento manual, em vez de chutar).
 */
export function deduzirAtividade(
  cnaePrincipal?: number | string | null,
  cnaesSecundarios?: Array<{ codigo?: number | string | null }> | null,
): Atividade | null {
  const codigos = [
    cnaePrincipal,
    ...((cnaesSecundarios ?? []).map((c) => c?.codigo)),
  ];

  let temProduto = false;
  let temServico = false;

  for (const codigo of codigos) {
    const divisao = divisaoDoCnae(codigo);
    if (divisao === null) continue;
    if (ehProduto(divisao)) temProduto = true;
    else temServico = true;
  }

  if (temProduto && temServico) return 'COMERCIO_SERVICO';
  if (temProduto) return 'COMERCIO';
  if (temServico) return 'SERVICOS';
  return null;
}
