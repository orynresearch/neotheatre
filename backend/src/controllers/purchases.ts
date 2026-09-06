import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { StorageService } from '../services/storage';

export async function createPurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { releaseId } = req.body;
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!releaseId) {
    res.status(400).json({ error: 'releaseId is required' });
    return;
  }

  try {
    // Check release existence and price
    const releaseRes = await db.query('SELECT id, price_usd, title, dmca_taken_down FROM releases WHERE id = $1', [
      releaseId,
    ]);
    if (releaseRes.rows.length === 0) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }
    const release = releaseRes.rows[0];
    if (release.dmca_taken_down) {
      res.status(410).json({ error: 'Release is no longer available for purchase' });
      return;
    }

    // Check if already purchased
    const existing = await db.query('SELECT * FROM purchases WHERE user_id = $1 AND release_id = $2', [
      req.user.sub,
      releaseId,
    ]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Release already purchased', purchase: existing.rows[0] });
      return;
    }

    // Process payment stub
    const purchaseId = uuidv4();
    const paymentId = `stub_pay_${Date.now()}`;
    const amountPaid = release.price_usd || 20.0;

    await db.query(
      `INSERT INTO purchases (id, user_id, release_id, purchased_at, payment_id, amount_paid)
       VALUES ($1, $2, $3, NOW(), $4, $5)`,
      [purchaseId, req.user.sub, releaseId, paymentId, amountPaid]
    );

    res.status(201).json({
      message: 'Purchase successful',
      purchase: {
        id: purchaseId,
        user_id: req.user.sub,
        release_id: releaseId,
        payment_id: paymentId,
        amount_paid: amountPaid,
      },
    });
  } catch (err: any) {
    console.error('Create purchase error:', err);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
}

export async function listUserPurchases(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await db.query(
      `SELECT p.id as purchase_id, p.purchased_at, p.amount_paid,
              r.id as release_id, r.title, r.artist_name, r.cover_art_url, r.description
       FROM purchases p
       JOIN releases r ON p.release_id = r.id
       WHERE p.user_id = $1
       ORDER BY p.purchased_at DESC`,
      [req.user.sub]
    );

    // Attach tracks & format options for each purchased album
    const library = await Promise.all(
      result.rows.map(async (item) => {
        const tracksRes = await db.query(
          'SELECT id, title, duration_seconds, track_number FROM tracks WHERE release_id = $1 ORDER BY track_number ASC',
          [item.release_id]
        );

        const tracks = tracksRes.rows.map((trk) => {
          const formats = StorageService.getAvailableFormatsForTrack(item.release_id, trk.id);
          return {
            ...trk,
            formats: formats.length > 0 ? formats : ['flac', 'wav', 'stereo', 'iamf'],
          };
        });

        // Query user's past download history for this release
        const downloadsRes = await db.query(
          `SELECT d.id, d.format, d.downloaded_at, d.ip_address, d.watermark_id, t.title as track_title
           FROM downloads d
           LEFT JOIN tracks t ON d.track_id = t.id
           WHERE d.user_id = $1 AND d.release_id = $2
           ORDER BY d.downloaded_at DESC`,
          [req.user?.sub, item.release_id]
        );

        return {
          ...item,
          tracks,
          downloadHistory: downloadsRes.rows,
        };
      })
    );

    res.json({ library });
  } catch (err: any) {
    console.error('List purchases error:', err);
    res.status(500).json({ error: 'Failed to retrieve library' });
  }
}

export async function checkPurchaseStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const releaseId = String(req.params.releaseId);
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await db.query('SELECT * FROM purchases WHERE user_id = $1 AND release_id = $2', [
      req.user.sub,
      releaseId,
    ]);
    res.json({ purchased: result.rows.length > 0 });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify purchase status' });
  }
}
