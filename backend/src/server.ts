import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import { register, login, getCurrentUser } from './controllers/auth';
import { listReleases, getReleaseDetail, updateRelease, deleteRelease } from './controllers/releases';
import { createPurchase, listUserPurchases, checkPurchaseStatus } from './controllers/purchases';
import { handleUpload, getJobStatus, uploadMiddleware } from './controllers/uploads';
import { downloadTrackOrRelease } from './controllers/downloads';
import { requireAuth, optionalAuth } from './middleware/auth';
import { downloadRateLimiter } from './middleware/rateLimit';
import { requireAdmin } from './middleware/adminAuth';
import {
  getAdminStats,
  listAllReleasesAdmin,
  toggleDmcaTakedown,
  lookupWatermarkLeak,
  toggleUserSuspension,
  listConversionJobsAdmin,
  retryConversionJob,
  getAuditLogAdmin,
} from './controllers/admin';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', platform: 'Neotheatre', timestamp: new Date().toISOString() });
});

// Authentication Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.get('/api/auth/me', requireAuth, getCurrentUser);

// Releases Routes
app.get('/api/releases', listReleases);
app.get('/api/releases/:id', optionalAuth, getReleaseDetail);
app.put('/api/releases/:id', requireAuth, updateRelease);
app.delete('/api/releases/:id', requireAuth, deleteRelease);

// Purchases Routes
app.post('/api/purchases', requireAuth, createPurchase);
app.get('/api/purchases', requireAuth, listUserPurchases);
app.get('/api/purchases/:releaseId', requireAuth, checkPurchaseStatus);

// Uploads Routes
app.post('/api/uploads', requireAuth, uploadMiddleware.single('audio'), handleUpload);
app.get('/api/uploads/jobs/:jobId', requireAuth, getJobStatus);

// Downloads (Gated + Rate Limited to 1 per 10s per user/IP)
app.get(
  '/api/downloads/:releaseId/:format',
  requireAuth,
  downloadRateLimiter(10, 1),
  downloadTrackOrRelease
);
app.get(
  '/api/downloads/:releaseId/:trackId/:format',
  requireAuth,
  downloadRateLimiter(10, 1),
  downloadTrackOrRelease
);

// Admin / Owner Portal Routes
app.get('/api/admin/stats', requireAuth, requireAdmin, getAdminStats);
app.get('/api/admin/releases', requireAuth, requireAdmin, listAllReleasesAdmin);
app.post('/api/admin/releases/:id/takedown', requireAuth, requireAdmin, toggleDmcaTakedown);
app.get('/api/admin/leaks/lookup', requireAuth, requireAdmin, lookupWatermarkLeak);
app.post('/api/admin/users/:userId/suspend', requireAuth, requireAdmin, toggleUserSuspension);
app.get('/api/admin/jobs', requireAuth, requireAdmin, listConversionJobsAdmin);
app.post('/api/admin/jobs/:id/retry', requireAuth, requireAdmin, retryConversionJob);
app.get('/api/admin/audit-log', requireAuth, requireAdmin, getAuditLogAdmin);

// Serve Frontend Static Build
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🎵 Neotheatre API Server listening on port ${PORT}`);
  });
}

export default app;
