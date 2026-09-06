import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { StorageService, FORMAT_FILE_MAP } from '../services/storage';

export async function downloadTrackOrRelease(req: AuthenticatedRequest, res: Response): Promise<void> {
  const releaseId = String(req.params.releaseId);
  const format = String(req.params.format);
  let trackId = req.params.trackId ? String(req.params.trackId) : '';

  // 1. Verify JWT (handled by requireAuth, check req.user)
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    return;
  }
  const userId = req.user.sub;

  // If trackId not specified in route, resolve first track of the release
  if (!trackId) {
    const trackRes = await db.query(
      'SELECT id FROM tracks WHERE release_id = $1 ORDER BY track_number ASC LIMIT 1',
      [releaseId]
    );
    if (trackRes.rows.length === 0) {
      res.status(404).json({ error: 'No tracks found for this release' });
      return;
    }
    trackId = trackRes.rows[0].id;
  }

  try {
    // 2. Check purchase: SELECT * FROM purchases WHERE user_id = $1 AND release_id = $2
    const purchaseRes = await db.query('SELECT * FROM purchases WHERE user_id = $1 AND release_id = $2', [
      userId,
      releaseId,
    ]);
    if (purchaseRes.rows.length === 0) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied. You must purchase this release before downloading files.',
      });
      return;
    }

    // 3. Determine file path for requested format
    const formatLower = format.toLowerCase();
    const formatInfo = FORMAT_FILE_MAP[formatLower];
    if (!formatInfo) {
      res.status(400).json({
        error: 'Invalid format',
        message: `Unsupported format '${format}'. Valid options: ${Object.keys(FORMAT_FILE_MAP).join(', ')}`,
      });
      return;
    }

    const filePath = StorageService.getTrackFormatPath(releaseId, trackId, formatLower);
    if (!filePath) {
      res.status(404).json({ error: 'Format path unavailable' });
      return;
    }

    // 4. Verify file exists on disk
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      res.status(404).json({
        error: 'Format not available',
        message: `The requested format '${format}' is currently not available for this track.`,
      });
      return;
    }

    // Fetch release and track titles for clean filename
    const relInfo = await db.query(
      'SELECT r.title as release_title, r.artist_name, t.title as track_title FROM releases r JOIN tracks t ON t.id = $1 WHERE r.id = $2',
      [trackId, releaseId]
    );
    const releaseTitle = relInfo.rows[0]?.release_title || 'Release';
    const artistName = relInfo.rows[0]?.artist_name || 'Artist';
    const trackTitle = relInfo.rows[0]?.track_title || 'Track';

    // 5. Log to audit trail (downloads table)
    const downloadId = uuidv4();
    const watermarkId = `wm_${uuidv4()}`;
    const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').toString();
    const userAgent = req.headers['user-agent'] || 'unknown';

    await db.query(
      `INSERT INTO downloads (
        id, user_id, release_id, track_id, format, downloaded_at, ip_address, user_agent, watermark_id
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)`,
      [downloadId, userId, releaseId, trackId, formatLower, clientIp, userAgent, watermarkId]
    );

    // 6. Serve the file with proper Content-Disposition header
    const sanitizedFilename = `${artistName} - ${trackTitle} [${formatLower.toUpperCase()}]${path.extname(filePath)}`
      .replace(/[^\w\s.-]/gi, '_');

    res.setHeader('Content-Type', formatInfo.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    res.setHeader('X-Neotheatre-Watermark', watermarkId);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err: any) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to process file download' });
  }
}
