'use client';

import React from 'react';
import { AdminStats } from '@/types';
import { getEventTimerInfo } from '@/lib/utils/timer';
import { Trophy, Users, CheckCircle2, Flame, Crown, Clock } from 'lucide-react';

interface StatusPanelProps {
  stats: AdminStats;
  serverOffsetMs: number;
}

export default function StatusPanel({ stats, serverOffsetMs }: StatusPanelProps) {
  const { event, totalParticipants, totalAttempts, qualifiedParticipants, finalists } = stats;

  const timerInfo = getEventTimerInfo(
    event.status,
    event.start_time,
    event.end_time,
    event.test_duration,
    serverOffsetMs
  );

  const leader = stats.topParticipants[0];

  return (
    <div className="w-full rounded-3xl p-6 sm:p-8 glass-panel-glow border border-orange-500/25 shadow-apple-card relative overflow-hidden mb-8">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header bar: Title & Live Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-orange-400 font-bold block mb-1">
            CONTROL CENTER
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            {event.name || 'TENSOR MACTOBER'}
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          <div
            className={`flex items-center space-x-2.5 px-4 py-2 rounded-full font-mono text-xs font-bold border ${
              event.status === 'LIVE'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-glow-orange'
                : event.status === 'ENDED'
                ? 'bg-red-950/60 text-red-300 border-red-500/40'
                : 'bg-zinc-900 text-zinc-400 border-white/10'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              {event.status === 'LIVE' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  event.status === 'LIVE'
                    ? 'bg-emerald-400'
                    : event.status === 'ENDED'
                    ? 'bg-red-400'
                    : 'bg-zinc-400'
                }`}
              ></span>
            </span>
            <span>{event.status === 'LIVE' ? '● LIVE' : event.status}</span>
          </div>

          {event.status === 'LIVE' && (
            <div className="flex items-center space-x-2 px-4 py-2 rounded-full bg-black/60 border border-white/15 text-xs font-mono font-bold text-white">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span>{timerInfo.formattedRemaining} REMAINING</span>
            </div>
          )}
        </div>
      </div>

      {/* Middle: 3 Core Metrics (Participants, Attempts, Qualified) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className="p-5 rounded-2xl bg-black/40 border border-white/10">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono uppercase text-zinc-400">Participants</span>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">
            {totalParticipants}
          </div>
          <span className="text-[11px] text-zinc-500">Registered seats</span>
        </div>

        <div className="p-5 rounded-2xl bg-black/40 border border-white/10">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Flame className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono uppercase text-zinc-400">Attempts</span>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">
            {totalAttempts}
          </div>
          <span className="text-[11px] text-zinc-500">Completed {event.test_duration || 60}s rounds</span>
        </div>

        <div className="p-5 rounded-2xl bg-black/40 border border-white/10">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono uppercase text-zinc-400">Qualified</span>
          </div>
          <div className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
            {qualifiedParticipants}
          </div>
          <span className="text-[11px] text-zinc-500">Passed {event.minimum_accuracy || 85}% accuracy rule</span>
        </div>
      </div>

      {/* Bottom Showcase: Current Leader & Finalists (Requirement 29) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
        {/* Current Leader */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🥇</span>
            <div>
              <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">
                CURRENT LEADER
              </span>
              <div className="text-base font-bold text-white">
                {leader ? leader.name : 'Awaiting qualification'}
              </div>
              {leader && (
                <div className="text-[11px] font-mono text-zinc-400">{leader.student_id}</div>
              )}
            </div>
          </div>
          {leader && (
            <div className="text-right">
              <div className="text-xl font-black font-mono text-amber-300">
                {leader.best_wpm} WPM
              </div>
              <div className="text-xs font-mono text-zinc-400">{leader.best_accuracy}% Acc</div>
            </div>
          )}
        </div>

        {/* Finalists (Top 2) */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-orange-400 font-bold flex items-center space-x-1 mb-1">
              <Crown className="w-3.5 h-3.5" />
              <span>FINALISTS (TOP 2 ADVANCE)</span>
            </span>
            {finalists.length >= 2 ? (
              <div className="space-y-1 text-xs font-mono">
                <div className="text-white font-semibold">
                  🥇 {finalists[0].name} — <span className="text-amber-400">{finalists[0].best_wpm} WPM</span>
                </div>
                <div className="text-zinc-300 font-semibold">
                  🥈 {finalists[1].name} — <span className="text-slate-300">{finalists[1].best_wpm} WPM</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-400 font-mono">
                Top 2 will be determined as scores roll in.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
