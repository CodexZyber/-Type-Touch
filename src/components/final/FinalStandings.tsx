'use client';

import React from 'react';
import { ChampionshipEvent, FinalStanding, LiveProgress } from '@/types';
import { Crown } from 'lucide-react';

interface FinalStandingsProps {
  event: ChampionshipEvent | null;
  standings: FinalStanding[];
  /** Latest streamed progress, keyed by participant id (overrides what the snapshot carried). */
  progress?: Record<string, LiveProgress>;
  currentParticipantId?: string;
  compact?: boolean;
  /** Called with the participant id when a row is clicked (e.g. to open their detail). */
  onSelect?: (participantId: string) => void;
}

/** Progress is "live" only if it is a TYPING report from the last few seconds. */
const LIVE_WINDOW_MS = 6000;

function isTypingNow(p?: LiveProgress | null): p is LiveProgress {
  return Boolean(p && p.state === 'TYPING' && Date.now() - new Date(p.updated_at).getTime() < LIVE_WINDOW_MS);
}

/**
 * The Grand Final board. Every finalist is listed from the moment they are
 * seeded; rows re-rank live as final-round attempts land, and a finalist who is
 * mid-attempt shows a moving progress bar with their live WPM.
 */
export default function FinalStandings({
  event,
  standings,
  progress = {},
  currentParticipantId,
  compact = false,
  onSelect,
}: FinalStandingsProps) {
  const finalStatus = event?.final_status || 'NOT_STARTED';
  const started = finalStatus !== 'NOT_STARTED';
  const minAcc = event?.minimum_accuracy || 85;

  // Re-sort client-side so progress events (which don't change rank) keep the order stable
  const rows = [...standings].sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    return a.seed - b.seed;
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-sm text-slate-500">
        No finalists yet. Finalists are the top {event?.finalists_count || 2} of the qualifier leaderboard.
      </div>
    );
  }

  return (
    <ol className={`space-y-${compact ? '2' : '3'}`}>
      {rows.map((row) => {
        const live = progress[row.participant_id] ?? row.live ?? null;
        const typing = isTypingNow(live);
        const isMe = row.participant_id === currentParticipantId;
        const isChampion = finalStatus === 'ENDED' && row.rank === 1;
        const isLeading = finalStatus === 'LIVE' && row.rank === 1;

        return (
          <li
            key={row.participant_id}
            onClick={onSelect ? () => onSelect(row.participant_id) : undefined}
            className={`relative overflow-hidden rounded-2xl border bg-white transition-shadow ${onSelect ? 'cursor-pointer hover:border-indigo-300' : ''} ${
              isChampion
                ? 'border-amber-300 shadow-glow-gold'
                : typing
                  ? 'border-indigo-300 shadow-card'
                  : 'border-slate-200'
            } ${isMe ? 'ring-4 ring-indigo-100' : ''}`}
          >
            {/* Live progress fill */}
            {typing && (
              <div
                className="absolute inset-y-0 left-0 bg-indigo-50 transition-[width] duration-700 ease-linear"
                style={{ width: `${live.progress}%` }}
                aria-hidden
              />
            )}

            <div className={`relative flex items-center gap-4 ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}>
              {/* Rank / seed */}
              <div
                className={`shrink-0 flex items-center justify-center rounded-xl font-bold ${
                  compact ? 'w-9 h-9 text-sm' : 'w-11 h-11 text-base'
                } ${
                  isChampion
                    ? 'bg-amber-100 text-amber-700'
                    : row.rank !== null
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-500'
                }`}
                title={row.rank !== null ? `Final rank ${row.rank}` : `Seed ${row.seed}`}
              >
                {isChampion ? <Crown className="w-5 h-5" /> : row.rank !== null ? row.rank : `S${row.seed}`}
              </div>

              {/* Identity */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-bold truncate ${compact ? 'text-sm' : 'text-base'} ${isMe ? 'text-indigo-800' : 'text-slate-900'}`}>
                    {row.name}
                  </span>
                  {isMe && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-700 text-white">YOU</span>
                  )}
                  {isChampion && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Champion
                    </span>
                  )}
                  {isLeading && !isChampion && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Leading
                    </span>
                  )}
                  {typing && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-600" />
                      </span>
                      Typing
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{row.student_id}</span>
                  <span className="text-slate-300">·</span>
                  <span>
                    Seed {row.seed} · qualified at {row.qualifier_wpm} WPM
                  </span>
                  {started && row.attempts_count > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>
                        {row.attempts_count} final attempt{row.attempts_count === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Numbers */}
              <div className="shrink-0 text-right">
                {typing ? (
                  <>
                    <div className={`font-extrabold tabular-nums text-indigo-700 ${compact ? 'text-xl' : 'text-2xl'}`}>
                      {live.wpm}
                      <span className="text-xs font-semibold text-indigo-400 ml-1">WPM</span>
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      {live.accuracy}% · {live.progress}% typed
                    </div>
                  </>
                ) : row.best_wpm !== null ? (
                  <>
                    <div className={`font-extrabold tabular-nums text-slate-900 ${compact ? 'text-xl' : 'text-2xl'}`}>
                      {row.best_wpm}
                      <span className="text-xs font-semibold text-slate-400 ml-1">WPM</span>
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">{row.best_accuracy}% accuracy</div>
                  </>
                ) : (
                  <div className="text-xs text-slate-400">
                    {started ? (finalStatus === 'ENDED' ? `No attempt ≥ ${minAcc}%` : 'Waiting…') : 'Projected'}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
