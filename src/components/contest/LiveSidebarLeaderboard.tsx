'use client';

import React from 'react';
import Link from 'next/link';
import { LeaderboardEntry } from '@/types';
import { Trophy, ChevronRight, User } from 'lucide-react';

interface LiveSidebarLeaderboardProps {
  entries: LeaderboardEntry[];
  currentParticipantId?: string;
  loading?: boolean;
}

export default function LiveSidebarLeaderboard({
  entries,
  currentParticipantId,
  loading,
}: LiveSidebarLeaderboardProps) {
  const topList = entries.slice(0, 10);
  const userEntry = entries.find((e) => e.participant_id === currentParticipantId);
  const isUserInTop10 = userEntry ? userEntry.rank <= 10 : false;

  return (
    <div className="w-full lg:w-80 rounded-2xl p-5 glass-panel border border-white/10 shrink-0">
      <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10">
        <div className="flex items-center space-x-2">
          <Trophy className="w-4 h-4 text-orange-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
            LIVE LEADERBOARD
          </h3>
        </div>
        <Link
          href="/leaderboard"
          className="text-[11px] font-mono text-zinc-400 hover:text-orange-400 transition-colors flex items-center"
        >
          View all
          <ChevronRight className="w-3 h-3 ml-0.5" />
        </Link>
      </div>

      {loading && entries.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-500 font-mono">
          Loading leaderboard...
        </div>
      ) : entries.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-500">
          No qualifying scores yet. Be the first!
        </div>
      ) : (
        <div className="space-y-1.5">
          {topList.map((entry) => {
            const isCurrentUser = entry.participant_id === currentParticipantId;
            const isRank1 = entry.rank === 1;
            const isRank2 = entry.rank === 2;

            return (
              <div
                key={entry.participant_id}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-colors ${
                  isCurrentUser
                    ? 'bg-orange-500/15 border border-orange-500/40 text-orange-200'
                    : 'hover:bg-white/5 text-zinc-300'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate mr-2">
                  <span className="w-5 text-center shrink-0 font-bold">
                    {isRank1 ? '🥇' : isRank2 ? '🥈' : `${entry.rank}.`}
                  </span>
                  <span
                    className={`truncate font-medium ${
                      isCurrentUser ? 'text-orange-300 font-bold' : 'text-zinc-200'
                    }`}
                  >
                    {entry.name}
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="font-bold text-white">{entry.best_wpm}</span>
                  <span className="text-[10px] text-zinc-400">WPM</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Student position banner if outside Top 10 or unranked */}
      {currentParticipantId && (
        <div className="mt-4 pt-3.5 border-t border-white/10">
          {userEntry ? (
            !isUserInTop10 ? (
              <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-between text-xs font-mono text-orange-300">
                <span className="text-zinc-400">Your position:</span>
                <span className="font-bold text-orange-400">#{userEntry.rank} ({userEntry.best_wpm} WPM)</span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs font-mono text-emerald-300">
                <span className="text-zinc-400">Your rank:</span>
                <span className="font-bold text-emerald-400">#{userEntry.rank} • Top 10!</span>
              </div>
            )
          ) : (
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center text-[11px] text-zinc-400 font-mono">
              Complete an attempt ≥ 85% to rank
            </div>
          )}
        </div>
      )}
    </div>
  );
}
