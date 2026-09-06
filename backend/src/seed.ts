import { v4 as uuidv4 } from 'uuid';
import { db } from './config/db';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

async function seed() {
  console.log('Seeding Neotheatre demo releases...');

  const releases = [
    {
      artist_name: 'AJR',
      title: 'The Maybe Man (Deluxe Immersive)',
      description: 'The complete studio album featuring spatial audio mix, ADM BWF stems, and 24-bit 96kHz lossless masters.',
      cover_art_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
      price_usd: 25.00,
      tracks: [
        { title: 'Maybe Man', duration_seconds: 220, track_number: 1 },
        { title: 'Touchy Feely Fool', duration_seconds: 215, track_number: 2 },
        { title: 'Yes I\'m a Mess', duration_seconds: 175, track_number: 3 },
      ],
    },
    {
      artist_name: 'Elio Mei',
      title: 'Midnight Echoes',
      description: 'Atmospheric ambient and electronic compositions rendered in native IAMF and Dolby Atmos.',
      cover_art_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
      price_usd: 18.00,
      tracks: [
        { title: 'Solitude in Neon', duration_seconds: 290, track_number: 1 },
        { title: 'Celestial Horizon', duration_seconds: 340, track_number: 2 },
      ],
    },
  ];

  for (const rel of releases) {
    // Check if exists
    const existing = await db.query('SELECT id FROM releases WHERE title = $1', [rel.title]);
    if (existing.rows.length > 0) continue;

    const releaseId = uuidv4();
    await db.query(
      `INSERT INTO releases (
        id, artist_name, title, description, cover_art_url, price_usd,
        uploaded_by_email, attested_by_email, attested_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'curator@neotheatre.audio', 'curator@neotheatre.audio', NOW(), NOW())`,
      [releaseId, rel.artist_name, rel.title, rel.description, rel.cover_art_url, rel.price_usd]
    );

    for (const trk of rel.tracks) {
      const trackId = uuidv4();
      await db.query(
        `INSERT INTO tracks (id, release_id, title, duration_seconds, track_number, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [trackId, releaseId, trk.title, trk.duration_seconds, trk.track_number]
      );

      // Generate demo audio files on disk
      const trackDir = path.resolve(__dirname, `../../storage/releases/${releaseId}/${trackId}`);
      fs.mkdirSync(trackDir, { recursive: true });

      const sampleWav = path.join(trackDir, 'hires-wav.wav');
      const sampleFlac = path.join(trackDir, 'hires-flac.flac');
      const sampleStereo = path.join(trackDir, 'stereo.flac');
      const sampleIamf = path.join(trackDir, 'converted.iamf');
      const sampleAtmos = path.join(trackDir, 'atmos-dd.ec3');

      try {
        execSync(`ffmpeg -y -f lavfi -i "sine=frequency=440:duration=2" -c:a pcm_s24le "${sampleWav}" 2>/dev/null`);
        execSync(`ffmpeg -y -i "${sampleWav}" -c:a flac -sample_fmt s32 -ar 96000 "${sampleFlac}" 2>/dev/null`);
        execSync(`ffmpeg -y -i "${sampleWav}" -ac 2 -c:a flac "${sampleStereo}" 2>/dev/null`);
        execSync(`ffmpeg -y -i "${sampleWav}" -c:a eac3 "${sampleAtmos}" 2>/dev/null`);
        fs.writeFileSync(sampleIamf, Buffer.concat([Buffer.from('\x1fIAMF\x01\x00'), fs.readFileSync(sampleWav)]));
      } catch (err) {
        console.warn('Could not generate sample files:', err);
      }
    }
    console.log(`Seeded release: ${rel.title} (${releaseId})`);
  }

  console.log('✅ Demo releases seeded successfully!');
}

seed().catch(console.error);
