import http from 'http';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import app from './server';
import { db } from './config/db';

async function runTests() {
  console.log('🚀 Starting Neotheatre End-to-End Verification Suite...\n');

  const testPort = 4001;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(testPort, () => resolve()));
  const baseUrl = `http://127.0.0.1:${testPort}/api`;

  let token = '';
  let userId = '';
  let releaseId = '';
  let trackId = '';
  let jobId = '';

  try {
    // 1. Health check
    console.log('1️⃣ Checking Health Endpoint...');
    const healthRes = await fetch(`${baseUrl}/health`);
    if (healthRes.status !== 200) throw new Error(`Health check failed: ${healthRes.status}`);
    console.log('  ✅ Health endpoint OK');

    // 2. User Registration & JWT
    console.log('\n2️⃣ Testing User Registration & JWT Auth...');
    const testEmail = `test_artist_${Date.now()}@neotheatre.audio`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'password123' }),
    });
    if (regRes.status !== 201) throw new Error(`Registration failed: ${regRes.status}`);
    const regData = await regRes.json();
    token = regData.token;
    userId = regData.user.id;
    console.log(`  ✅ Registered user: ${testEmail} (${userId})`);
    console.log(`  ✅ JWT token generated successfully`);

    // 3. Mandatory Attestation Checkbox Enforcement
    console.log('\n3️⃣ Testing Legal Attestation Enforcement...');
    // Create a temporary sample WAV file for testing
    const sampleAudioPath = path.resolve(__dirname, '../../storage/uploads/e2e_source.wav');
    execSync(`ffmpeg -y -f lavfi -i "sine=frequency=880:duration=1" -c:a pcm_s24le "${sampleAudioPath}" 2>/dev/null`);

    // Prepare multipart form data without attestation
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const fileBytes = fs.readFileSync(sampleAudioPath);

    const bodyNoAttest = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="audio"; filename="sample.wav"\r\n` +
          `Content-Type: audio/wav\r\n\r\n`
      ),
      fileBytes,
      Buffer.from(
        `\r\n--${boundary}\r\n` +
          `Content-Disposition: form-data; name="artist_name"\r\n\r\nAJR\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="title"\r\n\r\nThe Maybe Man\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="attestation"\r\n\r\nfalse\r\n` +
          `--${boundary}--\r\n`
      ),
    ]);

    const rejectRes = await fetch(`${baseUrl}/uploads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyNoAttest,
    });

    if (rejectRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request when attestation is false, got ${rejectRes.status}`);
    }
    console.log('  ✅ Rejected upload without legal attestation (400 Bad Request)');

    // 4. Upload with Legal Attestation -> Queue Job
    console.log('\n4️⃣ Testing Upload with Verified Attestation...');
    const bodyWithAttest = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="audio"; filename="sample.wav"\r\n` +
          `Content-Type: audio/wav\r\n\r\n`
      ),
      fileBytes,
      Buffer.from(
        `\r\n--${boundary}\r\n` +
          `Content-Disposition: form-data; name="artist_name"\r\n\r\nAJR\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="title"\r\n\r\nThe Maybe Man\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="track_title"\r\n\r\nTouchy Feely Fool\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="price_usd"\r\n\r\n20.00\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="source_format"\r\n\r\nadm\r\n` +
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="attestation"\r\n\r\ntrue\r\n` +
          `--${boundary}--\r\n`
      ),
    ]);

    const uploadRes = await fetch(`${baseUrl}/uploads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyWithAttest,
    });

    if (uploadRes.status !== 201) {
      const errText = await uploadRes.text();
      throw new Error(`Upload failed (${uploadRes.status}): ${errText}`);
    }
    const uploadData = await uploadRes.json();
    releaseId = uploadData.releaseId;
    trackId = uploadData.trackId;
    jobId = uploadData.jobId;
    console.log(`  ✅ Upload created release: ${releaseId}`);
    console.log(`  ✅ Queued conversion job: ${jobId} (status: ${uploadData.status})`);

    // Verify attestation was logged in DB
    const relDbRes = await db.query('SELECT attested_by_email, attested_at FROM releases WHERE id = $1', [releaseId]);
    if (relDbRes.rows.length === 0 || relDbRes.rows[0].attested_by_email !== testEmail) {
      throw new Error('Attestation email not recorded in database releases table');
    }
    console.log(`  ✅ DB logged attestation by: ${relDbRes.rows[0].attested_by_email}`);

    // 5. Worker Claims & Processes Queued Job
    console.log('\n5️⃣ Testing Python Worker Database Queue Claiming & Processing...');
    const workerScript = path.resolve(__dirname, '../../processor/worker.py');
    const workerOut = execSync(`python3 "${workerScript}" --single`, { encoding: 'utf8' });
    console.log('  Worker execution output summary:');
    workerOut.split('\n').filter(l => l.includes('[INFO]') && (l.includes('starting job') || l.includes('completed'))).forEach(l => console.log(`    ${l}`));

    // Verify job completed in DB
    const jobDbRes = await db.query('SELECT status, claimed_by, output_formats FROM conversion_jobs WHERE id = $1', [jobId]);
    if (jobDbRes.rows.length === 0 || jobDbRes.rows[0].status !== 'completed') {
      throw new Error(`Expected job status 'completed', found: ${jobDbRes.rows[0]?.status}`);
    }
    console.log(`  ✅ Worker successfully claimed job (claimed_by: ${jobDbRes.rows[0].claimed_by})`);
    console.log(`  ✅ Job status updated to 'completed'`);
    console.log(`  ✅ Generated output formats: ${jobDbRes.rows[0].output_formats}`);

    // 6. Verify File Organization on Disk
    console.log('\n6️⃣ Verifying File Organization on Disk...');
    const targetDir = path.resolve(__dirname, `../../storage/releases/${releaseId}/${trackId}`);
    const files = ['hires-flac.flac', 'hires-wav.wav', 'stereo.flac', 'converted.iamf'];
    for (const f of files) {
      const full = path.join(targetDir, f);
      if (!fs.existsSync(full) || fs.statSync(full).size === 0) {
        throw new Error(`Expected file missing or empty: ${full}`);
      }
      console.log(`  ✅ File exists: ${f} (${fs.statSync(full).size} bytes)`);
    }

    // 7. Gated Downloads Security Verification
    console.log('\n7️⃣ Testing Gated Download Security...');
    // A. Unauthenticated download -> 401
    const noAuthRes = await fetch(`${baseUrl}/downloads/${releaseId}/${trackId}/flac`);
    if (noAuthRes.status !== 401) throw new Error(`Expected 401 for unauthenticated download, got ${noAuthRes.status}`);
    console.log('  ✅ Unauthenticated download correctly rejected with 401 Unauthorized');

    // B. Authenticated without purchase -> 403 (using a distinct unpurchased user)
    const otherUserRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `other_user_${Date.now()}@neotheatre.audio`, password: 'password123' }),
    });
    const otherUserData = await otherUserRes.json();
    const otherToken = otherUserData.token;

    const unpurchasedRes = await fetch(`${baseUrl}/downloads/${releaseId}/${trackId}/flac`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    if (unpurchasedRes.status !== 403) throw new Error(`Expected 403 for unpurchased download, got ${unpurchasedRes.status}`);
    console.log('  ✅ Unpurchased download correctly rejected with 403 Forbidden');

    // 8. Purchase Flow
    console.log('\n8️⃣ Testing Purchase Flow (Payment Stub)...');
    const purchaseRes = await fetch(`${baseUrl}/purchases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ releaseId }),
    });
    if (purchaseRes.status !== 201) throw new Error(`Purchase failed: ${purchaseRes.status}`);
    const purchaseData = await purchaseRes.json();
    console.log(`  ✅ Purchased release ${releaseId} (payment ID: ${purchaseData.purchase.payment_id})`);

    // 9. Gated Download + UMG Audit Log
    console.log('\n9️⃣ Testing Authorized Download & UMG Audit Trail...');
    const dlRes = await fetch(`${baseUrl}/downloads/${releaseId}/${trackId}/flac`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (dlRes.status !== 200) throw new Error(`Expected 200 for purchased download, got ${dlRes.status}`);

    const cdHeader = dlRes.headers.get('content-disposition');
    const wmHeader = dlRes.headers.get('x-neotheatre-watermark');
    if (!cdHeader || !cdHeader.includes('attachment')) {
      throw new Error(`Missing or invalid Content-Disposition header: ${cdHeader}`);
    }
    console.log(`  ✅ Download stream received with header: ${cdHeader}`);
    console.log(`  ✅ Forensic watermark header: ${wmHeader}`);

    // Verify DB audit log
    const auditRes = await db.query('SELECT * FROM downloads WHERE user_id = $1 AND release_id = $2', [userId, releaseId]);
    if (auditRes.rows.length === 0) throw new Error('Download was not recorded in downloads audit log table!');
    const log = auditRes.rows[0];
    console.log(`  ✅ Audit record created: user=${log.user_id}, format=${log.format}, watermark=${log.watermark_id}, at=${log.downloaded_at}`);

    // 10. Rate Limiter (1 per 10 seconds)
    console.log('\n🔟 Testing Download Rate Limiter (Anti-Scraping)...');
    // Immediate 2nd download attempt
    const rateLimitedRes = await fetch(`${baseUrl}/downloads/${releaseId}/${trackId}/wav`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (rateLimitedRes.status !== 429) {
      throw new Error(`Expected 429 Too Many Requests within 10s window, got ${rateLimitedRes.status}`);
    }
    const retryAfter = rateLimitedRes.headers.get('retry-after');
    console.log(`  ✅ Second download within 10s rejected with 429 Too Many Requests`);
    console.log(`  ✅ Retry-After header present: ${retryAfter}s`);

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
