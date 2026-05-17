/**
 * CopilotoController
 * POST /api/v1/copiloto/chat — Envia mensagem para o Copiloto DeepSeek
 * GET  /api/v1/copiloto/status — Verifica se a API DeepSeek está configurada
 */

import { Request, Response } from 'express';
import { DeepSeekService, FinancialContext } from '../services/deepseekService';
import { logger } from '../middleware/requestLogger';

export class CopilotoController {
  /**
   * GET /api/v1/copiloto/status
   * Retorna se o modo IA real está disponível.
   */
  static async status(_req: Request, res: Response): Promise<void> {
    res.json({
      aiEnabled: DeepSeekService.isConfigured(),
      model:     DeepSeekService.isConfigured() ? 'deepseek-chat' : null,
    });
  }

  /**
   * POST /api/v1/copiloto/chat
   * Body: {
   *   message:  string,                     // pergunta do usuário
   *   context:  FinancialContext,            // dados financeiros da empresa
   *   history?: Array<{role, content}>,      // histórico de mensagens (opcional)
   * }
   */
  static async chat(req: Request, res: Response): Promise<void> {
    const { message, context, history } = req.body as {
      message:  string;
      context:  FinancialContext;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'message é obrigatório.' });
      return;
    }

    if (!context?.companyName) {
      res.status(400).json({ error: 'context.companyName é obrigatório.' });
      return;
    }

    try {
      const result = await DeepSeekService.chat(
        message.trim(),
        context,
        history ?? [],
      );

      if (result.fallback) {
        // Informa o frontend para usar o motor local
        res.status(503).json({
          fallback: true,
          reason: result.reason,
          message: result.reason === 'no_api_key'
            ? 'DeepSeek API key não configurada. Usando motor local.'
            : 'Serviço DeepSeek indisponível no momento. Usando motor local.',
        });
        return;
      }

      res.json({
        reply:    result.reply,
        model:    result.model,
        tokens:   result.tokens,
        fallback: false,
      });
    } catch (err) {
      logger.error('CopilotoController.chat error', { err });
      res.status(503).json({
        fallback: true,
        reason:   'api_error',
        message:  'Erro interno ao processar a pergunta. Usando motor local.',
      });
    }
  }
}
