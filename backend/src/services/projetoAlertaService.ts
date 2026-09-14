/**
 * Projeto e Alertas Fiscais
 *
 * Cada empresa pode pertencer a um projeto (carteira MEISHOP). O projeto
 * define quais alertas fiscais o motor gera para ela:
 *
 *  - Projetos MEI  → alerta de desenquadramento (teto de faturamento OU saída
 *                    do Simples). O teto é medido pela SOMA das NF-e emitidas
 *                    no ProContador. É um alerta de TENDÊNCIA, não a verdade
 *                    fiscal (vendas emitidas por fora não entram). A régua está
 *                    dita na mensagem para a equipe não confundir.
 *  - Projetos ME   → alerta de exclusão do Simples Nacional (situação do CNPJ).
 *  - TREINADORAS   → sem alerta, só a marcação de carteira.
 *
 * O motor (verificarTodas) roda no cron diário e faz upsert em company_alertas:
 * um alerta aberto por (empresa, tipo). Reprocessar todo dia atualiza o mesmo
 * alerta em vez de duplicar, e some (status 'resolvido') quando a condição
 * deixa de valer.
 */

import { Knex } from 'knex';
import { getDatabase } from '../config/database';
import { CnpjService } from './cnpjService';
import { logger } from '../middleware/requestLogger';

// ─── Projetos ───────────────────────────────────────────────────────────────

export type Projeto =
  | 'LIDER_MEI' | 'LIDER_ME'
  | 'CBPJ_MEI'  | 'CBPJ_ME'
  | 'TREINADORAS';

export type TipoAlerta = 'desenquadramento_mei' | 'exclusao_sn';

interface ProjetoDef {
  valor: Projeto;
  rotulo: string;
  /** Enquadramento que o projeto pressupõe: decide o alerta. */
  porte: 'MEI' | 'ME' | null;
}

export const PROJETOS: ProjetoDef[] = [
  { valor: 'LIDER_MEI',   rotulo: 'Líder MEI',   porte: 'MEI' },
  { valor: 'LIDER_ME',    rotulo: 'Líder ME',    porte: 'ME'  },
  { valor: 'CBPJ_MEI',    rotulo: 'CBPJ MEI',    porte: 'MEI' },
  { valor: 'CBPJ_ME',     rotulo: 'CBPJ ME',     porte: 'ME'  },
  { valor: 'TREINADORAS', rotulo: 'Treinadoras', porte: null  },
];

const PROJETOS_VALIDOS = PROJETOS.map((p) => p.valor);

export function projetoValido(v: unknown): v is Projeto {
  return typeof v === 'string' && (PROJETOS_VALIDOS as string[]).includes(v);
}

export function rotuloProjeto(v: string | null): string {
  return PROJETOS.find((p) => p.valor === v)?.rotulo ?? '';
}

function porteDoProjeto(projeto: string | null): 'MEI' | 'ME' | null {
  return PROJETOS.find((p) => p.valor === projeto)?.porte ?? null;
}

// ─── Régua do MEI ─────────────────────────────────────────────────────────────

// Teto anual do MEI vigente. Fica aqui, num só lugar, porque muda por lei
// (era 81.000; há projetos de aumento). Ao mudar, ajuste só esta linha.
export const TETO_MEI_ANUAL = 81000;
// A partir de quanto do teto o alerta de tendência dispara (80%).
const LIMIAR_ALERTA_MEI = 0.8;

