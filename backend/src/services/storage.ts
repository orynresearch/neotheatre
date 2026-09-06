import path from 'path';
import fs from 'fs';

export const STORAGE_ROOT = path.resolve(__dirname, '../../../storage');
export const RELEASES_DIR = path.join(STORAGE_ROOT, 'releases');
export const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads');

// Ensure base directories exist
if (!fs.existsSync(RELEASES_DIR)) fs.mkdirSync(RELEASES_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const FORMAT_FILE_MAP: Record<string, { filename: string; mimeType: string }> = {
  flac: { filename: 'hires-flac.flac', mimeType: 'audio/flac' },
  wav: { filename: 'hires-wav.wav', mimeType: 'audio/wav' },
  stereo: { filename: 'stereo.flac', mimeType: 'audio/flac' },
  iamf: { filename: 'converted.iamf', mimeType: 'audio/iamf' },
  'atmos-dd': { filename: 'atmos-dd.ec3', mimeType: 'audio/eac3' },
  'atmos-thd': { filename: 'atmos-thd.thd', mimeType: 'audio/vnd.dolby.mlp' },
};

export class StorageService {
  static getTrackFormatPath(releaseId: string, trackId: string, format: string): string | null {
    const formatInfo = FORMAT_FILE_MAP[format.toLowerCase()];
    if (!formatInfo) return null;

    const filePath = path.join(RELEASES_DIR, releaseId, trackId, formatInfo.filename);
    return filePath;
  }

  static getAvailableFormatsForTrack(releaseId: string, trackId: string): string[] {
    const trackDir = path.join(RELEASES_DIR, releaseId, trackId);
    if (!fs.existsSync(trackDir)) return [];

    const available: string[] = [];
    for (const [fmt, info] of Object.entries(FORMAT_FILE_MAP)) {
      const fullPath = path.join(trackDir, info.filename);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
        available.push(fmt);
      }
    }
    return available;
  }

  static getUploadStagePath(uploadId: string, extension: string = '.wav'): string {
    return path.join(UPLOADS_DIR, `${uploadId}${extension}`);
  }
}
