'use client';

import React, { useMemo, useState } from 'react';

interface HistogramProps {
  values: number[];
  /** Highlight the bin containing this value (e.g. the viewer's own score). */
  highlight?: number | null;
  binSize?: number;
  unit?: string;
  height?: number;
  className?: string;
}

const C = { bar: '#4338ca', barSoft: '#c7d2fe', grid: '#e2e8f0', ink: '#64748b' };

/**
 * Distribution of one measure (e.g. best WPM across all ranked students).
 * Single series, one hue; the viewer's own bin is emphasised and the rest recede.
 */
export default function Histogram({ values, highlight = null, binSize = 10, unit = 'WPM', height = 140, className = '' }: HistogramProps) {
  const [hover, setHover] = useState<number | null>(null);
  const bins = useMemo(() => {
    if (!values.length) return [] as { from: number; to: number; count: number }[];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const start = Math.floor(min / binSize) * binSize;
    const end = Math.floor(max / binSize) * binSize + binSize;
    const out: { from: number; to: number; count: number }[] = [];
    for (let b = start; b < end; b += binSize) out.push({ from: b, to: b + binSize, count: 0 });
    for (const v of values) {
      const i = Math.min(out.length - 1, Math.floor((v - start) / binSize));
      out[i].count++;
    }
    return out;
  }, [values, binSize]);

  if (!bins.length) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 flex items-center justify-center ${className}`} style={{ height }}>
        No scores yet.
      </div>
    );
  }

  const W = 640;
  const H = height;
  const pad = { top: 18, right: 8, bottom: 24, left: 8 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const gap = 2;
  const bw = iw / bins.length;
  const highlightIdx = highlight === null ? -1 : bins.findIndex((b) => highlight >= b.from && highlight < b.to);
  const hasHighlight = highlightIdx >= 0;
  const maxIdx = bins.reduce((m, b, i) => (b.count > bins[m].count ? i : m), 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full h-auto select-none ${className}`} role="img" aria-label={`Distribution of ${unit}`} onMouseLeave={() => setHover(null)}>
      <line x1={pad.left} x2={W - pad.right} y1={pad.top + ih} y2={pad.top + ih} stroke={C.grid} strokeWidth={1} />
      {bins.map((b, i) => {
        const h = (b.count / maxCount) * ih;
        const x = pad.left + i * bw + gap / 2;
        const y = pad.top + ih - h;
        const emphasised = !hasHighlight || i === highlightIdx || hover === i;
        return (
          <g key={b.from} onMouseEnter={() => setHover(i)}>
            {/* hit target larger than the bar */}
            <rect x={pad.left + i * bw} y={pad.top} width={bw} height={ih} fill="transparent" />
            {b.count > 0 && (
              <rect x={x} y={y} width={Math.max(1, bw - gap)} height={h} rx={3} fill={emphasised ? C.bar : C.barSoft} />
            )}
            {(i === maxIdx || i === highlightIdx || hover === i) && b.count > 0 && (
              <text x={x + (bw - gap) / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0f172a">
                {b.count}
              </text>
            )}
            {(bins.length <= 8 || i % Math.ceil(bins.length / 8) === 0) && (
              <text x={pad.left + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize={10} fill={C.ink}>
                {b.from}
              </text>
            )}
          </g>
        );
      })}
      {hover !== null && (
        <text x={W - pad.right} y={12} textAnchor="end" fontSize={10} fill={C.ink}>
          {bins[hover].from}–{bins[hover].to} {unit}: {bins[hover].count} student{bins[hover].count === 1 ? '' : 's'}
        </text>
      )}
      {hasHighlight && hover === null && (
        <text x={W - pad.right} y={12} textAnchor="end" fontSize={10} fill={C.ink}>
          Your bin: {bins[highlightIdx].from}–{bins[highlightIdx].to} {unit}
        </text>
      )}
    </svg>
  );
}
