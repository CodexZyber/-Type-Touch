'use client';

import React, { useEffect, useState } from 'react';
import { AttemptTimelinePoint } from '@/types';
import TimelineChart from '@/components/charts/TimelineChart';
import ProgressionChart from '@/components/charts/ProgressionChart';
import { formatDateTime } from '@/lib/utils/timer';
import { X } from 'lucide-react';

interface DetailAttempt {
  id: string;
  round: 'QUALIFIER' | 'FINAL';
  completed_at: string;
  elapsed_seconds: number;
  wpm: number;
  wpm_display: number;
  raw_wpm: number;
  accuracy: number;
  consistency: number;
  correct_characters: number;
  incorrect_characters: number;
  total_keystrokes: number;
  incorrect_keystrokes: number;
  corrections: number;
  qualified: boolean;
  timeline: AttemptTimelinePoint[];
}

interface StudentDetailProps {
  participantId: string;
  rank: number | null;
  bestAttemptId?: string | null;
  round?: 'QUALIFIER' | 'FINAL';
  onClose: () => void;
}

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

/**
 * Slide-over with one student's full performance: best-attempt speed graph,
 * WPM progression across attempts, and per-attempt metrics.
 */
export default function StudentDetail({ participantId, rank, bestAttemptId, round = 'QUALIFIER', onClose }: StudentDetailProps) {
  const [data, setData] = useState<{ participant: { name: string; student_id: string }; attempts: DetailAttempt[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leaderboard/participant?participantId=${encodeURIComponent(participantId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.success) setData(d);
        else setError(d.error || 'Could not load');
      })
      .catch(() => !cancelled && setError('Could not load'));
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const attempts = (data?.attempts || []).filter((a) => a.round === round);
  const best =
    attempts.find((a) => a.id === bestAttemptId) ||
    [...attempts].filter((a) => a.qualified).sort((a, b) => b.wpm - a.wpm)[0] ||
    attempts[attempts.length - 1];
  const avg = (key: keyof DetailAttempt) =>
    attempts.length ? Math.round((attempts.reduce((s, a) => s + Number(a[key] || 0), 0) / attempts.length) * 10) / 10 : 0;
  const totalMistypes = attempts.reduce((s, a) => s + (a.incorrect_keystrokes || 0), 0);
  const totalKeys = attempts.reduce((s, a) => s + (a.total_keystrokes || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <aside
        className="h-full w-full max-w-2xl bg-white shadow-card-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Student performance"
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <span className="ts-eyebrow block">{round === 'FINAL' ? 'Grand Final' : 'Performance'}</span>
            <h2 className="text-xl font-bold text-slate-900 truncate">
              {data ? data.participant.name : 'Loading…'}
              {rank !== null && <span className="ml-2 text-sm font-semibold text-indigo-700">#{rank}</span>}
            </h2>
            {data && <div className="text-xs font-mono text-slate-500">{data.participant.student_id}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error ? (
          <div className="p-6 text-sm text-red-700">{error}</div>
        ) : !data ? (
          <div className="p-10 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          </div>
        ) : attempts.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No attempts in this round yet.</div>
        ) : (
          <div className="p-6 space-y-7">
            {/* Best attempt */}
            {best && (
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-900">Best attempt</h3>
                  <span className="text-[11px] text-slate-500">{formatDateTime(best.completed_at)}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                  <Metric label="WPM" value={best.wpm_display} sub={`raw ${Math.round(best.raw_wpm)}`} />
                  <Metric label="Accuracy" value={`${best.accuracy}%`} sub={`${best.incorrect_keystrokes} mistypes`} />
                  <Metric label="Consistency" value={`${Math.round(best.consistency)}%`} />
                  <Metric label="Corrected" value={best.corrections} sub={`${best.incorrect_characters} left`} />
                </div>
                <TimelineChart points={best.timeline || []} durationSeconds={Math.ceil(best.elapsed_seconds)} height={170} />
              </section>
            )}

            {/* Progression */}
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">Attempts</h3>
                <span className="text-[11px] text-slate-500">
                  {attempts.length} attempt{attempts.length === 1 ? '' : 's'} · avg {avg('wpm_display')} WPM · {avg('accuracy')}% ·{' '}
                  {totalKeys ? Math.round((1 - totalMistypes / totalKeys) * 1000) / 10 : 0}% keystroke accuracy overall
                </span>
              </div>
              <ProgressionChart
                points={attempts.map((a, i) => ({ label: `#${i + 1}`, wpm: a.wpm_display, accuracy: a.accuracy, qualified: a.qualified, at: a.completed_at }))}
                height={150}
              />
              <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2 text-right">WPM</th>
                      <th className="px-3 py-2 text-right">Raw</th>
                      <th className="px-3 py-2 text-right">Acc</th>
                      <th className="px-3 py-2 text-right">Consist.</th>
                      <th className="px-3 py-2 text-right">Mistypes</th>
                      <th className="px-3 py-2 text-right hidden sm:table-cell">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attempts.map((a, i) => (
                      <tr key={a.id} className={a.id === best?.id ? 'bg-indigo-50/60' : ''}>
                        <td className="px-3 py-2 text-slate-500">
                          {i + 1}
                          {!a.qualified && <span className="ml-1 text-red-600" title="Below minimum accuracy">✕</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">{a.wpm_display}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{Math.round(a.raw_wpm)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{a.accuracy}%</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{Math.round(a.consistency)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{a.incorrect_keystrokes}</td>
                        <td className="px-3 py-2 text-right text-slate-400 hidden sm:table-cell">{formatDateTime(a.completed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
