'use client';

import React, { useState } from 'react';

export interface ProgressionPoint {
  label: string; // e.g. "#3"
  wpm: number;
  accuracy: number;
  qualified: boolean;
  at?: string;
}

interface ProgressionChartProps {
  points: ProgressionPoint[];
  height?: number;
  className?: string;
}

const C = { line: '#4338ca', grid: '#e2e8f0', axis: '#cbd5e1', ink: '#64748b', bad: '#ef4444' };

/**
 * A student's WPM across their attempts in order. Non-qualifying attempts are
 * hollow markers with a status ring, so the shape is readable without color.
 */
export default function ProgressionChart({ points, height = 150, className = '' }: ProgressionChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 flex items-center justify-center ${className}`} style={{ height }}>
        No attempts yet.
      </div>
    );
  }
  const W = 640;
  const H = height;
  const pad = { top: 18, right: 20, bottom: 26, left: 36 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;
  const maxY = Math.max(10, ...points.map((p) => p.wpm)) * 1.15;
  const x = (i: number) => (points.length === 1 ? pad.left + iw / 2 : pad.left + (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.top + ih - (v / maxY) * ih;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.wpm).toFixed(1)}`).join(' ');
  const step = maxY > 150 ? 50 : maxY > 60 ? 25 : 10;
  const yTicks: number[] = [];
  for (let v = 0; v <= maxY; v += step) yTicks.push(v);
  const best = points.reduce((m, p, i) => (p.qualified && p.wpm > points[m].wpm ? i : m), points.findIndex((p) => p.qualified) >= 0 ? points.findIndex((p) => p.qualified) : 0);
  const h = hover !== null ? points[hover] : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`w-full h-auto select-none ${className}`} role="img" aria-label="WPM per attempt" onMouseLeave={() => setHover(null)}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke={C.grid} strokeWidth={1} />
          <text x={pad.left - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill={C.ink}>{v}</text>
        </g>
      ))}
      <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} stroke={C.axis} strokeWidth={1} />
      <path d={d} fill="none" stroke={C.line} strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i} onMouseEnter={() => setHover(i)}>
          <rect x={x(i) - 14} y={pad.top} width={28} height={ih} fill="transparent" />
          {p.qualified ? (
            <circle cx={x(i)} cy={y(p.wpm)} r={i === best ? 5.5 : 4.5} fill={C.line} stroke="#fff" strokeWidth={2} />
          ) : (
            <circle cx={x(i)} cy={y(p.wpm)} r={4.5} fill="#fff" stroke={C.bad} strokeWidth={2} />
          )}
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill={C.ink}>{p.label}</text>
          {i === best && p.qualified && (
            <text x={x(i)} y={y(p.wpm) - 10} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0f172a">{p.wpm}</text>
          )}
        </g>
      ))}
      {h && (
        <text x={W - pad.right} y={12} textAnchor="end" fontSize={10} fill={C.ink}>
          {h.label}: {h.wpm} WPM · {h.accuracy}%{h.qualified ? '' : ' · below minimum accuracy'}
        </text>
      )}
    </svg>
  );
}
