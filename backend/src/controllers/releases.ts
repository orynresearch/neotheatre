import { Request, Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { StorageService } from '../services/storage';

export async function listReleases(req: Request, res: Response): Promise<void> {
  try {
    const result = await db.query(
      `SELECT r.id, r.artist_name, r.title, r.description, r.cover_art_url, 
              r.price_usd, r.uploaded_by_email, r.created_at,
              COUNT(t.id) as track_count
       FROM releases r
       LEFT JOIN tracks t ON t.release_id = r.id
       WHERE r.dmca_taken_down = FALSE
       GROUP BY r.id, r.artist_name, r.title, r.description, r.cover_art_url, 
                r.price_usd, r.uploaded_by_email, r.created_at
       ORDER BY r.created_at DESC`
    );

    // Attach available formats for each release
    const releasesWithFormats = await Promise.all(
      result.rows.map(async (rel) => {
        const tracks = await db.query('SELECT id FROM tracks WHERE release_id = $1 LIMIT 1', [rel.id]);
        let availableFormats: string[] = ['flac', 'wav', 'stereo', 'iamf'];
        if (tracks.rows.length > 0) {
          const diskFormats = StorageService.getAvailableFormatsForTrack(rel.id, tracks.rows[0].id);
          if (diskFormats.length > 0) {
            availableFormats = diskFormats;
          }
        }
        return {
          ...rel,
          formats: availableFormats,
        };
      })
    );

    res.json({ releases: releasesWithFormats });
  } catch (err: any) {
    console.error('List releases error:', err);
    res.status(500).json({ error: 'Failed to retrieve releases' });
  }
}

export async function getReleaseDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = String(req.params.id);

  try {
    const releaseRes = await db.query('SELECT * FROM releases WHERE id = $1', [id]);
    if (releaseRes.rows.length === 0) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }

    const release = releaseRes.rows[0];
    if (release.dmca_taken_down) {
      res.status(410).json({ error: 'Release taken down due to DMCA notice' });
      return;
    }

    const tracksRes = await db.query(
      'SELECT id, title, duration_seconds, track_number FROM tracks WHERE release_id = $1 ORDER BY track_number ASC',
      [id]
    );

    // Check formats for tracks
    const tracks = tracksRes.rows.map((trk) => {
      const formats = StorageService.getAvailableFormatsForTrack(id, trk.id);
      return {
        ...trk,
        formats: formats.length > 0 ? formats : ['flac', 'wav', 'stereo', 'iamf'],
      };
    });

    // Check if authenticated user owns this release
    let isPurchased = false;
    if (req.user) {
      const purchaseRes = await db.query('SELECT id FROM purchases WHERE user_id = $1 AND release_id = $2', [
        req.user.sub,
        id,
      ]);
      isPurchased = purchaseRes.rows.length > 0;
    }

    res.json({
      release: {
        ...release,
        tracks,
        isPurchased,
      },
    });
  } catch (err: any) {
    console.error('Get release detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve release' });
  }
}

export async function updateRelease(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = String(req.params.id);
  const { artist_name, title, description, price_usd } = req.body;

  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const existing = await db.query('SELECT uploaded_by_email FROM releases WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }

    if (existing.rows[0].uploaded_by_email !== req.user.email) {
      res.status(403).json({ error: 'Only the uploader can edit this release' });
      return;
    }

    await db.query(
      `UPDATE releases 
       SET artist_name = COALESCE($1, artist_name),
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           price_usd = COALESCE($4, price_usd),
           updated_at = NOW()
       WHERE id = $5`,
      [artist_name, title, description, price_usd, id]
    );

    res.json({ message: 'Release updated successfully' });
  } catch (err: any) {
    console.error('Update release error:', err);
    res.status(500).json({ error: 'Failed to update release' });
  }
}

export async function deleteRelease(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = String(req.params.id);
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const existing = await db.query('SELECT uploaded_by_email FROM releases WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }

    if (existing.rows[0].uploaded_by_email !== req.user.email) {
      res.status(403).json({ error: 'Only the uploader can delete this release' });
      return;
    }

    await db.query('DELETE FROM releases WHERE id = $1', [id]);
    res.json({ message: 'Release deleted successfully' });
  } catch (err: any) {
    console.error('Delete release error:', err);
    res.status(500).json({ error: 'Failed to delete release' });
  }
}
