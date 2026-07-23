import { Router } from 'express';
import { requireSuperadminSession } from '../../middleware/superadminAuth.js';
import { requireCsrf, requireSameOrigin } from '../../lib/csrf.js';
import { overviewRouter } from './overview.js';
import { trafficRouter } from './traffic.js';
import { funnelRouter } from './funnel.js';
import { salesRouter } from './sales.js';
import { packagesRouter } from './packages.js';
import { paymentsRouter } from './payments.js';
import { analysisActivityRouter } from './analysisActivity.js';
import { healthRouter } from './health.js';
import { settingsRouter } from './settings.js';
import { auditRouter } from './audit.js';
import { exportRouter } from './export.js';

/** Every route in this router is real Superadmin data/export surface — the actual security boundary
 * (requireSuperadminSession) plus CSRF/same-origin defense-in-depth apply to all of it. Auth's own
 * login/logout/session endpoints live in a separate router (routes/admin/auth.ts, mounted at
 * /api/admin/auth) since /login itself must be reachable without a session. */
export const adminDataRouter = Router();

adminDataRouter.use(requireSameOrigin, requireSuperadminSession, requireCsrf);

adminDataRouter.use('/overview', overviewRouter);
adminDataRouter.use('/traffic', trafficRouter);
adminDataRouter.use('/funnel', funnelRouter);
adminDataRouter.use('/sales', salesRouter);
adminDataRouter.use('/packages', packagesRouter);
adminDataRouter.use('/payments', paymentsRouter);
adminDataRouter.use('/analysis-activity', analysisActivityRouter);
adminDataRouter.use('/health', healthRouter);
adminDataRouter.use('/settings', settingsRouter);
adminDataRouter.use('/audit', auditRouter);
adminDataRouter.use('/export', exportRouter);