/** Teto proporcional aos meses de atividade no ano (art. 18-A §7 LC 123). */
export function tetoProporcional(mesesAtivos: number): number {
  const meses = Math.min(12, Math.max(1, mesesAtivos));
  return (TETO_MEI_ANUAL / 12) * meses;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

interface ResultadoVerificacao {
  empresasVerificadas: number;
  alertasAbertos: number;
  alertasResolvidos: number;
  erros: number;
}

export class ProjetoAlertaService {

  /** Define/limpa o projeto de uma empresa. */
  static async definirProjeto(companyId: string, projeto: string | null): Promise<void> {
    if (projeto !== null && !projetoValido(projeto)) {
      throw Object.assign(
        new Error(`Projeto inválido. Use um de: ${PROJETOS_VALIDOS.join(', ')} (ou vazio).`),
        { status: 400 },
      );
    }
    const db = await getDatabase();
    const n = await db('companies').where({ id: companyId }).update({ projeto, updated_at: db.fn.now() });
    if (!n) throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
  }

  /**
   * Faturamento do ano corrente pela soma das NF-e emitidas no ProContador.
   * Só notas AUTORIZADAS e em ambiente de produção contam: rascunho, rejeitada
   * ou homologação não são faturamento real.
   */
  static async faturamentoAnoAtual(companyId: string, db?: Knex): Promise<number> {
    const conn = db ?? (await getDatabase());
    const ano = new Date().getFullYear();
    const row = await conn('nfe')
      .where({ company_id: companyId, status: 'AUTORIZADA', ambiente: 'producao' })
      .whereRaw('EXTRACT(YEAR FROM data_emissao) = ?', [ano])
      .sum({ total: 'valor_total' })
      .first();
    return Number(row?.total ?? 0);
  }

  /**
   * Roda o motor para todas as empresas com projeto que gera alerta.
   * Chamado pelo cron diário. Cada empresa é isolada: erro numa não derruba
   * as outras nem o job.
   */
  static async verificarTodas(): Promise<ResultadoVerificacao> {
    const db = await getDatabase();
    const res: ResultadoVerificacao = { empresasVerificadas: 0, alertasAbertos: 0, alertasResolvidos: 0, erros: 0 };

    const empresas = await db('companies')
      .whereNotNull('projeto')
      .whereNot('projeto', 'TREINADORAS')
      .select('id', 'cnpj', 'legal_name', 'projeto', 'created_at');

    for (const empresa of empresas) {
      try {
        const gerados = await ProjetoAlertaService.verificarEmpresa(empresa, db);
        res.empresasVerificadas += 1;
        res.alertasAbertos += gerados.abertos;
        res.alertasResolvidos += gerados.resolvidos;
      } catch (e) {
        res.erros += 1;
        logger.warn('[ALERTAS] Falha ao verificar empresa', {
          companyId: empresa.id,
          error: (e as Error).message,
        });
      }
    }

    logger.info('[ALERTAS] Verificação concluída', { ...res });
    return res;
  }

  /**
   * Avalia uma empresa e ajusta seus alertas. Retorna quantos ficaram abertos
   * e quantos foram resolvidos nesta passada.
   */
  static async verificarEmpresa(
    empresa: { id: string; cnpj: string; legal_name?: string; projeto: string; created_at?: string | Date },
    dbOverride?: Knex,
  ): Promise<{ abertos: number; resolvidos: number }> {
    const db = dbOverride ?? (await getDatabase());
    const porte = porteDoProjeto(empresa.projeto);
    let abertos = 0;
    let resolvidos = 0;

    // Situação no Simples: usada pelos dois portes (MEI também sai por exclusão
    // do Simples). Consulta externa; se falhar, não inventamos status, apenas
    // não mexemos no alerta de Simples desta empresa nesta passada.
    let optanteSimples: boolean | null = null;
    try {
      const info = await CnpjService.lookup(empresa.cnpj);
      optanteSimples = info.simples_nacional === true;
    } catch (e) {
      logger.debug('[ALERTAS] lookup CNPJ falhou, situação Simples ignorada nesta passada', {
        companyId: empresa.id, error: (e as Error).message,
      });
    }

    // ── Alerta de exclusão do Simples (projetos ME) ──
    if (porte === 'ME' && optanteSimples === false) {
      await ProjetoAlertaService.abrirOuAtualizar(db, empresa.id, 'exclusao_sn', {
        severidade: 'critico',
        mensagem:
          `${empresa.legal_name ?? 'Empresa'} não consta como optante do Simples Nacional. ` +
          'Verifique se houve exclusão e as providências (parcelamento, novo enquadramento).',
        contexto: { optante_simples: false, projeto: empresa.projeto },
      });
      abertos += 1;
    } else if (porte === 'ME' && optanteSimples === true) {
      resolvidos += await ProjetoAlertaService.resolver(db, empresa.id, 'exclusao_sn');
    }

    // ── Alerta de desenquadramento (projetos MEI) ──
    if (porte === 'MEI') {
      const faturamento = await ProjetoAlertaService.faturamentoAnoAtual(empresa.id, db);
      const meses = mesesDesde(empresa.created_at);
      const teto = tetoProporcional(meses);
      const consumido = teto > 0 ? faturamento / teto : 0;

      const saiuDoSimples = optanteSimples === false;
      const perto = consumido >= LIMIAR_ALERTA_MEI;

      if (saiuDoSimples || perto) {
        const motivos: string[] = [];
        if (saiuDoSimples) motivos.push('não consta como optante do Simples/SIMEI');
        if (perto) {
          motivos.push(
            `faturamento emitido no ProContador em ${Math.round(consumido * 100)}% do teto ` +
            `(R$ ${faturamento.toFixed(2)} de R$ ${teto.toFixed(2)})`,
          );
        }
        await ProjetoAlertaService.abrirOuAtualizar(db, empresa.id, 'desenquadramento_mei', {
          severidade: consumido >= 1 || saiuDoSimples ? 'critico' : 'atencao',
          mensagem:
            `${empresa.legal_name ?? 'Empresa'}: risco de desenquadramento do MEI (${motivos.join('; ')}). ` +
            'O valor considera apenas notas emitidas no ProContador; confira vendas emitidas por fora.',
          contexto: {
            faturamento_procontador: Number(faturamento.toFixed(2)),
            teto_proporcional: Number(teto.toFixed(2)),
            percentual_consumido: Number((consumido * 100).toFixed(1)),
            optante_simples: optanteSimples,
            projeto: empresa.projeto,
          },
        });
        abertos += 1;
      } else {
        resolvidos += await ProjetoAlertaService.resolver(db, empresa.id, 'desenquadramento_mei');
      }
    }

    return { abertos, resolvidos };
  }

  /** Lista alertas abertos de uma empresa (para o sino/tela). */
  static async listarAbertos(companyId: string): Promise<Array<Record<string, unknown>>> {
    const db = await getDatabase();
    return db('company_alertas')
      .where({ company_id: companyId, status: 'aberto' })
      .orderByRaw("CASE severidade WHEN 'critico' THEN 0 WHEN 'atencao' THEN 1 ELSE 2 END")
      .orderBy('created_at', 'desc')
      .select('*');
  }

  /** Alertas abertos ainda não enviados por e-mail (para o resumo diário). */
  static async pendentesDeEmail(db?: Knex): Promise<Array<Record<string, unknown>>> {
    const conn = db ?? (await getDatabase());
    return conn('company_alertas as a')
      .join('companies as c', 'c.id', 'a.company_id')
      .where('a.status', 'aberto')
      .whereNull('a.email_enviado_em')
      .select(
        'a.id', 'a.company_id', 'a.tipo', 'a.severidade', 'a.mensagem', 'a.contexto',
        'c.legal_name', 'c.projeto', 'c.cnpj',
      );
  }

  static async marcarEmailEnviado(ids: string[], db?: Knex): Promise<void> {
    if (ids.length === 0) return;
    const conn = db ?? (await getDatabase());
    await conn('company_alertas').whereIn('id', ids).update({ email_enviado_em: conn.fn.now() });
  }

  // ── Internos ──

  private static async abrirOuAtualizar(
    db: Knex,
    companyId: string,
    tipo: TipoAlerta,
    dados: { severidade: string; mensagem: string; contexto: Record<string, unknown> },
  ): Promise<void> {
    const existente = await db('company_alertas')
      .where({ company_id: companyId, tipo, status: 'aberto' })
      .first();

    if (existente) {
      // Atualiza o conteúdo, mas NÃO mexe em email_enviado_em: se a mensagem
      // não mudou de fato, não vale reenviar. Reenvio só quando o texto muda.
      const mudou = existente.mensagem !== dados.mensagem;
      await db('company_alertas').where({ id: existente.id }).update({
        severidade: dados.severidade,
        mensagem: dados.mensagem,
        contexto: JSON.stringify(dados.contexto),
        updated_at: db.fn.now(),
        ...(mudou ? { email_enviado_em: null } : {}),
      });
    } else {
      await db('company_alertas').insert({
        company_id: companyId,
        tipo,
        status: 'aberto',
        severidade: dados.severidade,
        mensagem: dados.mensagem,
        contexto: JSON.stringify(dados.contexto),
      });
    }
  }

  private static async resolver(db: Knex, companyId: string, tipo: TipoAlerta): Promise<number> {
    return db('company_alertas')
      .where({ company_id: companyId, tipo, status: 'aberto' })
      .update({ status: 'resolvido', resolvido_em: db.fn.now(), updated_at: db.fn.now() });
  }
}

/** Meses decorridos entre uma data e hoje, mínimo 1 (empresa nova = 1 mês). */
export function mesesDesde(desde?: string | Date | null): number {
  if (!desde) return 12;
  const d = new Date(desde);
  if (Number.isNaN(d.getTime())) return 12;
  const hoje = new Date();
  const meses = (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth()) + 1;
  return Math.min(12, Math.max(1, meses));
}
