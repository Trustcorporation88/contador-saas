import { Router, Request, Response } from 'express';

/**
 * Taxes routes
 * GET    /appraisal
 * POST   /appraisal
 * GET    /register
 */
const router = Router();

// TODO: Implement tax endpoints
// - Tax appraisal (apuração de impostos)
// - ICMS calculation
// - COFINS calculation
// - PIS calculation
// - ISS calculation
// - IRPJ calculation
// - CSLL calculation
// - Tax registers and declarations

router.get('/appraisal', (_req: Request, res: Response) => {
  res.status(501).json({ message: 'Not implemented' });
});

router.post('/appraisal', (_req: Request, res: Response) => {
  res.status(501).json({ message: 'Not implemented' });
});

export default router;
