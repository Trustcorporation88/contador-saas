/**
 * DAS Scheduler
 * Gera automaticamente boletos DAS para o próximo vencimento (20º dia)
 * Executa via cron job ou job queue
 */

import { getDatabase } from '../config/database';
import { DASService } from './dasService';
import { logger } from '../middleware/requestLogger';

export class DASScheduler {
  /**
   * Executa geração automática de DAS para o mês corrente
   * Deve ser acionado diariamente (recomendado: 01:00 UTC)
   */
  static async processarGeracaoMensal(): Promise<void> {
    const db = await getDatabase();
    const hoje = new Date();
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();

    logger.info('[DAS_SCHEDULER] Iniciando processamento mensal', { mes, ano });

    try {
      // Buscar todas as empresas com agendamento automático ativo
      const agendamentos = await db('das_agendamentos')
        .where({ is_active: true, auto_gerar: true })
        .select();

      logger.info(`[DAS_SCHEDULER] Encontrados ${agendamentos.length} agendamentos ativos`);

      for (const agendamento of agendamentos) {
        try {
          // Verificar se já existe DAS para este mês
          const dasExistente = await db('das_boletos')
            .where({
              company_id: agendamento.company_id,
              mes_competencia: mes,
              ano_competencia: ano,
              regime_tributario: agendamento.regime_tributario,
              is_active: true,
            })
            .whereIn('status', ['EMITIDO', 'PENDENTE', 'PAGO'])
            .first();

          if (dasExistente) {
            logger.debug('[DAS_SCHEDULER] DAS já existe', {
              companyId: agendamento.company_id,
              regime: agendamento.regime_tributario,
              mes,
              ano,
            });
            continue;
          }

          // Buscar usuário admin da empresa para registrar como criador
          const adminUser = await db('accounts')
            .where({
              company_id: agendamento.company_id,
              role: 'admin',
              is_active: true,
            })
            .first();

          if (!adminUser) {
            logger.warn('[DAS_SCHEDULER] Nenhum usuário admin encontrado', {
              companyId: agendamento.company_id,
            });
            continue;
          }

          // Gerar DAS automaticamente
          const result = await DASService.gerarAutomaticamente(
            agendamento.company_id,
            adminUser.id,
            mes,
            ano,
            agendamento.regime_tributario,
          );

          if (result.success) {
            logger.info('[DAS_SCHEDULER] DAS gerado com sucesso', {
              companyId: agendamento.company_id,
              regime: agendamento.regime_tributario,
              dasId: result.data?.id,
              valor: result.data?.valor_total,
            });

            // Atualizar último agendamento
            const proximoMes = mes === 12 ? 1 : mes + 1;
            const proximoAno = mes === 12 ? ano + 1 : ano;
            const proxVencimento = new Date(proximoAno, proximoMes - 1, 20);

            await db('das_agendamentos').where({ id: agendamento.id }).update({
              ultimo_agendamento: new Date(),
              proximo_agendamento: proxVencimento,
              updated_at: new Date(),
            });
          } else {
            logger.error('[DAS_SCHEDULER] Erro ao gerar DAS', {
              companyId: agendamento.company_id,
              regime: agendamento.regime_tributario,
              erro: result.message,
            });
          }
        } catch (err) {
          logger.error('[DAS_SCHEDULER] Erro ao processar agendamento', {
            agendamentoId: agendamento.id,
            companyId: agendamento.company_id,
            erro: (err as Error).message,
          });
        }
      }

      logger.info('[DAS_SCHEDULER] Processamento mensal concluído');
    } catch (err) {
      logger.error('[DAS_SCHEDULER] Erro fatal no processamento', {
        erro: (err as Error).message,
        stack: (err as Error).stack,
      });
    }
  }

  /**
   * Verifica se há DAS vencidos e os marca como VENCIDO
   * Executa diariamente (recomendado: 02:00 UTC)
   */
  static async atualizarVencidos(): Promise<void> {
    const db = await getDatabase();
    const hoje = new Date();

    logger.info('[DAS_SCHEDULER] Iniciando atualização de vencidos');

    try {
      // Marcar DAS vencidos
      const resultado = await db('das_boletos')
        .where({
          is_active: true,
        })
        .whereIn('status', ['EMITIDO', 'PENDENTE'])
        .where('data_vencimento', '<', hoje)
        .update({
          status: 'VENCIDO',
          updated_at: new Date(),
        });

      logger.info('[DAS_SCHEDULER] DAS marcados como vencidos', { count: resultado });
    } catch (err) {
      logger.error('[DAS_SCHEDULER] Erro ao atualizar vencidos', {
        erro: (err as Error).message,
      });
    }
  }

  /**
   * Envia alertas para DAS que vencem em breve
   * Executa diariamente (recomendado: 03:00 UTC)
   */
  static async verificarVencimentosProximos(): Promise<void> {
    const db = await getDatabase();
    const hoje = new Date();

    logger.info('[DAS_SCHEDULER] Iniciando verificação de vencimentos próximos');

    try {
      // Para cada agendamento, buscar DAS que vencem em breve
      const agendamentos = await db('das_agendamentos')
        .where({ is_active: true, auto_gerar: true })
        .select();

      for (const agendamento of agendamentos) {
        const diasAlerta = agendamento.dias_antes_alerta || 3;
        const dataAlerta = new Date(hoje);
        dataAlerta.setDate(dataAlerta.getDate() + diasAlerta);

        const dasProximos = await db('das_boletos')
          .where({
            company_id: agendamento.company_id,
            is_active: true,
          })
          .whereIn('status', ['EMITIDO', 'PENDENTE'])
          .whereBetween('data_vencimento', [hoje, dataAlerta])
          .select();

        if (dasProximos.length > 0) {
          logger.info('[DAS_SCHEDULER] DAS com vencimento próximo detectados', {
            companyId: agendamento.company_id,
            regime: agendamento.regime_tributario,
            count: dasProximos.length,
            diasAlerta,
          });

          // TODO: Implementar envio de notificação
          // - Email para usuários da empresa
          // - Push notification
          // - Webhook para sistema externo
        }
      }

      logger.info('[DAS_SCHEDULER] Verificação de vencimentos próximos concluída');
    } catch (err) {
      logger.error('[DAS_SCHEDULER] Erro ao verificar vencimentos próximos', {
        erro: (err as Error).message,
      });
    }
  }

  /**
   * Executa todas as tarefas do scheduler
   */
  static async executarTodasAsTarefas(): Promise<void> {
    logger.info('[DAS_SCHEDULER] Iniciando execução de todas as tarefas');

    const startTime = Date.now();

    try {
      await this.atualizarVencidos();
      await this.verificarVencimentosProximos();
      await this.processarGeracaoMensal();

      const duracao = Date.now() - startTime;
      logger.info('[DAS_SCHEDULER] Todas as tarefas concluídas', {
        duracao: `${duracao}ms`,
      });
    } catch (err) {
      logger.error('[DAS_SCHEDULER] Erro ao executar tarefas', {
        erro: (err as Error).message,
      });
    }
  }
}
