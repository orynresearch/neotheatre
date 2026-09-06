import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../services/storage';

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.wav';
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB
  },
});

export async function handleUpload(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Audio file is required' });
    return;
  }

  const {
    artist_name,
    title,
    description,
    price_usd,
    cover_art_url,
    track_title,
    attestation, // String 'true' or boolean
    source_format, // 'adm', 'wav', 'flac', etc.
  } = req.body;

  // Verify legal attestation
  const isAttested = attestation === 'true' || attestation === true;
  if (!isAttested) {
    // Remove staged file if attestation missing
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(400).json({
      error: 'Attestation required',
      message: 'You must attest that you own or have the necessary rights to distribute this content.',
    });
    return;
  }

  if (!artist_name || !title) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(400).json({ error: 'Artist name and release title are required' });
    return;
  }

  try {
    const releaseId = uuidv4();
    const trackId = uuidv4();
    const jobId = uuidv4();

    // 1. Insert Release with attestation metadata
    await db.query(
      `INSERT INTO releases (
        id, artist_name, title, description, cover_art_url, price_usd,
        uploaded_by_email, attested_by_email, attested_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())`,
      [
        releaseId,
        artist_name.trim(),
        title.trim(),
        description || '',
        cover_art_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        parseFloat(price_usd) || 20.0,
        req.user.email,
        req.user.email,
      ]
    );

    // 2. Insert Track
    await db.query(
      `INSERT INTO tracks (id, release_id, title, duration_seconds, track_number, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [trackId, releaseId, track_title || title, 0, 1]
    );

    // 3. Insert Conversion Job with status = 'queued' (database queue flow)
    const detectedFormat = source_format || path.extname(file.originalname).replace('.', '') || 'wav';
    await db.query(
      `INSERT INTO conversion_jobs (
        id, release_id, track_id, source_file_path, source_format, status,
        retry_count, max_retries, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'queued', 0, 3, NOW())`,
      [jobId, releaseId, trackId, file.path, detectedFormat]
    );

    res.status(201).json({
      message: 'Upload successful. Conversion job queued.',
      releaseId,
      trackId,
      jobId,
      status: 'queued',
    });
  } catch (err: any) {
    console.error('Upload processing error:', err);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: 'Failed to process release upload' });
  }
}

export async function getJobStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const jobId = String(req.params.jobId);
  try {
    const result = await db.query('SELECT * FROM conversion_jobs WHERE id = $1', [jobId]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({ job: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
}
