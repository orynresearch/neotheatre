import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, CheckCircle2, AlertCircle, Disc3, Sparkles, ArrowRight } from 'lucide-react';
import api from '../services/api';

export const Upload: React.FC = () => {
  const navigate = useNavigate();

  const [artistName, setArtistName] = useState('');
  const [title, setTitle] = useState('');
  const [trackTitle, setTrackTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceUsd, setPriceUsd] = useState('20.00');
  const [coverArtUrl, setCoverArtUrl] = useState('');
  const [sourceFormat, setSourceFormat] = useState('wav');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Mandatory Attestation Checkbox
  const [attestationChecked, setAttestationChecked] = useState(false);

  // Upload & Conversion Job State
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [completedReleaseId, setCompletedReleaseId] = useState<string | null>(null);

  // Job Polling
  useEffect(() => {
    if (!jobId || jobStatus === 'completed' || jobStatus === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/uploads/jobs/${jobId}`);
        const status = res.data.job.status;
        setJobStatus(status);
        if (status === 'completed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to poll conversion status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, jobStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) {
      setErrorMessage('Please select an audio file to upload.');
      return;
    }
    if (!attestationChecked) {
      setErrorMessage('You must review and check the legal attestation box.');
      return;
    }

    setUploading(true);
    setErrorMessage('');
    setJobId(null);
    setJobStatus('queued');

    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('artist_name', artistName);
    formData.append('title', title);
    formData.append('track_title', trackTitle || title);
    formData.append('description', description);
    formData.append('price_usd', priceUsd);
    formData.append('cover_art_url', coverArtUrl);
    formData.append('source_format', sourceFormat);
    formData.append('attestation', 'true');

    try {
      const res = await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setJobId(res.data.jobId);
      setCompletedReleaseId(res.data.releaseId);
      setJobStatus(res.data.status || 'queued');
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Upload failed. Please try again.');
      setJobStatus(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-700/50 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Artist Ingestion Studio
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">Publish Master Audio</h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Upload your ADM BWF or uncompressed multi-channel masters. The automated engine generates IAMF bitstreams,
          Atmos streams, and 24-bit 96kHz lossless copies.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-8 p-4 rounded-2xl bg-rose-950/60 border border-rose-600/40 text-rose-200 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Real-time Job Progress Monitor */}
      {jobStatus && (
        <div className="mb-8 p-6 rounded-3xl glass-panel border border-indigo-500/40 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Automated Audio Conversion Pipeline
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700">
              STATUS: {jobStatus.toUpperCase()}
            </span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden mb-4 border border-slate-800">
            <div
              className={`h-full transition-all duration-700 ${
                jobStatus === 'completed'
                  ? 'bg-emerald-500 w-full'
                  : jobStatus === 'processing'
                  ? 'bg-indigo-500 w-2/3 animate-pulse'
                  : jobStatus === 'claimed'
                  ? 'bg-amber-500 w-1/3'
                  : 'bg-cyan-500 w-1/6'
              }`}
            />
          </div>

          <div className="text-xs text-slate-300">
            {jobStatus === 'queued' && 'Job is queued in the database. Worker will claim shortly...'}
            {jobStatus === 'claimed' && 'Job claimed by conversion worker. Starting audio processing...'}
            {jobStatus === 'processing' && 'Running FFmpeg & libiamf: Generating IAMF, Atmos, and 24-bit 96kHz FLAC/WAV...'}
            {jobStatus === 'completed' && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  All formats generated and verified!
                </span>
                {completedReleaseId && (
                  <button
                    onClick={() => navigate(`/release/${completedReleaseId}`)}
                    className="inline-flex items-center gap-1 text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg font-bold"
                  >
                    View Release <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Artist Name *
            </label>
            <input
              type="text"
              required
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              placeholder="e.g., AJR, Elio Mei, Daft Punk"
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Release Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., The Maybe Man (Master)"
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Track Title *
            </label>
            <input
              type="text"
              required
              value={trackTitle}
              onChange={(e) => setTrackTitle(e.target.value)}
              placeholder="e.g., Touchy Feely Fool"
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Price (USD) *
            </label>
            <input
              type="number"
              step="0.50"
              required
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
            Description / Liner Notes
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Spatial mastering notes, recording details, or album credits..."
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
            Cover Art URL (Optional)
          </label>
          <input
            type="url"
            value={coverArtUrl}
            onChange={(e) => setCoverArtUrl(e.target.value)}
            placeholder="https://... (or leave blank for high-res default)"
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Audio File Input & Format Choice */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Source Audio File (ADM BWF / WAV / FLAC) *
            </label>
            <input
              type="file"
              required
              accept=".wav,.flac,.bwf,.adm"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setAudioFile(e.target.files[0]);
                }
              }}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-indigo-400 hover:file:bg-slate-700 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Source Format Type
            </label>
            <select
              value={sourceFormat}
              onChange={(e) => setSourceFormat(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="adm">ADM BWF (Immersive Spatial)</option>
              <option value="wav">WAV (Multi-channel / Stereo)</option>
              <option value="flac">FLAC (Lossless)</option>
            </select>
          </div>
        </div>

        {/* MANDATORY LEGAL ATTESTATION CHECKBOX */}
        <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/40">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="attestation-checkbox"
              checked={attestationChecked}
              onChange={(e) => setAttestationChecked(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="attestation-checkbox" className="text-xs text-amber-200/90 leading-relaxed cursor-pointer select-none">
              <span className="font-bold text-amber-300 block mb-1">
                Mandatory Rights & Distribution Attestation:
              </span>
              By checking this box, you attest that:
              <ul className="list-disc ml-4 my-1 space-y-0.5 text-amber-100/80">
                <li>You own the copyright to this musical composition and sound recording, OR</li>
                <li>You have been granted explicit written permission by the copyright holder(s) to distribute this content, OR</li>
                <li>The content is in the public domain or licensed under a Creative Commons or similar open license.</li>
              </ul>
              <strong className="text-white block mt-1">
                I attest that I own the rights to this content, or have the necessary rights to distribute it.
              </strong>
            </label>
          </div>
        </div>

        {/* Submit Button (Strictly disabled until attestation checked) */}
        <button
          type="submit"
          disabled={!attestationChecked || uploading || !audioFile}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Disc3 className="w-5 h-5 animate-spin" />
              Uploading & Enqueueing Job...
            </>
          ) : (
            <>
              <UploadCloud className="w-5 h-5" />
              Attest & Publish Master Release
            </>
          )}
        </button>
      </form>
    </div>
  );
};
