/**
 * CopilotoController
 * POST /api/v1/copiloto/chat — Envia mensagem para o Copiloto DeepSeek
 * GET  /api/v1/copiloto/status — Verifica se a API DeepSeek está configurada
 * POST /api/v1/copiloto/session — Cria nova sessão de chat
 * GET  /api/v1/copiloto/session/:id — Retorna histórico da sessão
 * GET  /api/v1/copiloto/export/:id — Exporta sessão como PDF
 * POST /api/v1/copiloto/export/:id/analysis — Exporta análise com dados financeiros
 */

import { Request, Response } from 'express';
import { DeepSeekService, FinancialContext, DeepSeekResponse } from '../services/deepseekService';
import { ValidationService } from '../services/validationService';
import { ChatHistoryService } from '../services/chatHistoryService';
import { PDFExportService } from '../services/pdfExportService';
import { ReportService } from '../services/reportService';
import { logger } from '../middleware/requestLogger';

/**
 * Busca os dados financeiros reais da empresa do usuário autenticado — nunca
 * confia nos números de balance/dre que o cliente envie no body, pois
 * permitiriam fabricar laudos com aparência oficial e dados falsos.
 */
async function loadRealFinancialContext(companyId: string): Promise<Pick<FinancialContext, 'balance' | 'dre'>> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [balanco, dre] = await Promise.all([
    ReportService.getBalanceSheet(companyId, today),
    ReportService.getIncomeStatement(companyId, monthStart, today),
  ]);

  const sumItems = (items: { balance?: number }[]) => items.reduce((s, i) => s + (i.balance ?? 0), 0);

  return {
    balance: {
      ativoTotal: balanco.total_assets,
      passivoTotal: balanco.liabilities.total,
      patrimonioLiquido: balanco.equity.total,
      ativoCirculante: sumItems(balanco.assets.current),
      passivoCirculante: sumItems(balanco.liabilities.current),
    },
    dre: {
      receitaLiquida: dre.gross_revenue,
      lucroLiquido: dre.net_income,
      // Relatório simplificado não detalha custo de vendas/impostos separadamente
      custoVendas: 0,
      impostos: 0,
    },
  };
}

const MAX_MESSAGE_LENGTH = 4000;
const MAX_COMPANY_NAME_LENGTH = 200;

/**
 * Sanitiza texto fornecido pelo cliente antes de interpolar no prompt do
 * sistema enviado ao LLM — remove quebras de linha e aspas que poderiam ser
 * usadas para tentar injetar novas instruções (prompt injection).
 */
function sanitizeForPrompt(value: string, maxLength: number): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/["'`]/g, '')
    .trim()
    .slice(0, maxLength);
}

export class CopilotoController {
  /**
   * GET /api/v1/copiloto/status
   */
  static async status(_req: Request, res: Response): Promise<void> {
    res.json({
      aiEnabled: DeepSeekService.isConfigured(),
      model:     DeepSeekService.isConfigured() ? 'deepseek-chat' : null,
    });
  }

  /**
   * POST /api/v1/copiloto/session
   * Body: { companyName: string }
   * Retorna: { sessionId: string }
   */
  static async createSession(req: Request, res: Response): Promise<void> {
    const { companyName } = req.body;

    if (!companyName || typeof companyName !== 'string') {
      res.status(400).json({ error: 'companyName é obrigatório.' });
      return;
    }

    const cleanCompanyName = sanitizeForPrompt(companyName, MAX_COMPANY_NAME_LENGTH);
    const sessionId = ChatHistoryService.createSession(cleanCompanyName, req.user!.id);
    res.json({ sessionId, companyName: cleanCompanyName });
  }

  /**
   * GET /api/v1/copiloto/session/:id
   * Retorna histórico completo da sessão
   */
  static async getSession(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const session = ChatHistoryService.getSession(id);
    if (!session || session.ownerUserId !== req.user!.id) {
      res.status(404).json({ error: 'Sessão não encontrada.' });
      return;
    }

    res.json(session);
  }

  /**
   * POST /api/v1/copiloto/chat
   * Body: {
   *   sessionId: string,                    // ID da sessão
   *   message:   string,                    // pergunta do usuário
   *   context:   FinancialContext,          // dados financeiros
   * }
   */
  static async chat(req: Request, res: Response): Promise<void> {
    const { sessionId, message, context } = req.body as {
      sessionId: string;
      message:   string;
      context:   FinancialContext;
    };

    // Validar sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'sessionId é obrigatório.' });
      return;
    }

    const session = ChatHistoryService.getSession(sessionId);
    if (!session || session.ownerUserId !== req.user!.id) {
      res.status(404).json({ error: 'Sessão não encontrada.' });
      return;
    }

