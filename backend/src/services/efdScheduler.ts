/**
 * EFD Scheduler
 * Automatic EFD generation on 5th day of each month at 08:00 AM (São Paulo timezone)
 * Also includes email notifications
 */

import cron from 'node-cron';
import { getDatabase } from '../config/database';
import { EFDBuilderService } from './efdBuilderService';
import { sendEmailNotification } from '../utils/emailService';
import crypto from 'crypto';

export class EFDSchedulerService {
  private static scheduledJobs: Map<string, any> = new Map();

  /**
   * Initialize all scheduled EFD generation jobs
   * Called once at application startup
   */
  static async initializeSchedules(): Promise<void> {
    try {
      console.log('[EFD Scheduler] Initializing automatic EFD schedules...');

      const db = await getDatabase();

      // Get all companies with EFD scheduler enabled
      const configs = await db('efd_scheduler_config').where({ enabled: true });

      for (const config of configs) {
        await this.scheduleCompanyEFD(config);
      }

      console.log(`[EFD Scheduler] Initialized ${configs.length} scheduled jobs`);
    } catch (error) {
      console.error('[EFD Scheduler] Error initializing schedules:', error);
    }
  }

  /**
   * Schedule EFD generation for a specific company
   */
  static async scheduleCompanyEFD(config: any): Promise<void> {
    try {
      const { company_id, day_of_month, hour, minute, timezone } = config;

      // Clear existing job if any
      if (this.scheduledJobs.has(company_id)) {
        const existingJob = this.scheduledJobs.get(company_id);
        existingJob.stop();
        existingJob.destroy();
        this.scheduledJobs.delete(company_id);
      }

      // Create cron expression
      // Format: minute hour day_of_month month day_of_week
      // Example: "0 8 5 * *" = 08:00 on 5th day of every month
      const cronExpression = `${minute} ${hour} ${day_of_month} * *`;

      // Schedule job with timezone support
      const job = cron.schedule(
        cronExpression,
        () => this.executeEFDGeneration(company_id, config),
        {
          scheduled: true,
          timezone: timezone || 'America/Sao_Paulo',
        },
      );

      this.scheduledJobs.set(company_id, job);

      console.log(
        `[EFD Scheduler] Scheduled EFD generation for company ${company_id}: "${cronExpression}" (${timezone})`,
      );
    } catch (error) {
      console.error(`[EFD Scheduler] Error scheduling company ${config.company_id}:`, error);
    }
  }

  /**
   * Execute EFD generation for a company
   * This is the actual function that runs on the scheduled time
   */
  private static async executeEFDGeneration(companyId: string, config: any): Promise<void> {
    const executionId = crypto.randomUUID();
    const startTime = new Date();

    try {
      console.log(`[EFD Scheduler] Starting EFD generation for company ${companyId} (${executionId})`);

      const db = await getDatabase();

      // Get previous month (EFD is generated for the previous month)
      const now = new Date();
      const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      // Check if EFD already exists
      const existing = await db('efd_generations')
        .where({
          company_id: companyId,
          month: previousMonth,
          year: previousYear,
        })
        .whereNotIn('status', ['cancelled']);

      if (existing.length > 0) {
        console.log(
          `[EFD Scheduler] EFD already exists for ${previousMonth}/${previousYear} (${companyId})`,
        );
        return;
      }

      // Generate EFD with configured options
      const generation = await EFDBuilderService.generateEFD(companyId, {
        month: previousMonth,
        year: previousYear,
        includeOperations: config.include_operations !== false,
        includeInventory: config.include_inventory === true,
        includeAdjustments: config.include_adjustments !== false,
      });

      // Validate automatically
      const validation = await EFDBuilderService.validateEFD(generation.id);

      // Get company info for email
      const company = await db('companies').where({ id: companyId }).first();

      // Send notification email if configured
      if (config.notify_on_completion && config.notification_email) {
        await this.sendCompletionEmail(
          config.notification_email,
          company.company_name,
          generation,
          validation,
          config,
        );
      }

      const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000);
      console.log(
        `[EFD Scheduler] EFD generation completed successfully for ${companyId} in ${duration}s`,
      );

      // Log to database
      await db('efd_audit_log').insert({
        id: crypto.randomUUID(),
        generation_id: generation.id,
        action: 'auto_generate',
        status: 'success',
        details: JSON.stringify({ execution_id: executionId, duration_seconds: duration }),
        performed_at: new Date(),
      });
    } catch (error) {
      const errorMessage = (error as Error).message;

      console.error(
        `[EFD Scheduler] Error during EFD generation for company ${companyId}: ${errorMessage}`,
      );

      // Send error email if configured
      if (config.notify_on_error && config.notification_email) {
        await this.sendErrorEmail(config.notification_email, companyId, errorMessage, config);
      }

      const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000);

