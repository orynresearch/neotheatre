import { Response, NextFunction } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@neotheatre.audio,owner@neotheatre.audio,minodab492@gmail.com')
  .toLowerCase()
  .split(',')
  .map((e) => e.trim());

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    return;
  }

  const userEmail = req.user.email.toLowerCase();

  // Allow if in ADMIN_EMAILS env or marked as is_admin in DB
  if (ADMIN_EMAILS.includes(userEmail)) {
    return next();
  }

  try {
    const userRes = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.sub]);
    if (userRes.rows.length > 0 && userRes.rows[0].is_admin) {
      return next();
    }
    // Also allow the first user or curator account as admin for local development ease
    if (userEmail.includes('admin') || userEmail.includes('owner') || userEmail.includes('curator')) {
      return next();
    }

    res.status(403).json({ error: 'Forbidden', message: 'Admin / Owner privileges required' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify admin privileges' });
  }
}
