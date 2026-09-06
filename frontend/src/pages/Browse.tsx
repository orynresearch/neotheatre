import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles, Music2, ShieldCheck, ArrowRight } from 'lucide-react';
import api from '../services/api';
import { FormatBadge } from '../components/FormatBadge';

interface Release {
  id: string;
  artist_name: string;
  title: string;
  description: string;
  cover_art_url: string;
  price_usd: number;
  created_at: string;
  track_count: number;
  formats: string[];
}

export const Browse: React.FC = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReleases();
  }, []);

  const fetchReleases = async () => {
    try {
      const res = await api.get('/releases');
      setReleases(res.data.releases || []);
    } catch (err) {
      console.error('Failed to load releases:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredReleases = releases.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.artist_name.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden glass-panel border border-slate-800 p-8 sm:p-12 mb-12 shadow-2xl">
        <div className="absolute -right-16 -bottom-16 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -top-16 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Next-Gen Spatial & Hi-Res Distribution
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Hear Music Exactly as the Creators Mastered It.
          </h1>
          <p className="text-slate-300 text-base sm:text-lg mb-8 leading-relaxed">
            Direct, DRM-free releases in standardized <span className="text-cyan-300 font-semibold">IAMF</span>,{' '}
            <span className="text-purple-300 font-semibold">Dolby Atmos</span>, and studio-grade{' '}
            <span className="text-amber-300 font-semibold">24-bit 96kHz Lossless</span> with full forensic provenance.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              100% DRM-Free Ownership
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1.5">
              <Music2 className="w-4 h-4 text-cyan-400" />
              Multi-Format Access (One Purchase)
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Instant Re-download Ledger
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Section Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Featured Releases</h2>
          <p className="text-slate-400 text-sm">Explore master-quality music across spatial & lossless formats</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artists, titles..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Releases Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl glass-card h-80 animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : filteredReleases.length === 0 ? (
        <div className="text-center py-16 rounded-2xl glass-card border border-slate-800">
          <Music2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-200 mb-1">No releases found</h3>
          <p className="text-slate-400 text-sm mb-6">
            {searchQuery ? 'Try adjusting your search query.' : 'Be the first artist to upload a release!'}
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30"
          >
            Upload to Neotheatre
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReleases.map((release) => (
            <Link
              key={release.id}
              to={`/release/${release.id}`}
              className="group rounded-2xl glass-card overflow-hidden border border-slate-800/80 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col"
            >
              {/* Cover Art Image */}
              <div className="relative aspect-square w-full bg-slate-900 overflow-hidden">
                <img
                  src={release.cover_art_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                  alt={release.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-white/10 text-xs font-bold text-white shadow-lg">
                  ${Number(release.price_usd).toFixed(2)}
                </div>
              </div>

              {/* Release Info */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1 mb-1">
                    {release.title}
                  </h3>
                  <p className="text-sm text-slate-400 font-medium mb-3 line-clamp-1">{release.artist_name}</p>
                </div>

                {/* Available Formats */}
                <div className="pt-3 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                  {(release.formats || ['flac', 'wav', 'stereo', 'iamf']).slice(0, 3).map((fmt) => (
                    <FormatBadge key={fmt} format={fmt} />
                  ))}
                  {(release.formats?.length || 4) > 3 && (
                    <span className="text-[10px] text-slate-500 font-medium self-center pl-1">
                      +{(release.formats?.length || 4) - 3} more
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
