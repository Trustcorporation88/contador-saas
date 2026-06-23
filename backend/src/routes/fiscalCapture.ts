import { Router } from 'express';
import multer from 'multer';
import { FiscalCaptureController } from '../controllers/fiscalCaptureController';

const router = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/x-pkcs12',
      'application/pkcs12',
      'application/octet-stream',
    ];
    const isPfx = file.originalname.toLowerCase().endsWith('.pfx');
    if (allowed.includes(file.mimetype) || isPfx) {
      cb(null, true);
      return;
    }
    cb(new Error('Envie um certificado A1 (.pfx)'));
  },
});

router.post('/certificate', upload.single('certificate'), FiscalCaptureController.uploadCertificate);
router.get('/status', FiscalCaptureController.getStatus);
router.get('/captures', FiscalCaptureController.listCaptures);
router.post('/sync', FiscalCaptureController.sync);

export default router;
