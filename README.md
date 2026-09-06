# Neotheatre 🎵

**Neotheatre** is a DRM-free high-bitrate music distribution platform supporting IAMF (Immersive Audio Model and Formats), Dolby Atmos, and studio-grade 24-bit/96kHz Lossless audio (FLAC/WAV). Download access is gated through authenticated purchases and backed by an immutable download audit trail compliant with Universal Music Group (UMG) licensing requirements.

---

## Key Features

1. **Native `libiamf` C Library Integration**:
   - Built from source from `AOMediaCodec/libiamf` using CMake.
   - High-performance Python ctypes wrapper (`processor/iamf_wrapper.py`).
   - Automated conversion from ADM (Audio Definition Model) BWF stems into standardized `.iamf` bitstreams.

2. **Database-Driven Job Queue**:
   - Status flow: `queued` $\rightarrow$ `claimed` $\rightarrow$ `processing` $\rightarrow$ `completed` (or `failed`).
   - Worker claims jobs atomically (`SELECT ... FOR UPDATE SKIP LOCKED`), preventing race conditions without needing external Redis.

3. **Mandatory Legal Attestation**:
   - Uploads require an explicit copyright/distribution rights attestation checkbox.
   - Records `attested_by_email` and `attested_at` for DMCA compliance.

4. **Anti-Scraping Rate Limiting**:
   - `downloadRateLimiter(10, 1)` restricts downloads to 1 request per 10 seconds per user/IP.
   - Enforces `429 Too Many Requests` with `Retry-After: 10`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

5. **Gated Downloads & UMG Forensic Audit Trail**:
   - Strict verification sequence: JWT Auth $\rightarrow$ Purchase Verification $\rightarrow$ File Existence $\rightarrow$ Forensic Watermark & Download Audit Logging $\rightarrow$ File Streaming.

6. **Full-Featured React Frontend**:
   - Public browse & search with format badges.
   - Release detail view with multi-channel stems tracklist.
   - Artist Ingestion Studio with live conversion progress monitor.
   - User Library with re-download history ledger and forensic watermark provenance.

---

## Directory Structure

```
neotheatre/
├── backend/                  # Node.js Express & TypeScript API server
│   ├── src/
│   │   ├── config/           # Database driver (PostgreSQL & SQLite WAL fallback)
│   │   ├── controllers/      # Auth, Releases, Purchases, Uploads, Downloads
│   │   ├── middleware/       # JWT auth & 10s download rate limiter
│   │   ├── services/         # Storage path resolver & format map
│   │   ├── server.ts         # Express entrypoint & static frontend host
│   │   ├── seed.ts           # Demo catalog seeder (AJR, Elio Mei)
│   │   └── test_e2e.ts       # Full integration test suite
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # React 18+ (Vite + Tailwind CSS + Lucide)
│   ├── src/
│   │   ├── components/       # Navbar, FormatBadge
│   │   ├── context/          # AuthContext (JWT state)
│   │   ├── pages/            # Browse, ReleaseDetail, Upload, Library, Login, Register
│   │   └── services/         # Axios API client
│   ├── package.json
│   └── vite.config.ts
├── processor/                # Python Audio Processing Engine
│   ├── libiamf.dylib         # Compiled AOMediaCodec libiamf shared library
│   ├── iamf_wrapper.py       # Python ctypes dynamic binding for libiamf
│   ├── converter.py          # Master audio converter (FFmpeg FLAC/WAV + IAMF)
│   ├── worker.py             # Database queue poller with atomic job claiming
│   └── vendor/libiamf/       # libiamf source repository & CMake build tree
├── storage/                  # Local filesystem storage (swappable with Cloudflare R2)
│   ├── releases/             # {release_id}/{track_id}/[formats]
│   └── uploads/              # Temporary staging area
├── database/
│   └── schema.sql            # PostgreSQL / SQLite database schema
└── start.sh                  # One-click startup script
```

---

## Getting Started

### 1. Launch Platform
```bash
./start.sh
```
This runs the Python database queue worker and starts the Node.js API server on **`http://localhost:4000`** (which also serves the React frontend).

For live Vite frontend hot-reloading during development:
```bash
cd frontend && npm run dev
# Open http://localhost:3000
```

### 2. Run Verification Suite
```bash
cd backend && NODE_ENV=test node dist/test_e2e.js
```
The test suite validates:
- [x] `libiamf` builds and loads via ctypes.
- [x] Worker process starts and polls database without errors.
- [x] Upload creates queued job, worker claims and processes it.
- [x] Download endpoint: unauthenticated $\rightarrow$ 401, not purchased $\rightarrow$ 403, purchased $\rightarrow$ 200 + audit log.
- [x] Rate limiter: 1 download succeeds, 2nd within 10 seconds $\rightarrow$ 429.
- [x] Attestation checkbox blocks upload until checked.
- [x] Files stored in correct directory structure.
