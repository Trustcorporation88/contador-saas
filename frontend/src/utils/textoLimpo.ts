/**
 * Limpeza de texto vindo de formulário e de consulta de CNPJ.
 *
 * Quando alguma etapa interpola uma variável vazia numa string, o resultado é a
 * palavra "undefined" dentro do dado: `${tipo} ${logradouro}` sem o tipo produz
 * "undefined SETE DE SETEMBRO". Duas empresas em produção tinham exatamente
 * isso gravado no endereço — e o endereço é impresso no DANFE.
 *
 * Campo com "undefined" é pior que campo vazio: o vazio se vê e se corrige; o
 * preenchido passa por bom até sair impresso num documento fiscal.
 *
 * A mesma regra existe no backend (companyService), que é a última linha de
 * defesa. Aqui é para o usuário não ver o lixo na tela antes de salvar.
 */

/** O valor INTEIRO não quer dizer nada. */
const VALORES_SEM_CONTEUDO =
  /^(undefined|null|nan|n\/a|na|nao informado|não informado|-|--)$/i;

/** Token de valor vazio grudado em texto legítimo. */
const TOKENS_SEM_CONTEUDO = /\b(undefined|null|NaN)\b/g;

/**
 * Devolve '' quando o valor inteiro não diz nada. Serve para qualquer campo,
 * inclusive os estruturados (e-mail, telefone), onde remover pedaços do meio
 * corromperia um valor válido.
 */
export function semPlaceholder(value?: string | null): string {
  if (value === null || value === undefined) return '';
  const texto = String(value).trim();
  if (!texto || VALORES_SEM_CONTEUDO.test(texto)) return '';
  return texto;
}

/**
 * Texto livre (endereço, cidade, bairro): tira o token de valor vazio mesmo
 * quando ele veio grudado em conteúdo real e junta os espaços que sobram.
 *
 *   "undefined SETE DE SETEMBRO"  →  "SETE DE SETEMBRO"
 *   "Rua  VENANCIO"               →  "Rua VENANCIO"
 *   "undefined"                   →  ""
 *
 * O que sobra pode não ser o endereço completo — o tipo do logradouro se
 * perdeu e não há de onde recuperá-lo. Mas é honesto sobre o que se sabe.
 *
 * NÃO usar em e-mail: `\bundefined\b` casaria dentro de
 * "undefined@dominio.com". Ali `semPlaceholder` basta.
 */
export function textoLivre(value?: string | null): string {
  if (value === null || value === undefined) return '';
  const semTokens = String(value)
    .replace(TOKENS_SEM_CONTEUDO, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return semPlaceholder(semTokens);
}
