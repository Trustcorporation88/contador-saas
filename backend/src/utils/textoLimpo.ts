/**
 * Limpeza de texto antes de gravar no banco.
 *
 * Quando alguma etapa do caminho interpola uma variável vazia numa string, o
 * resultado é a palavra "undefined" DENTRO do dado: `${tipo} ${logradouro}` sem
 * o tipo produz "undefined SETE DE SETEMBRO".
 *
 * Aconteceu de verdade. Duas empresas em produção têm o endereço gravado assim
 * — uma como "undefined" e outra como "undefined SETE DE SETEMBRO" — e endereço
 * é impresso no DANFE.
 *
 * Campo com "undefined" é pior que campo vazio: o vazio se vê e se corrige; o
 * preenchido passa por bom até sair impresso num documento fiscal.
 *
 * Havia guarda no frontend, mas comparando com /^(undefined|null)$/, que só casa
 * a palavra SOZINHA. O caso real é ela grudada em conteúdo legítimo, e passava
 * direto. A regra vive aqui porque o backend é a última linha antes do banco;
 * frontend/src/utils/textoLimpo.ts espelha isto para o usuário não ver o lixo
 * na tela.
 */

/** O valor INTEIRO não quer dizer nada. */
const VALORES_SEM_CONTEUDO =
  /^(undefined|null|nan|n\/a|na|nao informado|não informado|-|--)$/i;

/** Token de valor vazio grudado em texto legítimo. */
const TOKENS_SEM_CONTEUDO = /\b(undefined|null|NaN)\b/g;

/**
 * Descarta o valor quando ele inteiro não diz nada; caso contrário devolve o
 * texto sem espaços nas pontas.
 *
 * Serve para qualquer campo, inclusive os estruturados (e-mail, telefone),
 * onde remover pedaços do meio corromperia um valor válido.
 */
export function semPlaceholder(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const texto = String(value).trim();
  if (!texto || VALORES_SEM_CONTEUDO.test(texto)) return null;
  return texto;
}

/**
 * Texto livre (endereço, cidade, bairro, nome): remove o token de valor vazio
 * mesmo grudado em conteúdo real e junta os espaços que sobram.
 *
 *   "undefined SETE DE SETEMBRO"  →  "SETE DE SETEMBRO"
 *   "Rua  VENANCIO"               →  "Rua VENANCIO"
 *   "undefined"                   →  null
 *
 * O que sobra pode não ser o endereço completo: o tipo do logradouro se perdeu
 * e não há de onde recuperá-lo. Guardar "SETE DE SETEMBRO" é honesto sobre o
 * que se sabe; guardar "undefined SETE DE SETEMBRO" afirma uma coisa falsa.
 *
 * NÃO usar em e-mail: `\bundefined\b` casaria dentro de
 * "undefined@dominio.com" e corromperia um endereço válido. Ali
 * `semPlaceholder` basta.
 */
export function textoLivre(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const semTokens = String(value)
    .replace(TOKENS_SEM_CONTEUDO, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return semPlaceholder(semTokens);
}