    // Validar message
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'message é obrigatório.' });
      return;
    }
    if (message.trim().length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({
        error: `message excede o limite de ${MAX_MESSAGE_LENGTH} caracteres.`,
      });
      return;
    }

    // Validar context.companyName
    if (!context?.companyName) {
      res.status(400).json({ error: 'context.companyName é obrigatório.' });
      return;
    }
    // Sanitiza antes de interpolar no prompt do sistema (evita prompt injection via nome livre)
    context.companyName = sanitizeForPrompt(context.companyName, MAX_COMPANY_NAME_LENGTH);

    // Nunca confia em balance/dre vindos do cliente — busca os dados reais da
    // empresa autenticada. Evita que o usuário fabrique números e gere uma
    // "análise" com aparência oficial baseada em dados falsos.
    if (req.user?.companyId) {
      try {
        const real = await loadRealFinancialContext(req.user.companyId);
        context.balance = real.balance;
        context.dre = real.dre;
      } catch (err) {
        logger.warn('Falha ao carregar dados financeiros reais para o Copiloto', {
          error: (err as Error).message,
        });
        context.balance = undefined;
        context.dre = undefined;
      }
    }

    // Validar dados financeiros
    const validation = ValidationService.validateFinancialContext(context);

    if (!validation.isValid) {
      res.status(400).json({
        error: 'Dados financeiros inválidos',
        validation,
      });
      return;
    }

    try {
      // Adicionar mensagem do usuário ao histórico
      ChatHistoryService.addMessage(sessionId, 'user', message.trim());

      // Obter histórico para contexto
      const history = ChatHistoryService.getHistory(sessionId);

      const result = await DeepSeekService.chat(
        message.trim(),
        context,
        history.slice(0, -1) as Array<{ role: 'user' | 'assistant'; content: string }>, // Excluir a mensagem atual (já está no contexto)
      );

      if (result.fallback) {
        res.status(503).json({
          fallback: true,
          reason: result.reason,
          message: result.reason === 'no_api_key'
            ? 'DeepSeek API key não configurada. Usando motor local.'
            : 'Serviço DeepSeek indisponível no momento. Usando motor local.',
          validation,
        });
        return;
      }

      const aiResult = result as DeepSeekResponse;

      // Adicionar resposta do assistente ao histórico
      ChatHistoryService.addMessage(sessionId, 'assistant', aiResult.reply);

      res.json({
        sessionId,
        reply:    aiResult.reply,
        model:    aiResult.model,
        tokens:   aiResult.tokens,
        fallback: false,
        validation,
        messageCount: ChatHistoryService.getSession(sessionId)?.messages.length || 0,
      });
    } catch (err) {
      logger.error('CopilotoController.chat error', { err });
      res.status(503).json({
        fallback: true,
        reason:   'api_error',
        message:  'Erro interno ao processar a pergunta. Usando motor local.',
        validation,
      });
    }
  }

  /**
   * GET /api/v1/copiloto/export/:id
   * Exporta sessão como PDF
   */
  static async exportSessionPDF(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const session = ChatHistoryService.getSession(id);
    if (!session || session.ownerUserId !== req.user!.id) {
      res.status(404).json({ error: 'Sessão não encontrada' });
      return;
    }

    try {
      const pdfStream = PDFExportService.generateSessionPDF(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="copiloto-${id}.pdf"`);

      pdfStream.pipe(res);
    } catch (err) {
      logger.error('CopilotoController.exportSessionPDF error', { err });
      res.status(404).json({ error: 'Sessão não encontrada' });
    }
  }

  /**
   * POST /api/v1/copiloto/export/:id/analysis
   * Exporta sessão com análise financeira como PDF
   * Body: { financialData: FinancialContext }
   */
  static async exportAnalysisPDF(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const session = ChatHistoryService.getSession(id);
    if (!session || session.ownerUserId !== req.user!.id) {
      res.status(404).json({ error: 'Sessão não encontrada' });
      return;
    }

    // Ignora financialData enviado pelo cliente — o PDF exportado precisa
    // refletir os dados reais da empresa, não números fabricados pelo usuário.
    let financialData: Pick<FinancialContext, 'balance' | 'dre'> | Record<string, never> = {};
    if (req.user?.companyId) {
      try {
        financialData = await loadRealFinancialContext(req.user.companyId);
      } catch (err) {
        logger.warn('Falha ao carregar dados financeiros reais para exportação de análise', {
          error: (err as Error).message,
        });
      }
    }

    try {
      const pdfStream = PDFExportService.generateAnalysisPDF(id, financialData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="analise-${id}.pdf"`);

      pdfStream.pipe(res);
    } catch (err) {
      logger.error('CopilotoController.exportAnalysisPDF error', { err });
      res.status(404).json({ error: 'Sessão não encontrada' });
    }
  }
}
