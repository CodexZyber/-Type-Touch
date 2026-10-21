'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { LeaderboardEntry, ChampionshipEvent, Participant } from '@/types';
import { formatDateTime } from '@/lib/utils/timer';
import { 
  Trophy, 
  Crown, 
  Flame, 
  Search, 
  RotateCcw, 
  Sparkles, 
  Award,
  ArrowRight
} from 'lucide-react';

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [event, setEvent] = useState<ChampionshipEvent | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Load participant from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tensor_mactober_participant');
      if (stored) {
        setParticipant(JSON.parse(stored));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Fetch Leaderboard and Event
  const fetchLeaderboard = async () => {
    try {
      const [lbRes, eventRes] = await Promise.all([
        fetch('/api/leaderboard'),
        fetch('/api/event'),
      ]);

      const lbData = await lbRes.json();
      const eventData = await eventRes.json();

      if (lbData.success && lbData.leaderboard) {
        setEntries(lbData.leaderboard);
        setLastRefreshed(new Date());
      }
      if (eventData.success && eventData.event) {
        setEvent(eventData.event);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    // High frequency interval (3s) for seamless live updates
    const interval = setInterval(fetchLeaderboard, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Filter entries by search
  const filteredEntries = entries.filter((e) => {
    const q = searchQuery.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.student_id.toLowerCase().includes(q);
  });

  const currentUserEntry = entries.find((e) => e.participant_id === participant?.id);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full animate-fade-in">
      {/* Top Banner: Grand Final Qualifier Callout (Requirement 10) */}
      <div className="mb-8 p-6 rounded-3xl glass-panel-glow border border-amber-500/30 shadow-apple-card text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <Crown className="w-3.5 h-3.5" />
            <span>TOP 2 ADVANCE TO THE GRAND FINAL</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            Championship Standings
          </h1>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
            Live rankings based on each participant's highest qualifying WPM (≥ {event?.minimum_accuracy || 85}% accuracy). Ties are broken by higher accuracy, then earlier attempt timestamp.
          </p>
        </div>
      </div>

      {/* Top 2 Finalist Podium Showcase */}
      {entries.length >= 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Rank 1 */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-black/40 to-black/60 border border-amber-500/40 relative overflow-hidden shadow-glow-gold">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-amber-400 flex items-center space-x-1.5">
                <span className="text-lg">🥇</span>
                <span>CHAMPIONSHIP LEADER (FINALIST #1)</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Grand Final Seat
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{entries[0].name}</h3>
                <span className="text-xs font-mono text-zinc-400">{entries[0].student_id}</span>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black font-mono text-amber-300">
                  {entries[0].best_wpm} <span className="text-sm font-normal text-zinc-400">WPM</span>
                </div>
                <div className="text-xs font-mono text-zinc-400">{entries[0].best_accuracy}% Accuracy</div>
              </div>
            </div>
          </div>

          {/* Rank 2 */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-400/15 via-black/40 to-black/60 border border-slate-400/40 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center space-x-1.5">
                <span className="text-lg">🥈</span>
                <span>RUNNER-UP (FINALIST #2)</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400 border border-slate-400/30 px-2 py-0.5 rounded-full">
                Grand Final Seat
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{entries[1].name}</h3>
                <span className="text-xs font-mono text-zinc-400">{entries[1].student_id}</span>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black font-mono text-slate-200">
                  {entries[1].best_wpm} <span className="text-sm font-normal text-zinc-400">WPM</span>
                </div>
                <div className="text-xs font-mono text-zinc-400">{entries[1].best_accuracy}% Accuracy</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Status Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search participant or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="flex items-center space-x-3 text-xs text-zinc-400 font-mono">
          <span className="inline-flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Sync</span>
          </span>
          <span>•</span>
          <span>{entries.length} Qualified Students</span>
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="rounded-2xl glass-panel border border-white/10 overflow-hidden shadow-apple-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[11px] font-mono uppercase text-zinc-400 tracking-wider">
                <th className="py-3.5 px-4 font-semibold text-center w-16">Rank</th>
                <th className="py-3.5 px-4 font-semibold">Student</th>
                <th className="py-3.5 px-4 font-semibold text-right">WPM</th>
                <th className="py-3.5 px-4 font-semibold text-right">Accuracy</th>
                <th className="py-3.5 px-4 font-semibold text-center">Attempts</th>
                <th className="py-3.5 px-4 font-semibold text-right hidden sm:table-cell">Best Attempt Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-zinc-500 font-mono">
                    Loading live standings...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-zinc-500 font-mono">
                    {searchQuery ? 'No participants match your search.' : 'No qualifying attempts recorded yet.'}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const isCurrent = entry.participant_id === participant?.id;
                  const isRank1 = entry.rank === 1;
                  const isRank2 = entry.rank === 2;

                  return (
                    <tr
                      key={entry.participant_id}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-orange-500/15 hover:bg-orange-500/20'
                          : isRank1
                          ? 'bg-amber-500/5 hover:bg-amber-500/10'
                          : isRank2
                          ? 'bg-slate-500/5 hover:bg-slate-500/10'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        {isRank1 ? (
                          <span className="text-xl">🥇</span>
                        ) : isRank2 ? (
                          <span className="text-xl">🥈</span>
                        ) : (
                          <span className="text-zinc-400">#{entry.rank}</span>
                        )}
                      </td>

                      {/* Student */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className={`font-semibold ${isCurrent ? 'text-orange-400' : 'text-white'}`}>
                            {entry.name}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                              YOU
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400 block mt-0.5">
                          {entry.student_id}
                        </span>
                      </td>

                      {/* WPM */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-base font-black font-mono text-white">
                          {entry.best_wpm}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 ml-1">WPM</span>
                      </td>

                      {/* Accuracy */}
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-300">
                        {entry.best_accuracy}%
                      </td>

                      {/* Attempts */}
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-zinc-400">
                        {entry.attempts_count}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-zinc-500 hidden sm:table-cell">
                        {formatDateTime(entry.last_attempt_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bottom Bar if current user is logged in */}
      {currentUserEntry && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[calc(100%-2rem)] p-4 rounded-2xl glass-panel-glow border border-orange-500/30 shadow-apple-card flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold">
              #{currentUserEntry.rank}
            </div>
            <div>
              <div className="text-xs font-bold text-white">{currentUserEntry.name}</div>
              <div className="text-[11px] font-mono text-zinc-400">
                Personal Best: <strong className="text-orange-400">{currentUserEntry.best_wpm} WPM</strong> ({currentUserEntry.best_accuracy}%)
              </div>
            </div>
          </div>

          <Link
            href="/contest"
            className="px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-orange-400 to-amber-300 hover:from-orange-300 hover:to-amber-200 transition-colors flex items-center space-x-1"
          >
            <span>Improve Score</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
