import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  AlertTriangle,
  CheckCircle,
  Activity,
  Layers,
  Database,
  RefreshCw,
  Ban,
  Radio,
  FileSearch,
  DollarSign,
  Download,
  Music2,
  Users
} from 'lucide-react';
import api from '../services/api';

interface AdminStats {
  totalUsers: number;
  totalReleases: number;
  totalPurchases: number;
  totalRevenue: number;
  totalDownloads: number;
  activeJobs: number;
}

export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'leak_tracer' | 'releases' | 'jobs' | 'audit_log'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [, setLoading] = useState(true);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Leak Tracer State
  const [searchWatermarkId, setSearchWatermarkId] = useState('');
  const [leakResult, setLeakResult] = useState<any>(null);
  const [leakSearching, setLeakSearching] = useState(false);

  // Releases State
  const [releases, setReleases] = useState<any[]>([]);

  // Jobs State
  const [jobs, setJobs] = useState<any[]>([]);

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
  }, [activeTab]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const res = await api.get('/admin/stats');
        setStats(res.data.stats);
      } else if (activeTab === 'releases') {
        const res = await api.get('/admin/releases');
        setReleases(res.data.releases || []);
      } else if (activeTab === 'jobs') {
        const res = await api.get('/admin/jobs');
        setJobs(res.data.jobs || []);
      } else if (activeTab === 'audit_log') {
        const res = await api.get('/admin/audit-log');
        setAuditLogs(res.data.auditLog || []);
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setFeedbackNotice({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load admin data. Ensure you have admin privileges.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWatermarkSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchWatermarkId.trim()) return;

    setLeakSearching(true);
    setLeakResult(null);
    setFeedbackNotice(null);

    try {
      const res = await api.get(`/admin/leaks/lookup?watermark_id=${encodeURIComponent(searchWatermarkId.trim())}`);
      setLeakResult(res.data);
    } catch (err: any) {
      setFeedbackNotice({
        type: 'error',
        message: err.response?.data?.error || 'No download record found for this watermark ID.',
      });
    } finally {
      setLeakSearching(false);
    }
  };

  const handleToggleUserSuspension = async (userId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      await api.post(`/admin/users/${userId}/suspend`, { isSuspended: newStatus });
      setFeedbackNotice({
        type: 'success',
        message: newStatus ? 'User account suspended! All future downloads revoked.' : 'User account restored.',
      });
      // Refresh leak result if showing this user
      if (leakResult && leakResult.culpritUser?.id === userId) {
        setLeakResult({
          ...leakResult,
          culpritUser: { ...leakResult.culpritUser, is_suspended: newStatus },
        });
      }
    } catch (err: any) {
      setFeedbackNotice({ type: 'error', message: 'Failed to update user suspension status.' });
    }
  };

  const handleToggleDmca = async (releaseId: string, currentTakenDown: boolean) => {
    try {
      const newStatus = !currentTakenDown;
      await api.post(`/admin/releases/${releaseId}/takedown`, { takenDown: newStatus });
      setFeedbackNotice({
        type: 'success',
        message: newStatus ? 'Release taken down under DMCA.' : 'Release restored to catalog.',
      });
      loadInitialData();
    } catch (err: any) {
      setFeedbackNotice({ type: 'error', message: 'Failed to update DMCA status.' });
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await api.post(`/admin/jobs/${jobId}/retry`);
      setFeedbackNotice({ type: 'success', message: 'Job re-queued for processing by worker.' });
      loadInitialData();
    } catch (err: any) {
      setFeedbackNotice({ type: 'error', message: 'Failed to retry conversion job.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-700/50 text-rose-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Platform Operator Portal
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Owner Control Center</h1>
          <p className="text-slate-400 text-sm">
            Forensic leak tracking, catalog rights enforcement, conversion queues, and UMG audit logs.
          </p>
        </div>

        <button
          onClick={loadInitialData}
          className="self-start sm:self-center inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh View
        </button>
      </div>

      {feedbackNotice && (
        <div
          className={`mb-6 p-4 rounded-2xl text-sm flex items-center gap-3 ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
          }`}
        >
          {feedbackNotice.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{feedbackNotice.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-8 overflow-x-auto space-x-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab('leak_tracer')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'leak_tracer'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSearch className="w-4 h-4" />
          Forensic Leak Tracer
        </button>
        <button
          onClick={() => setActiveTab('releases')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'releases'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Catalog & DMCA
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'jobs'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          Queue & Worker Monitor
        </button>
        <button
          onClick={() => setActiveTab('audit_log')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'audit_log'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          UMG Audit Ledger
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="p-6 rounded-3xl glass-panel border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Revenue</span>
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">
                ${Number(stats?.totalRevenue || 0).toFixed(2)}
              </div>
              <span className="text-xs text-slate-500 mt-1 block">From {stats?.totalPurchases || 0} completed purchases</span>
            </div>

            <div className="p-6 rounded-3xl glass-panel border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Audit-Logged Downloads</span>
                <Download className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{stats?.totalDownloads || 0}</div>
              <span className="text-xs text-slate-500 mt-1 block">100% forensic watermark logged</span>
            </div>

            <div className="p-6 rounded-3xl glass-panel border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Pipeline Jobs</span>
                <Radio className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{stats?.activeJobs || 0}</div>
              <span className="text-xs text-slate-500 mt-1 block">Jobs in queue or processing</span>
            </div>

            <div className="p-6 rounded-3xl glass-panel border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Releases</span>
                <Music2 className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{stats?.totalReleases || 0}</div>
              <span className="text-xs text-slate-500 mt-1 block">Catalog titles in store</span>
            </div>

            <div className="p-6 rounded-3xl glass-panel border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Registered Accounts</span>
                <Users className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{stats?.totalUsers || 0}</div>
              <span className="text-xs text-slate-500 mt-1 block">Artists, fans, and operators</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FORENSIC LEAK TRACER */}
      {activeTab === 'leak_tracer' && (
        <div className="space-y-8">
          <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-rose-900/40">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Search className="w-5 h-5 text-rose-400" />
              Trace Leaked Audio by Watermark ID
            </h2>
            <p className="text-slate-400 text-xs mb-6 max-w-xl leading-relaxed">
              When a leaked file is found on torrents or file-sharing sites, extract or read the embedded watermark ID
              (e.g., <code className="text-rose-300">wm_10ca8260-f2c9-478f...</code>). Neotheatre's audit database will
              identify the purchaser, their origin IP address, and transaction timestamp.
            </p>

            <form onSubmit={handleWatermarkSearch} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                value={searchWatermarkId}
                onChange={(e) => setSearchWatermarkId(e.target.value)}
                placeholder="Paste Watermark ID (e.g., wm_10ca8260-...)"
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                disabled={leakSearching}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all shadow-lg shadow-rose-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {leakSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
                Investigate Leak
              </button>
            </form>
          </div>

          {/* Dossier Result */}
          {leakResult && (
            <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-rose-500/40 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400 block mb-1">
                    MATCH CONFIRMED
                  </span>
                  <h3 className="text-2xl font-bold text-white">{leakResult.culpritUser?.email}</h3>
                  <span className="text-xs text-slate-400 font-mono">User ID: {leakResult.culpritUser?.id}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      leakResult.culpritUser?.is_suspended
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {leakResult.culpritUser?.is_suspended ? 'ACCOUNT SUSPENDED' : 'ACCOUNT ACTIVE'}
                  </span>

                  <button
                    onClick={() =>
                      handleToggleUserSuspension(
                        leakResult.culpritUser?.id,
                        Boolean(leakResult.culpritUser?.is_suspended)
                      )
                    }
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      leakResult.culpritUser?.is_suspended
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    {leakResult.culpritUser?.is_suspended ? 'Unsuspend User' : 'Suspend Account Immediately'}
                  </button>
                </div>
              </div>

              {/* Forensic Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Leaked Release</span>
                  <strong className="text-white text-sm">{leakResult.match.release_title}</strong>
                  <span className="text-indigo-400 block mt-0.5">{leakResult.match.artist_name}</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Track & Format</span>
                  <strong className="text-white text-sm">{leakResult.match.track_title || 'Master stem'}</strong>
                  <span className="text-cyan-400 uppercase font-bold block mt-0.5">{leakResult.match.format}</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Download Timestamp</span>
                  <strong className="text-white text-sm">{new Date(leakResult.match.downloaded_at).toLocaleString()}</strong>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 font-mono">
                  <span className="text-slate-400 block mb-1 font-sans">Origin IP Address</span>
                  <strong className="text-amber-400 text-sm">{leakResult.match.ip_address}</strong>
                </div>
              </div>

              {/* Other Downloads by this user */}
              {leakResult.otherDownloads && leakResult.otherDownloads.length > 0 && (
                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Other Files Downloaded by This Account (Catalog Exposure Risk):
                  </h4>
                  <div className="space-y-2">
                    {leakResult.otherDownloads.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <strong className="text-white">{item.release_title}</strong>
                          <span className="text-slate-400 ml-2">— {item.track_title}</span>
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] uppercase font-bold text-indigo-400">
                            {item.format}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-500">WM: {item.watermark_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CATALOG & DMCA */}
      {activeTab === 'releases' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Catalog & DMCA Enforcement</h2>
              <p className="text-xs text-slate-400">Manage releases, view legal attestations, and toggle DMCA takedowns</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300">
              {releases.length} Releases
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Release</th>
                  <th className="px-4 py-3">Uploader & Attestation</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Sales / Downloads</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {releases.map((rel) => (
                  <tr key={rel.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={rel.cover_art_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                          alt={rel.title}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div>
                          <strong className="text-white block">{rel.title}</strong>
                          <span className="text-slate-400">{rel.artist_name}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-slate-300 block">{rel.uploaded_by_email}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold block">
                        Attested: {rel.attested_by_email ? 'Yes' : 'No'}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-semibold text-white">${Number(rel.price_usd).toFixed(2)}</td>

                    <td className="px-4 py-3">
                      <span className="text-white font-semibold">{rel.purchase_count || 0}</span> sales
                      <span className="text-slate-500 mx-1">•</span>
                      <span className="text-cyan-400 font-semibold">{rel.download_count || 0}</span> dls
                    </td>

                    <td className="px-4 py-3">
                      {rel.dmca_taken_down ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                          DMCA TAKEN DOWN
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          ACTIVE
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleDmca(rel.id, rel.dmca_taken_down)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          rel.dmca_taken_down
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-300'
                        }`}
                      >
                        {rel.dmca_taken_down ? 'Restore Catalog' : 'DMCA Takedown'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: QUEUE & WORKER MONITOR */}
      {activeTab === 'jobs' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Conversion Queue & Subprocess Monitor</h2>
              <p className="text-xs text-slate-400">Database queue status, claimed workers, and FFmpeg / libiamf pipelines</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Job ID & Track</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Claimed By Worker</th>
                  <th className="px-4 py-3">Formats Generated</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <span className="text-indigo-400 truncate block max-w-[160px]">{job.id}</span>
                      <span className="text-slate-300 font-sans font-semibold">{job.release_title || 'Release'}</span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          job.status === 'completed'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : job.status === 'processing'
                            ? 'bg-indigo-950 text-indigo-400 border border-indigo-800 animate-pulse'
                            : job.status === 'claimed'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : job.status === 'failed'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-400">{job.claimed_by || 'Unclaimed'}</td>

                    <td className="px-4 py-3 text-cyan-300 font-sans">{job.output_formats || '—'}</td>

                    <td className="px-4 py-3 text-slate-500 font-sans">
                      {new Date(job.created_at).toLocaleTimeString()}
                    </td>

                    <td className="px-4 py-3 font-sans">
                      {job.status === 'failed' && (
                        <button
                          onClick={() => handleRetryJob(job.id)}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: UMG AUDIT LEDGER */}
      {activeTab === 'audit_log' && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Global Download Audit Ledger</h2>
              <p className="text-xs text-slate-400">Complete immutable record satisfying Universal Music Group licensing</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300">
              {auditLogs.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Timestamp</th>
                  <th className="px-4 py-3">User Email</th>
                  <th className="px-4 py-3">Release & Track</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Forensic Watermark ID</th>
                  <th className="px-4 py-3 rounded-r-xl">Origin IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-sans text-slate-400">
                      {new Date(log.downloaded_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-sans text-white font-semibold">{log.user_email}</td>
                    <td className="px-4 py-3 font-sans">
                      <strong className="text-white block">{log.release_title}</strong>
                      <span className="text-slate-400 text-[11px]">{log.track_title || 'Stem'}</span>
                    </td>
                    <td className="px-4 py-3 uppercase font-bold text-indigo-400">{log.format}</td>
                    <td className="px-4 py-3 text-cyan-300 truncate max-w-[200px]">{log.watermark_id}</td>
                    <td className="px-4 py-3 text-slate-400">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
