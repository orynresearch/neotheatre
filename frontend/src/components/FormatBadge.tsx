import React from 'react';

interface FormatBadgeProps {
  format: string;
  className?: string;
}

export const FormatBadge: React.FC<FormatBadgeProps> = ({ format, className = '' }) => {
  const f = format.toLowerCase();

  let label = format.toUpperCase();
  let style = 'bg-slate-800 text-slate-300 border-slate-700';

  if (f === 'iamf') {
    label = 'IAMF Immersive';
    style = 'bg-cyan-950/70 text-cyan-300 border-cyan-700/60 shadow-[0_0_10px_rgba(6,182,212,0.15)]';
  } else if (f.includes('atmos')) {
    label = f.includes('thd') ? 'Dolby TrueHD Atmos' : 'Dolby Atmos (DD+)';
    style = 'bg-purple-950/70 text-purple-300 border-purple-700/60 shadow-[0_0_10px_rgba(168,85,247,0.15)]';
  } else if (f === 'flac') {
    label = '24-bit FLAC (96kHz)';
    style = 'bg-amber-950/70 text-amber-300 border-amber-700/60 shadow-[0_0_10px_rgba(245,158,11,0.15)]';
  } else if (f === 'wav') {
    label = '24-bit WAV Lossless';
    style = 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60';
  } else if (f === 'stereo') {
    label = 'Stereo Downmix';
    style = 'bg-indigo-950/70 text-indigo-300 border-indigo-700/60';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${style} ${className}`}
    >
      {label}
    </span>
  );
};
