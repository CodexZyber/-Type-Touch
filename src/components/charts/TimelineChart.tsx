'use client';

import React, { useMemo, useState } from 'react';
import { AttemptTimelinePoint } from '@/types';

// Chart palette (validated for colorblind separation and contrast on white):
//   net WPM  #4338ca (indigo-700)   raw burst  #0d9488 (teal-600)   errors  #ef4444 (status)
const C = { wpm: '#4338ca', raw: '#0d9488', error: '#ef4444', grid: '#e2e8f0', axis: '#cbd5e1', ink: '#64748b' };

interface TimelineChartProps {
  points: AttemptTimelinePoint[];
  /** Total seconds of the attempt, so the x-axis covers the whole test even when it ended early. */
  durationSeconds?: number;
  height?: number;
  className?: string;
}

/**
 * WPM over the course of one attempt: net WPM (cumulative) and raw burst speed
 * per second share one axis (both are WPM); seconds with mistypes carry a
 * red marker along the baseline. Hover shows the exact values.
 */
export default function TimelineChart({ points, durationSeconds, height = 180, className = '' }: TimelineChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = height;
  const pad = { top: 14, right: 16, bottom: 28, left: 36 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;

  const data = useMemo(() => points.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t), [points]);
  const maxT = Math.max(durationSeconds || 0, data.length ? data[data.length - 1].t : 0, 1);
  const maxY = Math.max(10, ...data.map((p) => Math.max(p.wpm, p.raw))) * 1.1;
  const x = (t: number) => pad.left + (t / maxT) * iw;
  const y = (v: number) => pad.top + ih - (v / maxY) * ih;

  const path = (key: 'wpm' | 'raw') =>
    data.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const area = data.length
    ? `${path('wpm')} L${x(data[data.length - 1].t).toFixed(1)},${y(0)} L${x(data[0].t).toFixed(1)},${y(0)} Z`
    : '';

  const yTicks = useMemo(() => {
    const step = maxY > 150 ? 50 : maxY > 60 ? 25 : 10;
    const ticks: number[] = [];
    for (let v = 0; v <= maxY; v += step) ticks.push(v);
    return ticks;
  }, [maxY]);
  const xTicks = useMemo(() => {
    const step = maxT > 120 ? 30 : maxT > 45 ? 15 : 5;
    const ticks: number[] = [];
    for (let t = 0; t <= maxT; t += step) ticks.push(t);
    return ticks;
  }, [maxT]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!data.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = ((px - pad.left) / iw) * maxT;
    let best = 0;
    for (let i = 1; i < data.length; i++) if (Math.abs(data[i].t - t) < Math.abs(data[best].t - t)) best = i;
    setHover(best);
  };

  if (!data.length) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 flex items-center justify-center ${className}`} style={{ height }}>
        No timeline recorded for this attempt.
      </div>
    );
  }

  const h = hover !== null ? data[hover] : null;
  const errorPoints = data.filter((p) => p.errors > 0);
  const peak = data.reduce((m, p) => (p.wpm > m.wpm ? p : m), data[0]);

  return (
    <div className={className}>
      <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-1 px-1">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: C.wpm }} />Net WPM</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: C.raw }} />Raw burst</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C.error }} />Mistypes</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="Typing speed over the attempt"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* grid */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke={C.grid} strokeWidth={1} />
            <text x={pad.left - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill={C.ink}>{v}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize={10} fill={C.ink}>{t}s</text>
        ))}
        <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} stroke={C.axis} strokeWidth={1} />

        {/* series */}
        <path d={area} fill={C.wpm} opacity={0.08} />
        <path d={path('raw')} fill="none" stroke={C.raw} strokeWidth={1.5} opacity={0.85} strokeLinejoin="round" />
        <path d={path('wpm')} fill="none" stroke={C.wpm} strokeWidth={2} strokeLinejoin="round" />

        {/* mistype markers on the baseline */}
        {errorPoints.map((p) => (
          <circle key={p.t} cx={x(p.t)} cy={y(0)} r={p.errors > 1 ? 4 : 3} fill={C.error} stroke="#fff" strokeWidth={1.5} />
        ))}

        {/* selective direct label: the peak */}
        <circle cx={x(peak.t)} cy={y(peak.wpm)} r={4} fill={C.wpm} stroke="#fff" strokeWidth={2} />
        <text x={x(peak.t)} y={y(peak.wpm) - 8} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0f172a">
          {peak.wpm}
        </text>

        {/* hover crosshair + tooltip */}
        {h && (
          <g>
            <line x1={x(h.t)} x2={x(h.t)} y1={pad.top} y2={y(0)} stroke={C.axis} strokeWidth={1} />
            <circle cx={x(h.t)} cy={y(h.wpm)} r={4} fill={C.wpm} stroke="#fff" strokeWidth={2} />
            <circle cx={x(h.t)} cy={y(h.raw)} r={4} fill={C.raw} stroke="#fff" strokeWidth={2} />
            {(() => {
              const bw = 128, bh = 54;
              const bx = Math.min(W - pad.right - bw, Math.max(pad.left, x(h.t) + 10));
              const by = pad.top + 4;
              return (
                <g>
                  <rect x={bx} y={by} width={bw} height={bh} rx={8} fill="#fff" stroke={C.grid} />
                  <text x={bx + 10} y={by + 16} fontSize={10} fill={C.ink}>at {h.t}s</text>
                  <text x={bx + 10} y={by + 30} fontSize={11} fontWeight={700} fill="#0f172a">{h.wpm} WPM net · {h.raw} raw</text>
                  <text x={bx + 10} y={by + 44} fontSize={10} fill={h.errors ? C.error : C.ink}>
                    {h.errors ? `${h.errors} mistype${h.errors === 1 ? '' : 's'}` : 'clean second'}
                  </text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}