      // Log to database
      const db = await getDatabase();
      await db('efd_audit_log').insert({
        id: crypto.randomUUID(),
        action: 'auto_generate_error',
        status: 'failed',
        details: JSON.stringify({ execution_id: executionId, duration_seconds: duration }),
        error_message: errorMessage,
        performed_at: new Date(),
      });
    }
  }

  /**
   * Send completion email notification
   */
  private static async sendCompletionEmail(
    email: string,
    companyName: string,
    generation: any,
    validation: any,
    config: any,
  ): Promise<void> {
    try {
      const month = String(generation.month).padStart(2, '0');
      const statusIcon = validation.is_valid ? '✅' : '⚠️';

      const emailSubject = `EFD ${generation.year}/${month} - ${companyName} - ${statusIcon}`;

      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; font-size: 14px; color: #0066cc; margin-bottom: 10px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .label { font-weight: bold; }
    .value { text-align: right; }
    .errors { background-color: #fee; padding: 10px; border-radius: 5px; color: #900; }
    .success { background-color: #efe; padding: 10px; border-radius: 5px; color: #090; }
    .button { background-color: #0066cc; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block; margin-top: 10px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Relatório de Geração de EFD</h2>
      <p><strong>${companyName}</strong></p>
      <p>Período: ${generation.year}/${month}</p>
    </div>

    <div class="section">
      <div class="section-title">📊 Status da Geração</div>
      <div class="info-row">
        <span class="label">Status:</span>
        <span class="value">${generation.status.toUpperCase()}</span>
      </div>
      <div class="info-row">
        <span class="label">Data de Geração:</span>
        <span class="value">${new Date(generation.generated_at).toLocaleString('pt-BR')}</span>
      </div>
      <div class="info-row">
        <span class="label">Total de Registros:</span>
        <span class="value">${generation.record_count}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">💰 Totalizações</div>
      <div class="info-row">
        <span class="label">Total Débito:</span>
        <span class="value">R$ ${(generation.total_debit || 0).toFixed(2)}</span>
      </div>
      <div class="info-row">
        <span class="label">Total Crédito:</span>
        <span class="value">R$ ${(generation.total_credit || 0).toFixed(2)}</span>
      </div>
      <div class="info-row">
        <span class="label">Diferença:</span>
        <span class="value">R$ ${(generation.total_debit - generation.total_credit).toFixed(2)}</span>
      </div>
      <div class="info-row">
        <span class="label">Balanceado:</span>
        <span class="value">${generation.debit_credit_balanced ? '✅ Sim' : '❌ Não'}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">✓ Validação</div>
      ${
        validation.is_valid
          ? `<div class="success">✅ EFD validada com sucesso! Nenhum erro encontrado.</div>`
          : `<div class="errors">⚠️ EFD com ${validation.errors.length} erro(s) encontrado(s):<br><br>
            ${validation.errors.map((e: any) => `• ${e.message}`).join('<br>')}
          </div>`
      }
    </div>

    <div class="section">
      <div class="section-title">📁 Arquivo</div>
      <p>O arquivo EFD foi gerado e está pronto para download na plataforma.</p>
      <a href="https://contador.app/api/v1/companies/${config.company_id}/efd/${generation.id}/download" class="button">Baixar EFD</a>
    </div>

    <div class="footer">
      <p>Este é um email automático. Não responda diretamente.</p>
      <p>Contador - Sistema de Contabilidade Automática</p>
      <p>© ${new Date().getFullYear()} Todos os direitos reservados</p>
    </div>
  </div>
</body>
</html>
      `;

      await sendEmailNotification({
        to: email,
        subject: emailSubject,
        html: emailBody,
        priority: 'high',
      });

      console.log(`[EFD Scheduler] Completion email sent to ${email}`);
    } catch (error) {
      console.error('[EFD Scheduler] Error sending completion email:', error);
    }
  }

  /**
   * Send error notification email
   */
  private static async sendErrorEmail(
    email: string,
    companyId: string,
    errorMessage: string,
    config: any,
  ): Promise<void> {
    try {
      const emailSubject = `❌ Erro na Geração de EFD - Ação Requerida`;

      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #ffe0e0; padding: 20px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #cc0000; }
    .error-box { background-color: #ffe0e0; padding: 15px; border-radius: 5px; color: #900; margin: 20px 0; border-left: 4px solid #cc0000; }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; font-size: 14px; color: #cc0000; margin-bottom: 10px; }
    .button { background-color: #cc0000; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block; margin-top: 10px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>❌ Erro na Geração de EFD</h2>
      <p>Houve um erro durante a geração automática de EFD</p>
    </div>

    <div class="section">
      <div class="section-title">Erro Detectado</div>
      <div class="error-box">
        <strong>Mensagem de Erro:</strong><br>
        ${errorMessage}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Ações Recomendadas</div>
      <ul>
        <li>Verifique se há lançamentos contábeis pendentes de validação</li>
        <li>Confira os saldos das contas</li>
        <li>Verifique a integridade dos dados de entrada</li>
        <li>Se o problema persistir, contate o suporte</li>
      </ul>
    </div>

    <div class="section">
      <a href="https://contador.app/dashboard/efd/${companyId}" class="button">Acessar Painel de EFD</a>
    </div>

    <div class="footer">
      <p>Este é um email automático. Não responda diretamente.</p>
      <p>Contador - Sistema de Contabilidade Automática</p>
      <p>© ${new Date().getFullYear()} Todos os direitos reservados</p>
    </div>
  </div>
</body>
</html>
      `;

      await sendEmailNotification({
        to: email,
        subject: emailSubject,
        html: emailBody,
        priority: 'high',
      });

      console.log(`[EFD Scheduler] Error email sent to ${email}`);
    } catch (error) {
      console.error('[EFD Scheduler] Error sending error email:', error);
    }
  }

  /**
   * Update schedule for a company
   */
  static async updateSchedule(config: any): Promise<void> {
    try {
      const db = await getDatabase();

      await db('efd_scheduler_config')
        .where({ company_id: config.company_id })
        .update({
          ...config,
          updated_at: new Date(),
        });

      await this.scheduleCompanyEFD(config);
      console.log(`[EFD Scheduler] Updated schedule for company ${config.company_id}`);
    } catch (error) {
      console.error('[EFD Scheduler] Error updating schedule:', error);
      throw error;
    }
  }

  /**
   * Disable schedule for a company
   */
  static async disableSchedule(companyId: string): Promise<void> {
    try {
      const db = await getDatabase();

      await db('efd_scheduler_config').where({ company_id: companyId }).update({
        enabled: false,
        updated_at: new Date(),
      });

      if (this.scheduledJobs.has(companyId)) {
        const job = this.scheduledJobs.get(companyId);
        job.stop();
        job.destroy();
        this.scheduledJobs.delete(companyId);
      }

      console.log(`[EFD Scheduler] Disabled schedule for company ${companyId}`);
    } catch (error) {
      console.error('[EFD Scheduler] Error disabling schedule:', error);
      throw error;
    }
  }

  /**
   * Get all active jobs
   */
  static getActiveJobs(): any[] {
    const jobs: any[] = [];
    for (const [companyId, job] of this.scheduledJobs) {
      jobs.push({
        company_id: companyId,
        active: !job._destroyed,
      });
    }
    return jobs;
  }
}

export default EFDSchedulerService;
