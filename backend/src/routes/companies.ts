import { Router, Request, Response } from 'express';
import { CompanyController } from '../controllers/companyController';
import { authenticateToken } from '../middleware/auth';
import accountsRoutes from './accounts';
import journalsRoutes from './journals';
import reportsRoutes from './reports';
import taxesRoutes from './taxes';
import nfeRoutes from './nfe';

/**
 * Companies API Routes
 * All endpoints require authentication via authenticateToken middleware
 *
 * Endpoints:
 * GET    /                  - List companies with pagination (admin sees all, users see own)
 * POST   /                  - Create company (admin only)
 * GET    /:id               - Get company details (owner or admin)
 * PUT    /:id               - Update company (owner or admin)
 * DELETE /:id               - Delete company soft delete (admin only)
 * GET    /:id/stats         - Get company statistics (owner or admin)
 *
 * Multi-tenancy: Automatically scoped via TenantContext in middleware
 * Audit: All operations logged to access_audit table
 */
const router = Router();

/**
 * Apply authentication middleware to all routes
 * Populates req.user with authenticated user info
 */
router.use(authenticateToken);

/**
 * POST /companies
 * Create new company
 * Admin only
 * Body: {cnpj, name, address?, phone?, email?, tax_regime, fiscal_year_start?}
 * Response 201: Company object
 * Errors: 400 (validation), 409 (cnpj exists), 403 (forbidden)
 */
router.post('/', CompanyController.createCompany);

/**
 * GET /companies
 * List companies with pagination and filters
 * Query params:
 *  - page: number (default 1)
 *  - limit: number (default 10, max 100)
 *  - search: string (search by name, case-insensitive)
 *  - tax_regime: string (filter by regime)
 *  - created_from: ISO date string
 *  - created_to: ISO date string
 *
 * Admin sees all companies
 * Non-admin users see only their own companies (via company_users)
 *
 * Response 200: {data: Company[], pagination: {total, page, limit, totalPages}}
 */
router.get('/', CompanyController.listCompanies);

/**
 * GET /companies/:id
 * Get company details
 * Owner or Admin only
 * Response 200: Company object
 * Errors: 404 (not found), 403 (forbidden)
 */
router.get('/:id', CompanyController.getCompany);

/**
 * GET /companies/:id/stats
 * Get company statistics (users, journals, accounts, etc.)
 * Owner or Admin only
 * Response 200: {users, journals, accounts, ...}
 */
router.get('/:id/stats', CompanyController.getCompanyStats);

/**
 * PUT /companies/:id
 * Update company
 * Owner or Admin only
 * Body: {name?, address?, phone?, email?, tax_regime?, fiscal_year_start?}
 * Note: CNPJ is immutable
 * Response 200: Updated Company object
 * Errors: 400 (validation), 404 (not found), 403 (forbidden)
 */
router.put('/:id', CompanyController.updateCompany);

/**
 * DELETE /companies/:id
 * Soft delete company (sets is_active = false)
 * Admin only
 * Response 204: No Content
 * Errors: 404 (not found), 403 (forbidden)
 */
router.delete('/:id', CompanyController.deleteCompany);

/**
 * SUB-ROUTES
 * Register accounts routes as /companies/:id/accounts
 * Register journal routes as /companies/:id/journal-entries
 */
router.use('/:companyId/accounts', accountsRoutes);
router.use('/:companyId/journal-entries', journalsRoutes);
router.use('/:companyId/reports', reportsRoutes);
router.use('/:companyId/taxes', taxesRoutes);
router.use('/:companyId/nfe', nfeRoutes);

export default router;
