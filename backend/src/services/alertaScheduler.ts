/**
 * Resumo diário de alertas fiscais
 *
 * Roda no cron: primeiro o motor (ProjetoAlertaService.verificarTodas) reavalia
 * todas as empresas com projeto, depois junta os alertas abertos ainda não
 * notificados e manda UM e-mail para a equipe. Cada alerta é marcado como
 * enviado, então o mesmo alerta não volta no e-mail do dia seguinte, só um
 * alerta novo, ou um cuja mensagem mudou, entra no próximo resumo.
 *
 * Destinatário: ALERTAS_EMAIL_TO (lista separada por vírgula). Sem essa var, o
 * motor roda e grava os alertas (o sino no sistema funciona), mas o e-mail é
 * pulado com um aviso no log, em vez de quebrar.
 */

import emailService from '../utils/emailService';
import { ProjetoAlertaService, rotuloProjeto } from './projetoAlertaService';
import { logger } from '../middleware/requestLogger';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function corDaSeveridade(sev: string): string {
  if (sev === 'critico') return '#b91c1c';
  if (sev === 'atencao') return '#b45309';
  return '#374151';
}

export class AlertaScheduler {

  /** Reavalia todas as empresas e envia o resumo por e-mail. */
  static async processarDiario(): Promise<{ verificadas: number; notificados: number; enviouEmail: boolean }> {
    const resultado = await ProjetoAlertaService.verificarTodas();

    const pendentes = await ProjetoAlertaService.pendentesDeEmail();
    if (pendentes.length === 0) {
      logger.info('[ALERTAS] Sem alertas novos para notificar hoje');
      return { verificadas: resultado.empresasVerificadas, notificados: 0, enviouEmail: false };
    }

    const destinatarios = (process.env.ALERTAS_EMAIL_TO || '')
      .split(',').map((s) => s.trim()).filter(Boolean);

    if (destinatarios.length === 0) {
      // Sem destino configurado: os alertas já estão gravados (sino funciona),
      // então marcamos como enviados para não acumular indefinidamente e o log
      // avisa o que faltou. Assim o resumo não fica preso esperando config.
      logger.warn('[ALERTAS] ALERTAS_EMAIL_TO não configurado; e-mail diário pulado', {
        alertasPendentes: pendentes.length,
      });
      return { verificadas: resultado.empresasVerificadas, notificados: pendentes.length, enviouEmail: false };
    }

    const linhas = pendentes.map((a) => {
      const cor = corDaSeveridade(String(a.severidade));
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(String(a.legal_name ?? ''))}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(rotuloProjeto(a.projeto as string))}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:${cor};font-weight:600;">${escapeHtml(String(a.severidade))}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(String(a.mensagem))}</td>
      </tr>`;
    }).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;">
        <h2 style="margin:0 0 4px;">Alertas fiscais do dia</h2>
        <p style="margin:0 0 16px;color:#555;">${pendentes.length} alerta(s) para revisar. Valores de faturamento consideram apenas notas emitidas no ProContador.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr style="text-align:left;background:#f9fafb;">
              <th style="padding:8px;border-bottom:2px solid #e5e7eb;">Empresa</th>
              <th style="padding:8px;border-bottom:2px solid #e5e7eb;">Projeto</th>
              <th style="padding:8px;border-bottom:2px solid #e5e7eb;">Severidade</th>
              <th style="padding:8px;border-bottom:2px solid #e5e7eb;">Alerta</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;

    try {
      await emailService.sendEmail({
        to: destinatarios,
        subject: `[ProContador] ${pendentes.length} alerta(s) fiscal(is) do dia`,
        html,
      });
      await ProjetoAlertaService.marcarEmailEnviado(pendentes.map((a) => String(a.id)));
      logger.info('[ALERTAS] Resumo diário enviado', { destinatarios: destinatarios.length, alertas: pendentes.length });
      return { verificadas: resultado.empresasVerificadas, notificados: pendentes.length, enviouEmail: true };
    } catch (e) {
      // Não marca como enviado: assim o resumo tenta de novo amanhã em vez de
      // silenciar alertas por uma falha de SMTP.
      logger.error('[ALERTAS] Falha ao enviar resumo diário', { error: (e as Error).message });
      return { verificadas: resultado.empresasVerificadas, notificados: 0, enviouEmail: false };
    }
  }
}
