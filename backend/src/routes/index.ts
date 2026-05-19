import { Router } from 'express';
import authRoutes from './auth';
import companiesRoutes from './companies';
import journalsRoutes from './journals';
import reportsRoutes from './reports';
import taxesRoutes from './taxes';
import auditRoutes from './audit';
import cnpjRoutes from './cnpj';
import backupRoutes from './backup';
import copilotoRoutes from './copiloto';
import documentosFiscaisRoutes from './documentosFiscais';
import contasReceberRoutes from './contasReceber';
import contasPagarRoutes from './contasPagar';

/**
 * Main API v1 router
 * Registers all sub-routes
 */
const router = Router();

// Routes
router.use('/auth', authRoutes);
router.use('/companies', companiesRoutes);
router.use('/journals', journalsRoutes);
router.use('/reports', reportsRoutes);
router.use('/taxes', taxesRoutes);
router.use('/audit', auditRoutes);
router.use('/cnpj', cnpjRoutes);
router.use('/admin/backups', backupRoutes);
router.use('/copiloto', copilotoRoutes);
router.use('/documentos', documentosFiscaisRoutes);
router.use('/contas-receber', contasReceberRoutes);
router.use('/contas-pagar', contasPagarRoutes);

// API status
router.get('/status', (_req, res) => {
  const deployCommit = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown';

  res.json({
    status: 'operational',
    version: '1.0.0',
    deployCommit,
    timestamp: new Date().toISOString(),
  });
});

export default router;
