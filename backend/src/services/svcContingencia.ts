/**
 * Qual SEFAZ Virtual de Contingência atende cada UF.
 *
 * POR QUE ISTO É UM MÓDULO E NÃO UMA TABELA SOLTA NO MEIO DO EMISSOR
 *
 * A vinculação UF → SVC muda por ato normativo (Convênio ICMS 32/2012 e atos
 * posteriores). Estados já migraram entre as duas. Uma tabela fixa envelhece em
 * silêncio e cobra a conta no pior dia possível: contingência só é exercitada
 * quando a SEFAZ da UF caiu, e aí um `tpEmis` errado vira rejeição com o
 * faturamento parado.
 *
 * Por isso três decisões aqui:
 *
 *  1. Só entram como certeza as UFs em que as fontes consultadas CONCORDAM.
 *  2. As UFs em que elas divergem ficam declaradas como divergentes e o código
 *     RECUSA resolver sozinho — melhor um erro claro pedindo confirmação do que
 *     um palpite que gera nota rejeitada.
 *  3. Tudo é sobrescrevível por configuração (SVC_UF_MAP), para corrigir sem
 *     precisar de deploy quando a legislação mudar.
 *
 * tpEmis: 6 = SVC-AN, 7 = SVC-RS. Atenção: existe material na internet com os
 * dois invertidos. O valor correto está na NT 2013.007 e no manual de
 * contingência, e é o adotado aqui.
 */

export type Svc = 'SVC-AN' | 'SVC-RS';

export const TP_EMIS: Record<Svc, 6 | 7> = {
  'SVC-AN': 6,
  'SVC-RS': 7,
};

/** UFs em que as fontes consultadas concordam. */
const CONSENSO: Record<string, Svc> = {
  AC: 'SVC-AN', AL: 'SVC-AN', AP: 'SVC-AN', DF: 'SVC-AN',
  ES: 'SVC-AN', MG: 'SVC-AN', PB: 'SVC-AN', RJ: 'SVC-AN',
  RN: 'SVC-AN', RO: 'SVC-AN', RR: 'SVC-AN', RS: 'SVC-AN',
  SC: 'SVC-AN', SE: 'SVC-AN', SP: 'SVC-AN', TO: 'SVC-AN',

  AM: 'SVC-RS', BA: 'SVC-RS', GO: 'SVC-RS', MA: 'SVC-RS',
  MS: 'SVC-RS', MT: 'SVC-RS', PE: 'SVC-RS', PR: 'SVC-RS',
};

/**
 * UFs com informação conflitante entre as fontes consultadas em 14/08/2026.
 * Confirme no Portal Nacional da NF-e e configure em SVC_UF_MAP.
 */
const DIVERGENTES = new Set(['CE', 'PA', 'PI']);

/**
 * Sobrescrita por ambiente: SVC_UF_MAP="CE=SVC-AN,PA=SVC-AN,PI=SVC-AN"
 * Vale tanto para resolver as divergentes quanto para corrigir uma consenso que
 * tenha mudado depois desta data.
 */
function overrides(): Record<string, Svc> {
  const bruto = process.env.SVC_UF_MAP?.trim();
  if (!bruto) return {};
  const mapa: Record<string, Svc> = {};
  for (const par of bruto.split(',')) {
    const [uf, svc] = par.split('=').map((p) => p.trim().toUpperCase());
    if (!uf || !svc) continue;
    if (svc !== 'SVC-AN' && svc !== 'SVC-RS') continue;
    mapa[uf] = svc;
  }
  return mapa;
}

export type ResolucaoSvc = {
  svc: Svc;
  tpEmis: 6 | 7;
  /** De onde veio a decisão — vai para o log, e importa numa auditoria fiscal. */
  origem: 'configuracao' | 'consenso';
};

/**
 * Resolve a SVC da UF. Lança (status 409) quando não há resposta confiável, em
 * vez de chutar: nota emitida na SVC errada é rejeitada, e o operador precisa
 * saber que falta configurar, não descobrir pelo retorno da SEFAZ.
 */
export function resolverSvc(ufBruta: string): ResolucaoSvc {
  const uf = (ufBruta ?? '').trim().toUpperCase();

  const configurado = overrides()[uf];
  if (configurado) {
    return { svc: configurado, tpEmis: TP_EMIS[configurado], origem: 'configuracao' };
  }

  const consenso = CONSENSO[uf];
  if (consenso) {
    return { svc: consenso, tpEmis: TP_EMIS[consenso], origem: 'consenso' };
  }

  if (DIVERGENTES.has(uf)) {
    throw Object.assign(
      new Error(
        `A vinculação de ${uf} à SVC-AN ou SVC-RS está divergente entre as fontes e precisa ser confirmada `
        + `no Portal Nacional da NF-e. Depois de confirmar, configure SVC_UF_MAP="${uf}=SVC-AN" `
        + `(ou SVC-RS) e repita a emissão. Emitir na SVC errada resulta em rejeição.`,
      ),
      { status: 409, uf, motivo: 'SVC_DIVERGENTE' },
    );
  }

  throw Object.assign(
    new Error(`UF "${ufBruta}" não reconhecida para contingência SVC.`),
    { status: 400, uf, motivo: 'UF_INVALIDA' },
  );
}

/** Para telas e diagnóstico: o que está pendente de confirmação. */
export function ufsPendentesDeConfirmacao(): string[] {
  const configurado = overrides();
  return [...DIVERGENTES].filter((uf) => !configurado[uf]).sort();
}
