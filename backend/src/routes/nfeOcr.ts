/**
 * NF-e OCR Routes
 * Extração automática de dados de NF-e via OCR
 * 
 * POST   /companies/:companyId/nfe/ocr/upload              — Upload e extração
 * GET    /companies/:companyId/nfe/ocr/:uploadId            — Obter dados de upload
 * GET    /companies/:companyId/nfe/ocr/:uploadId/preview   — Preview de lançamento
 * POST   /companies/:companyId/nfe/ocr/:uploadId/confirm   — Confirmar e criar lançamento
 * GET    /companies/:companyId/nfe/ocr/:invoiceKey/validate — Validar com SEFAZ
 */

import { Router } from 'express';
import multer from 'multer';
import { NfeOcrController } from '../controllers/nfeOcrController';

const router = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  },
});

// Routes
router.post('/ocr/upload', upload.single('file'), NfeOcrController.upload);
router.get('/ocr/:uploadId', NfeOcrController.getUpload);
router.get('/ocr/:uploadId/preview', NfeOcrController.getPreview);
router.post('/ocr/:uploadId/confirm', NfeOcrController.confirm);
router.get('/ocr/:invoiceKey/validate', NfeOcrController.validate);

export default router;
