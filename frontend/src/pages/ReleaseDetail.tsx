import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, ArrowRight, Download, Disc3, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FormatBadge } from '../components/FormatBadge';

interface Track {
  id: string;
  title: string;
  duration_seconds: number;
  track_number: number;
  formats: string[];
}

interface ReleaseDetailData {
  id: string;
  artist_name: string;
  title: string;
  description: string;
  cover_art_url: string;
  price_usd: number;
  uploaded_by_email: string;
  created_at: string;
  tracks: Track[];
  isPurchased: boolean;
}

export const ReleaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [release, setRelease] = useState<ReleaseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchReleaseDetail();
  }, [id, user]);

  const fetchReleaseDetail = async () => {
    try {
      const res = await api.get(`/releases/${id}`);
      setRelease(res.data.release);
    } catch (err: any) {
      console.error('Failed to load release detail:', err);
      setErrorMsg(err.response?.data?.error || 'Release not found');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setPurchasing(true);
    setErrorMsg('');
    try {
      await api.post('/purchases', { releaseId: id });
      // Refresh to update isPurchased status
      await fetchReleaseDetail();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to process purchase.');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-slate-400">
        <div className="animate-pulse flex flex-col items-center">
          <Disc3 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
          <p>Loading master release data...</p>
        </div>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Release Unavailable</h2>
        <p className="text-slate-400 text-sm mb-6">{errorMsg || 'Could not find the requested release.'}</p>
        <Link to="/" className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700">
          Back to Browse
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Banner if already purchased */}
      {release.isPurchased && (
        <div className="mb-8 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-emerald-300 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>You own this release! Full multi-format downloads are unlocked in your Library.</span>
          </div>
          <Link
            to="/library"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shrink-0"
          >
            <Download className="w-4 h-4" />
            Go to Library
          </Link>
        </div>
      )}

      {/* Album Header Details */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start mb-12">
        {/* Cover Art */}
        <div className="md:col-span-5 lg:col-span-4">
          <div className="relative aspect-square rounded-3xl overflow-hidden glass-card border border-slate-800 shadow-2xl">
            <img
              src={release.cover_art_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
              alt={release.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Release Metadata & Actions */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Disc3 className="w-3.5 h-3.5 text-indigo-400" />
              Master Audio Release
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">{release.title}</h1>
            <p className="text-xl text-indigo-400 font-semibold mb-6">{release.artist_name}</p>

            {release.description && (
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 glass-panel p-4 rounded-2xl border border-slate-800">
                {release.description}
              </p>
            )}

            {/* Formats Included Banner */}
            <div className="mb-8">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                Included High-Bitrate Formats (DRM-Free):
              </h4>
              <div className="flex flex-wrap gap-2">
                <FormatBadge format="iamf" />
                <FormatBadge format="atmos-dd" />
                <FormatBadge format="flac" />
                <FormatBadge format="wav" />
                <FormatBadge format="stereo" />
              </div>
            </div>
          </div>

          {/* Pricing and Action Button */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-400 font-medium block">One-time purchase price</span>
              <div className="text-3xl font-extrabold text-white">
                ${Number(release.price_usd).toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">USD</span>
              </div>
            </div>

            {release.isPurchased ? (
              <Link
                to="/library"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/20"
              >
                <Download className="w-4 h-4" />
                Download Files in Library
              </Link>
            ) : (
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {purchasing ? (
                  <>
                    <Disc3 className="w-4 h-4 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    Purchase Release
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tracklist Section */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Tracklist & Master Stems</h2>
            <p className="text-xs text-slate-400">Complete multi-channel channels and object bitstreams</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300">
            {release.tracks.length} {release.tracks.length === 1 ? 'Track' : 'Tracks'}
          </span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {release.tracks.map((track) => (
            <div key={track.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
              <div className="flex items-center gap-4">
                <span className="w-6 text-center text-sm font-semibold text-slate-500 group-hover:text-indigo-400 transition-colors">
                  {track.track_number}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {track.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-500">IAMF + Atmos + 24-bit Lossless</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                {release.isPurchased ? (
                  <Link
                    to="/library"
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Link>
                ) : (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                    Purchase to unlock
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
