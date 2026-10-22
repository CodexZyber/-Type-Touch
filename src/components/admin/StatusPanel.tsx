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
    <div className="w-full rounded-3xl p-6 sm:p-8 glass-panel-glow border border-indigo-200 shadow-card relative overflow-hidden mb-8">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/60 rounded-full blur-[100px] pointer-events-none" />

      {/* Header bar: Title & Live Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-indigo-700 font-bold block mb-1">
            CONTROL CENTER
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase">
            {event.name || 'TENSOR SCHOOL'}
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          <div
            className={`flex items-center space-x-2.5 px-4 py-2 rounded-full font-mono text-xs font-bold border ${
              event.status === 'LIVE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : event.status === 'ENDED'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
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
                    : 'bg-slate-400'
                }`}
              ></span>
            </span>
            <span>{event.status === 'LIVE' ? '● LIVE' : event.status}</span>
          </div>

          {event.status === 'LIVE' && (
            <div className="flex items-center space-x-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900">
              <Clock className="w-3.5 h-3.5 text-indigo-700" />
              <span>{timerInfo.formattedRemaining} REMAINING</span>
            </div>
          )}
        </div>
      </div>

      {/* Middle: 3 Core Metrics (Participants, Attempts, Qualified) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono uppercase text-slate-500">Participants</span>
          </div>
          <div className="text-3xl font-black font-mono text-slate-900 tracking-tight">
            {totalParticipants}
          </div>
          <span className="text-[11px] text-slate-500">Registered seats</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Flame className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono uppercase text-slate-500">Attempts</span>
          </div>
          <div className="text-3xl font-black font-mono text-slate-900 tracking-tight">
            {totalAttempts}
          </div>
          <span className="text-[11px] text-slate-500">Completed {event.test_duration || 60}s rounds</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono uppercase text-slate-500">Qualified</span>
          </div>
          <div className="text-3xl font-black font-mono text-emerald-600 tracking-tight">
            {qualifiedParticipants}
          </div>
          <span className="text-[11px] text-slate-500">Passed {event.minimum_accuracy || 85}% accuracy rule</span>
        </div>
      </div>

      {/* Bottom Showcase: Current Leader & Finalists (Requirement 29) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
        {/* Current Leader */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🥇</span>
            <div>
              <span className="text-[10px] font-mono uppercase text-amber-600 font-bold block">
                CURRENT LEADER
              </span>
              <div className="text-base font-bold text-slate-900">
                {leader ? leader.name : 'Awaiting qualification'}
              </div>
              {leader && (
                <div className="text-[11px] font-mono text-slate-500">{leader.student_id}</div>
              )}
            </div>
          </div>
          {leader && (
            <div className="text-right">
              <div className="text-xl font-black font-mono text-amber-600">
                {leader.best_wpm} WPM
              </div>
              <div className="text-xs font-mono text-slate-500">{leader.best_accuracy}% Acc</div>
            </div>
          )}
        </div>

        {/* Finalists (Top 2) */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-indigo-700 font-bold flex items-center space-x-1 mb-1">
              <Crown className="w-3.5 h-3.5" />
              <span>
                FINALISTS (TOP {event.finalists_count || 2} ADVANCE)
                {event.final_status === 'LIVE' ? ' · FINAL LIVE' : event.final_status === 'ENDED' ? ' · FINAL OVER' : ''}
              </span>
            </span>
            {finalists.length > 0 ? (
              <div className="space-y-1 text-xs font-mono">
                {finalists.slice(0, 3).map((f, i) => (
                  <div key={f.participant_id} className={i === 0 ? 'text-slate-900 font-semibold' : 'text-slate-600 font-semibold'}>
                    {['🥇', '🥈', '🥉'][i]} {f.name} — <span className={i === 0 ? 'text-amber-600' : 'text-slate-600'}>{f.best_wpm} WPM</span>
                  </div>
                ))}
                {finalists.length > 3 && (
                  <div className="text-slate-500">+{finalists.length - 3} more</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 font-mono">
                Top {event.finalists_count || 2} will be determined as scores roll in.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
