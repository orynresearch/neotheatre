-- Neotheatre Database Schema

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_suspended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Releases Table
CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  cover_art_url VARCHAR(512),
  price_usd DECIMAL(6, 2) NOT NULL DEFAULT 20.00,
  uploaded_by_email VARCHAR(255) NOT NULL,
  attested_by_email VARCHAR(255),
  attested_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  dmca_notified BOOLEAN DEFAULT FALSE,
  dmca_taken_down BOOLEAN DEFAULT FALSE
);

-- Tracks Table
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  duration_seconds INT DEFAULT 0,
  track_number INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  payment_id VARCHAR(255),
  amount_paid DECIMAL(6, 2) DEFAULT 20.00,
  UNIQUE(user_id, release_id)
);

-- Downloads Audit Log Table (UMG Licensing & Forensic Traceability)
CREATE TABLE IF NOT EXISTS downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  release_id UUID NOT NULL REFERENCES releases(id),
  track_id UUID REFERENCES tracks(id),
  format VARCHAR(50) NOT NULL, -- 'iamf', 'atmos-dd', 'atmos-thd', 'flac', 'wav', 'stereo'
  downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  watermark_id VARCHAR(255)
);

-- Conversion Jobs Queue Table (Database-driven job queue)
CREATE TABLE IF NOT EXISTS conversion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  source_file_path VARCHAR(512) NOT NULL,
  source_format VARCHAR(50) NOT NULL, -- 'adm', 'atmos-bitstream', 'wav', 'flac'
  status VARCHAR(50) NOT NULL DEFAULT 'queued', -- 'queued', 'claimed', 'processing', 'completed', 'failed'
  output_formats TEXT, -- JSON or comma-separated list of generated formats
  claimed_by VARCHAR(255),
  claimed_at TIMESTAMP,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance & Queue Indexes
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_status ON conversion_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_user_release ON purchases(user_id, release_id);
CREATE INDEX IF NOT EXISTS idx_downloads_user ON downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_downloads_watermark ON downloads(watermark_id);
CREATE INDEX IF NOT EXISTS idx_tracks_release ON tracks(release_id);
