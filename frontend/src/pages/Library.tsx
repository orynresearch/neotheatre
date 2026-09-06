import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Music2, ShieldCheck, Clock, AlertTriangle, CheckCircle, Disc3, Sparkles } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface DownloadHistoryItem {
  id: string;
  format: string;
  downloaded_at: string;
  ip_address: string;
  watermark_id: string;
  track_title?: string;
}

interface PurchasedItem {
  purchase_id: string;
  purchased_at: string;
  amount_paid: number;
  release_id: string;
  title: string;
  artist_name: string;
  cover_art_url: string;
  description: string;
  tracks: {
    id: string;
    title: string;
    track_number: number;
    formats: string[];
  }[];
  downloadHistory: DownloadHistoryItem[];
}

export const Library: React.FC = () => {
  const { user } = useAuth();
  const [library, setLibrary] = useState<PurchasedItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Rate Limiter Cooldown State
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [activeDownloadFormat, setActiveDownloadFormat] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchLibrary();
  }, [user]);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const fetchLibrary = async () => {
    try {
      const res = await api.get('/purchases');
      setLibrary(res.data.library || []);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (releaseId: string, trackId: string, format: string) => {
    if (cooldownRemaining > 0) {
      setStatusNotice({
        type: 'error',
        message: `Anti-scraping rate limit active. Please wait ${cooldownRemaining}s before initiating another download.`,
      });
      return;
    }

    setActiveDownloadFormat(`${trackId}-${format}`);
    setStatusNotice(null);

    try {
      const res = await api.get(`/downloads/${releaseId}/${trackId}/${format}`, {
        responseType: 'blob',
      });

      // Extract filename from header or build fallback
      const contentDisposition = res.headers['content-disposition'];
      let filename = `track-${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const watermarkId = res.headers['x-neotheatre-watermark'] || 'wm_verified';

      // Trigger browser download
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Start 10s cooldown
      setCooldownRemaining(10);
      setStatusNotice({
        type: 'success',
        message: `Download started! Forensic watermark [${watermarkId.slice(0, 12)}...] logged to audit ledger.`,
      });

      // Refresh to update download history audit trail
      await fetchLibrary();
    } catch (err: any) {
      console.error('Download error:', err);
      if (err.response?.status === 429) {
        const retryAfter = parseInt(err.response?.headers['retry-after'] || '10', 10);
        setCooldownRemaining(retryAfter);
        setStatusNotice({
          type: 'error',
          message: `Rate limit triggered (1 download per 10 seconds). Cooldown: ${retryAfter}s.`,
        });
      } else {
        setStatusNotice({
          type: 'error',
          message: err.response?.data?.message || 'Download failed or format unavailable.',
        });
      }
    } finally {
      setActiveDownloadFormat(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-slate-400">
        <Disc3 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
        <p>Loading your music library...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Music Library</h1>
          <p className="text-slate-400 text-sm">
            Permanent DRM-free re-downloads in all mastered formats. Download access is gated and forensically logged.
          </p>
        </div>

        {/* Rate limit status pill */}
        {cooldownRemaining > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-300 text-xs font-bold animate-pulse">
            <Clock className="w-4 h-4" />
            Rate Limit Cooldown: {cooldownRemaining}s
          </div>
        )}
      </div>

      {statusNotice && (
        <div
          className={`mb-8 p-4 rounded-2xl text-sm flex items-center gap-3 ${
            statusNotice.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
          }`}
        >
          {statusNotice.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{statusNotice.message}</span>
        </div>
      )}

      {library.length === 0 ? (
        <div className="text-center py-20 rounded-3xl glass-panel border border-slate-800">
          <Music2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">No purchased releases yet</h3>
          <p className="text-slate-400 text-sm mb-6">Explore the browse catalog to purchase your first spatial master.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm"
          >
            Browse Releases
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {library.map((item) => (
            <div key={item.purchase_id} className="rounded-3xl glass-panel border border-slate-800 p-6 sm:p-8">
              {/* Header: Album info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-800">
                <img
                  src={item.cover_art_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                  alt={item.title}
                  className="w-24 h-24 rounded-2xl object-cover shadow-lg"
                />
                <div className="flex-1">
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified DRM-Free License
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{item.title}</h2>
                  <p className="text-indigo-400 font-semibold text-sm mb-2">{item.artist_name}</p>
                  <span className="text-xs text-slate-500">
                    Purchased on {new Date(item.purchased_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Tracks & Format Download Selector */}
              <div className="pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Select Format for Direct Download:
                </h3>

                <div className="space-y-4">
                  {item.tracks.map((track) => (
                    <div
                      key={track.id}
                      className="p-4 rounded-2xl glass-card border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-center text-xs font-bold text-slate-500">{track.track_number}</span>
                        <div>
                          <h4 className="text-sm font-bold text-white">{track.title}</h4>
                          <span className="text-[11px] text-slate-400">Master Stems & Formats</span>
                        </div>
                      </div>

                      {/* Format Download Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {['iamf', 'atmos-dd', 'flac', 'wav', 'stereo'].map((fmt) => {
                          const isDownloading = activeDownloadFormat === `${track.id}-${fmt}`;
                          return (
                            <button
                              key={fmt}
                              onClick={() => handleDownload(item.release_id, track.id, fmt)}
                              disabled={isDownloading || cooldownRemaining > 0}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Download className="w-3 h-3 text-indigo-400" />
                              {fmt.toUpperCase()}
                              {isDownloading && <Disc3 className="w-3 h-3 animate-spin text-cyan-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* UMG Audit Trail Ledger */}
              {item.downloadHistory && item.downloadHistory.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Download Audit Trail (UMG Provenance Log)
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {item.downloadHistory.length} Recorded Downloads
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold text-[10px]">
                        <tr>
                          <th className="px-3 py-2 rounded-l-lg">Timestamp</th>
                          <th className="px-3 py-2">Format</th>
                          <th className="px-3 py-2">Forensic Watermark ID</th>
                          <th className="px-3 py-2 rounded-r-lg">Origin IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                        {item.downloadHistory.slice(0, 5).map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2">{new Date(log.downloaded_at).toLocaleString()}</td>
                            <td className="px-3 py-2 uppercase font-bold text-indigo-400">{log.format}</td>
                            <td className="px-3 py-2 text-cyan-300 font-mono truncate max-w-[200px]">
                              {log.watermark_id || 'wm_verified'}
                            </td>
                            <td className="px-3 py-2 text-slate-400">{log.ip_address}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
