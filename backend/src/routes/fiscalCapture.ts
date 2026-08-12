import { Router } from 'express';
import multer from 'multer';
import { FiscalCaptureController } from '../controllers/fiscalCaptureController';
import { authenticateToken } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/multiTenant';

const router = Router({ mergeParams: true });

router.use(authenticateToken, validateTenantAccess);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/x-pkcs12',
      'application/pkcs12',
      'application/octet-stream',
    ];
    const name = file.originalname.toLowerCase();
    const isPfx = name.endsWith('.pfx') || name.endsWith('.p12');
    if (allowed.includes(file.mimetype) || isPfx) {
      cb(null, true);
      return;
    }
    cb(new Error('Envie um certificado A1 (.pfx ou .p12)'));
  },
});

router.post('/certificate', upload.single('certificate'), FiscalCaptureController.uploadCertificate);
router.get('/status', FiscalCaptureController.getStatus);
router.get('/captures', FiscalCaptureController.listCaptures);
router.post('/sync', FiscalCaptureController.sync);
router.post('/reprocess', FiscalCaptureController.reprocess);

/**
 * Manifestação do destinatário — Ciência da Operação (210210).
 *
 * POST porque envia evento à SEFAZ: não é consulta e não é idempotente do ponto
 * de vista do fisco (o reenvio devolve duplicidade, cStat 573).
 */
router.post('/manifestar', FiscalCaptureController.manifestar);
router.post('/manifestar-resumos', FiscalCaptureController.manifestarResumos);

export default router;
