/**
 * Importação de empresas por planilha
 *
 * POST /companies/importar/analisar  (multipart, campo "file")
 *   Lê a planilha e devolve o diagnóstico linha a linha, sem criar nada.
 *
 * POST /companies/importar/lote
 *   Cria as empresas de um lote pequeno (a tela envia lote a lote e mostra o
 *   progresso). Body: { linhas: [...], atribuir_para?: userId }
 *
 * Mesma regra de quem cria empresa pela tela: admin e contador.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ImportacaoEmpresasService } from '../services/importacaoEmpresasService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../middleware/requestLogger';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const PODE_IMPORTAR = ['admin', 'accountant'];
// Lote pequeno de propósito: cada linha consulta o cartão do CNPJ, e um lote
// grande viraria uma requisição longa demais.
const MAX_LOTE = 15;

router.use(authenticateToken);

router.use((req: Request, res: Response, next) => {
  if (!req.user || !PODE_IMPORTAR.includes(req.user.role)) {
    res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Apenas administradores e contadores podem importar empresas',
    });
    return;
  }
  next();
});

router.post('/analisar', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({ success: false, message: 'Envie a planilha no campo "file"' });
      return;
    }
    const resultado = await ImportacaoEmpresasService.analisar(req.file.buffer);
    res.json({ success: true, data: resultado });
  } catch (erro) {
    const status = (erro as { status?: number }).status ?? 500;
    logger.error('Importação: falha ao analisar planilha', { error: (erro as Error).message });
    res.status(status).json({ success: false, message: (erro as Error).message });
  }
});

router.post('/lote', async (req: Request, res: Response) => {
  try {
    const { linhas, atribuir_para: atribuirPara } = req.body ?? {};
    if (!Array.isArray(linhas) || linhas.length === 0) {
      res.status(400).json({ success: false, message: 'Informe as linhas do lote' });
      return;
    }
    if (linhas.length > MAX_LOTE) {
      res.status(400).json({ success: false, message: `Máximo de ${MAX_LOTE} linhas por lote` });
      return;
    }
    const resultados = await ImportacaoEmpresasService.importarLote(
      linhas, req.user!.id, atribuirPara,
    );
    res.json({ success: true, data: resultados });
  } catch (erro) {
    logger.error('Importação: falha no lote', { error: (erro as Error).message });
    res.status(500).json({ success: false, message: (erro as Error).message });
  }
});

export default router;
