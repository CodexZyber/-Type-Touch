'use client';

import React from 'react';
import Link from 'next/link';
import { LeaderboardEntry } from '@/types';
import { Trophy, ChevronRight } from 'lucide-react';

interface LiveSidebarLeaderboardProps {
  entries: LeaderboardEntry[];
  currentParticipantId?: string;
  loading?: boolean;
  finalistsCount?: number;
  minimumAccuracy?: number;
}

export default function LiveSidebarLeaderboard({
  entries,
  currentParticipantId,
  loading,
  finalistsCount = 2,
  minimumAccuracy = 85,
}: LiveSidebarLeaderboardProps) {
  const topList = entries.slice(0, 10);
  const userEntry = entries.find((e) => e.participant_id === currentParticipantId);

  return (
    <aside className="w-full lg:w-80 rounded-2xl bg-white border border-slate-200 shadow-card shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900">Leaderboard</h3>
        </div>
        <Link
          href="/leaderboard"
          className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center"
        >
          View all
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading && entries.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="py-10 px-5 text-center text-xs text-slate-500">
          No qualifying scores yet. Be the first on the board.
        </div>
      ) : (
        <ol className="divide-y divide-slate-100">
          {topList.map((entry) => {
            const isCurrentUser = entry.participant_id === currentParticipantId;
            const isFinalist = entry.rank <= finalistsCount;
            return (
              <li
                key={entry.participant_id}
                className={`flex items-center justify-between px-5 py-2.5 text-sm ${
                  isCurrentUser ? 'bg-indigo-50' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      entry.rank === 1
                        ? 'bg-amber-100 text-amber-700'
                        : isFinalist
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {entry.rank}
                  </span>
                  <span className={`truncate ${isCurrentUser ? 'font-bold text-indigo-800' : 'font-medium text-slate-800'}`}>
                    {entry.name}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-slate-900 font-semibold shrink-0">
                  {entry.best_wpm}
                  <span className="text-[10px] text-slate-400 font-sans font-medium ml-1">WPM</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {currentParticipantId && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs">
          {userEntry ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Your rank</span>
              <span className="font-bold text-indigo-700">
                #{userEntry.rank} · {userEntry.best_wpm} WPM
              </span>
            </div>
          ) : (
            <span className="text-slate-500">Finish an attempt at {minimumAccuracy}%+ accuracy to rank.</span>
          )}
        </div>
      )}
    </aside>
  );
}
