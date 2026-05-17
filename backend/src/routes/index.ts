import { Router } from 'express';
import authRoutes from './auth';
import companiesRoutes from './companies';
import journalsRoutes from './journals';
import reportsRoutes from './reports';
import taxesRoutes from './taxes';
import auditRoutes from './audit';

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

// API status
router.get('/status', (_req, res) => {
  res.json({
    status: 'operational',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;
