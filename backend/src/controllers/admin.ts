import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getAdminStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users');
    const releasesCount = await db.query('SELECT COUNT(*) as count FROM releases');
    const purchasesCount = await db.query('SELECT COUNT(*) as count, COALESCE(SUM(amount_paid), 0) as total_revenue FROM purchases');
    const downloadsCount = await db.query('SELECT COUNT(*) as count FROM downloads');
    const jobsCount = await db.query("SELECT COUNT(*) as count FROM conversion_jobs WHERE status IN ('queued', 'claimed', 'processing')");

    res.json({
      stats: {
        totalUsers: Number(usersCount.rows[0]?.count || 0),
        totalReleases: Number(releasesCount.rows[0]?.count || 0),
        totalPurchases: Number(purchasesCount.rows[0]?.count || 0),
        totalRevenue: Number(purchasesCount.rows[0]?.total_revenue || 0),
        totalDownloads: Number(downloadsCount.rows[0]?.count || 0),
        activeJobs: Number(jobsCount.rows[0]?.count || 0),
      },
    });
  } catch (err: any) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to compute admin metrics' });
  }
}

export async function listAllReleasesAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const releasesRes = await db.query(
      `SELECT r.*, COUNT(t.id) as track_count,
              (SELECT COUNT(*) FROM downloads d WHERE d.release_id = r.id) as download_count,
              (SELECT COUNT(*) FROM purchases p WHERE p.release_id = r.id) as purchase_count
       FROM releases r
       LEFT JOIN tracks t ON t.release_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`
    );

    res.json({ releases: releasesRes.rows });
  } catch (err: any) {
    console.error('Admin releases error:', err);
    res.status(500).json({ error: 'Failed to list releases' });
  }
}

export async function toggleDmcaTakedown(req: AuthenticatedRequest, res: Response): Promise<void> {
  const releaseId = String(req.params.id);
  const { takenDown } = req.body;

  try {
    await db.query(
      'UPDATE releases SET dmca_taken_down = $1, dmca_notified = TRUE, updated_at = NOW() WHERE id = $2',
      [Boolean(takenDown), releaseId]
    );

    res.json({
      message: takenDown ? 'Release taken down under DMCA' : 'Release restored to public catalog',
      releaseId,
      dmca_taken_down: Boolean(takenDown),
    });
  } catch (err: any) {
    console.error('DMCA takedown error:', err);
    res.status(500).json({ error: 'Failed to update DMCA status' });
  }
}

export async function lookupWatermarkLeak(req: AuthenticatedRequest, res: Response): Promise<void> {
  const watermarkId = String(req.query.watermark_id || '').trim();
  if (!watermarkId) {
    res.status(400).json({ error: 'watermark_id query parameter is required' });
    return;
  }

  try {
    const logRes = await db.query(
      `SELECT d.*, u.email as user_email, u.is_suspended, u.created_at as user_joined,
              r.title as release_title, r.artist_name, t.title as track_title
       FROM downloads d
       JOIN users u ON d.user_id = u.id
       JOIN releases r ON d.release_id = r.id
       LEFT JOIN tracks t ON d.track_id = t.id
       WHERE d.watermark_id = $1`,
      [watermarkId]
    );

    if (logRes.rows.length === 0) {
      res.status(404).json({ error: 'No matching download record found for this watermark ID' });
      return;
    }

    const match = logRes.rows[0];

    // Also get all other files downloaded by this user (to check if they leaked more)
    const otherDownloads = await db.query(
      `SELECT d.format, d.downloaded_at, d.watermark_id, r.title as release_title, t.title as track_title
       FROM downloads d
       JOIN releases r ON d.release_id = r.id
       LEFT JOIN tracks t ON d.track_id = t.id
       WHERE d.user_id = $1 AND d.watermark_id != $2
       ORDER BY d.downloaded_at DESC
       LIMIT 10`,
      [match.user_id, watermarkId]
    );

    res.json({
      match,
      culpritUser: {
        id: match.user_id,
        email: match.user_email,
        is_suspended: match.is_suspended,
        joined_at: match.user_joined,
      },
      otherDownloads: otherDownloads.rows,
    });
  } catch (err: any) {
    console.error('Leak lookup error:', err);
    res.status(500).json({ error: 'Failed to query watermark log' });
  }
}

export async function toggleUserSuspension(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = String(req.params.userId);
  const { isSuspended } = req.body;

  try {
    await db.query('UPDATE users SET is_suspended = $1, updated_at = NOW() WHERE id = $2', [
      Boolean(isSuspended),
      userId,
    ]);

    res.json({
      message: isSuspended ? 'User account suspended immediately' : 'User account restored',
      userId,
      is_suspended: Boolean(isSuspended),
    });
  } catch (err: any) {
    console.error('User suspension error:', err);
    res.status(500).json({ error: 'Failed to update user suspension status' });
  }
}

export async function listConversionJobsAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const jobsRes = await db.query(
      `SELECT j.*, r.title as release_title, r.artist_name, t.title as track_title
       FROM conversion_jobs j
       LEFT JOIN releases r ON j.release_id = r.id
       LEFT JOIN tracks t ON j.track_id = t.id
       ORDER BY j.created_at DESC
       LIMIT 50`
    );

    res.json({ jobs: jobsRes.rows });
  } catch (err: any) {
    console.error('Admin jobs error:', err);
    res.status(500).json({ error: 'Failed to list conversion jobs' });
  }
}

export async function retryConversionJob(req: AuthenticatedRequest, res: Response): Promise<void> {
  const jobId = String(req.params.id);

  try {
    await db.query(
      "UPDATE conversion_jobs SET status = 'queued', error_message = NULL, claimed_by = NULL, claimed_at = NULL, started_at = NULL WHERE id = $1",
      [jobId]
    );

    res.json({ message: 'Conversion job re-queued for processing', jobId });
  } catch (err: any) {
    console.error('Retry job error:', err);
    res.status(500).json({ error: 'Failed to retry job' });
  }
}

export async function getAuditLogAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const auditRes = await db.query(
      `SELECT d.*, u.email as user_email, r.title as release_title, t.title as track_title
       FROM downloads d
       JOIN users u ON d.user_id = u.id
       JOIN releases r ON d.release_id = r.id
       LEFT JOIN tracks t ON d.track_id = t.id
       ORDER BY d.downloaded_at DESC
       LIMIT 100`
    );

    res.json({ auditLog: auditRes.rows });
  } catch (err: any) {
    console.error('Audit log error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
}
