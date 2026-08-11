/**
 * Gestão de usuários — rotas administrativas.
 *
 * TODAS exigem papel `admin`. Não é uma tela de perfil: é onde se concede
 * acesso à contabilidade de empresas de terceiros, e quem pode conceder acesso
 * pode conceder acesso a si mesmo.
 *
 * O `authorize('admin')` também barra token com mfaRequired, então quem parou
 * no meio do segundo fator não passa por aqui.
 *
 *   POST   /users                      cria usuário (login e senha)
 *   GET    /users                      lista usuários
 *   PATCH  /users/:id/ativo            ativa ou desativa o acesso
 *   PATCH  /users/:id/papel            troca o papel
 *   PATCH  /users/:id/senha            define nova senha
 *   GET    /users/:id/empresas         empresas que o usuário enxerga
 *   POST   /users/:id/empresas         atribui uma empresa
 *   DELETE /users/:id/empresas/:companyId   revoga o acesso a uma empresa
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, authorize } from '../middleware/auth';
import { UserManagementService, Papel } from '../services/userManagementService';
import { logger } from '../middleware/requestLogger';

const router = Router();

router.use(authenticateToken);
router.use(authorize('admin'));

/** Traduz o erro do serviço em resposta, preservando o status que ele definiu. */
function responderErro(res: Response, erro: unknown, contexto: string): void {
  const e = erro as Error & { status?: number };
  const status = e.status ?? 500;

  if (status >= 500) {
    logger.error(`[users] ${contexto}`, { erro: e.message, stack: e.stack });
  } else {
    logger.warn(`[users] ${contexto}`, { erro: e.message });
  }

  res.status(status).json({
    success: false,
    error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
    message: status >= 500
      // Mensagem interna não vaza para o cliente; fica no log.
      ? 'Erro ao processar a solicitação.'
      : e.message,
  });
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const usuario = await UserManagementService.criar(req.body, req.user!.id);
    res.status(201).json({ success: true, data: usuario });
  } catch (erro) {
    responderErro(res, erro, 'criar usuário');
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await UserManagementService.listar() });
  } catch (erro) {
    responderErro(res, erro, 'listar usuários');
  }
});

router.patch('/:id/ativo', async (req: Request, res: Response) => {
  try {
    const { ativo } = req.body as { ativo?: boolean };
    if (typeof ativo !== 'boolean') {
      res.status(400).json({ success: false, message: 'Informe ativo: true ou false.' });
      return;
    }
    const usuario = await UserManagementService.definirAtivo(req.params.id, ativo, req.user!.id);
    res.json({ success: true, data: usuario });
  } catch (erro) {
    responderErro(res, erro, 'alterar acesso');
  }
});

router.patch('/:id/papel', async (req: Request, res: Response) => {
  try {
    const { papel, confirmar_acesso_total } = req.body as {
      papel?: Papel; confirmar_acesso_total?: boolean;
    };
    const usuario = await UserManagementService.definirPapel(
      req.params.id, papel as Papel, confirmar_acesso_total, req.user!.id,
    );
    res.json({ success: true, data: usuario });
  } catch (erro) {
    responderErro(res, erro, 'alterar papel');
  }
});

router.patch('/:id/senha', async (req: Request, res: Response) => {
  try {
    const { senha } = req.body as { senha?: string };
    await UserManagementService.definirSenha(req.params.id, String(senha ?? ''), req.user!.id);
    // Sem corpo: não devolver nada que ecoe a senha, nem por engano.
    res.status(204).send();
  } catch (erro) {
    responderErro(res, erro, 'definir senha');
  }
});

router.get('/:id/empresas', async (req: Request, res: Response) => {
  try {
    const empresas = await UserManagementService.empresasDoUsuario(req.params.id);
    res.json({ success: true, data: empresas });
  } catch (erro) {
    responderErro(res, erro, 'listar empresas do usuário');
  }
});

router.post('/:id/empresas', async (req: Request, res: Response) => {
  try {
    const { company_id } = req.body as { company_id?: string };
    if (!company_id) {
      res.status(400).json({ success: false, message: 'Informe company_id.' });
      return;
    }
    await UserManagementService.atribuirEmpresa(req.params.id, company_id, req.user!.id);
    res.status(204).send();
  } catch (erro) {
    responderErro(res, erro, 'atribuir empresa');
  }
});

router.delete('/:id/empresas/:companyId', async (req: Request, res: Response) => {
  try {
    await UserManagementService.revogarEmpresa(
      req.params.id, req.params.companyId, req.user!.id,
    );
    res.status(204).send();
  } catch (erro) {
    responderErro(res, erro, 'revogar empresa');
  }
});

export default router;
