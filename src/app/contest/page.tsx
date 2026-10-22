'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Participant } from '@/types';
import { getEventTimerInfo } from '@/lib/utils/timer';
import { loadVerifiedParticipant } from '@/lib/utils/participant-session';
import { useLiveFeed } from '@/lib/hooks/useLiveFeed';
import TypingInterface from '@/components/contest/TypingInterface';
import LiveSidebarLeaderboard from '@/components/contest/LiveSidebarLeaderboard';
import RegisterModal from '@/components/contest/RegisterModal';
import { Trophy, Crown, ArrowRight, UserPlus, Clock } from 'lucide-react';

export default function ContestPage() {
  // Live feed: the server pushes event state + leaderboard over SSE (polling fallback inside)
  const feed = useLiveFeed();
  const { event, leaderboard, serverOffsetMs } = feed;
  const loading = !feed.loaded;
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [eventTimerText, setEventTimerText] = useState('');

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Load participant from localStorage, re-validated against the server
  useEffect(() => {
    loadVerifiedParticipant().then((verified) => {
      if (verified) {
        setParticipant(verified);
      } else {
        setIsRegisterOpen(true);
      }
    });
  }, []);

  // Update Event Timer countdown every second
  useEffect(() => {
    if (!event) return;

    const tick = () => {
      const info = getEventTimerInfo(
        event.status,
        event.start_time,
        event.end_time,
        event.test_duration,
        serverOffsetMs
      );

      if (event.status === 'LIVE') {
        setEventTimerText(`${info.formattedRemaining} remaining`);
      } else if (event.status === 'NOT_STARTED') {
        setEventTimerText('Not started');
      } else {
        setEventTimerText('Ended');
      }
    };

    tick();
    const timerInterval = setInterval(tick, 1000);
    return () => clearInterval(timerInterval);
  }, [event, serverOffsetMs]);

  if (loading && !event) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading the arena…</p>
        </div>
      </div>
    );
  }

  // 1. STATE: NOT_STARTED (Requirement 5)
  if (event?.status === 'NOT_STARTED') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg p-10 rounded-3xl glass-panel border border-slate-200 text-center animate-fade-in shadow-card">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mx-auto mb-6">
            <Clock className="w-8 h-8" />
          </div>

          <span className="ts-eyebrow block mb-2">Contest arena</span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
            The contest hasn&apos;t started yet.
          </h2>

          <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed">
            Attempts unlock the moment the host starts the clock. This page refreshes on its own, so stay here.
          </p>

          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-6">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                Attempt Duration
              </span>
              <span className="text-lg font-bold font-mono text-slate-900">
                {event.test_duration || 60} Seconds
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                Min Accuracy
              </span>
              <span className="text-lg font-bold font-mono text-indigo-700">
                {event.minimum_accuracy || 85}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Link href="/leaderboard" className="btn-secondary px-5 py-2.5 text-xs">
              View leaderboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. STATE: ENDED (Requirement 5)
  if (event?.status === 'ENDED') {
    const finalists = leaderboard.slice(0, event.finalists_count || 2);

    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-xl p-10 rounded-3xl glass-panel-glow border border-amber-200 text-center animate-fade-in shadow-card">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-6 shadow-glow-gold">
            <Trophy className="w-8 h-8" />
          </div>

          <span className="ts-eyebrow block mb-2">Official results</span>

          <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
            The contest has ended.
          </h2>

          <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">
            Attempts are closed. Well typed, everyone.
          </p>

          {/* Top 2 Finalists Display */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 mb-8 text-left">
            <div className="text-[11px] uppercase text-amber-700 font-bold tracking-wider mb-4 flex items-center justify-between">
              <span>Grand finalists</span>
              <Crown className="w-4 h-4 text-amber-600" />
            </div>

            {finalists.length >= 2 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🥇</span>
                    <div>
                      <div className="font-bold text-slate-900 text-base">{finalists[0].name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{finalists[0].student_id}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black font-mono text-amber-600">{finalists[0].best_wpm} WPM</div>
                    <div className="text-[11px] font-mono text-slate-500">{finalists[0].best_accuracy}% Acc</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100 border border-slate-300">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🥈</span>
                    <div>
                      <div className="font-bold text-slate-900 text-base">{finalists[1].name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{finalists[1].student_id}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black font-mono text-slate-600">{finalists[1].best_wpm} WPM</div>
                    <div className="text-[11px] font-mono text-slate-500">{finalists[1].best_accuracy}% Acc</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-3 text-center">
                Reviewing final standings...
              </div>
            )}
          </div>

          <div className="flex items-center justify-center space-x-4">
            <Link href="/leaderboard" className="btn-secondary px-6 py-3 text-xs">
              Full leaderboard
            </Link>
            <Link href="/final" className="btn-primary px-6 py-3 text-xs">
              <span>{event.final_status === 'LIVE' ? 'Watch the Grand Final live' : 'Grand Final'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. STATE: LIVE (Requirement 5 & 6)
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Banner: Prominent Remaining Event Time & Identity */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 p-4 rounded-2xl glass-panel border border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Live</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-mono tabular-nums text-slate-700 font-semibold">{eventTimerText}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              {event?.max_attempts ? `${event?.max_attempts} attempts maximum` : 'Unlimited attempts'} • {event?.test_duration || 60}-second tests • Min {event?.minimum_accuracy || 85}% accuracy
            </div>
          </div>
        </div>

        {participant ? (
          <div className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
              {participant.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-none mb-0.5">{participant.name}</div>
              <div className="text-[10px] font-mono text-slate-500 leading-none">{participant.student_id}</div>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsRegisterOpen(true)} className="btn-primary px-4 py-2 text-xs">
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign in to compete</span>
          </button>
        )}
      </div>

      {/* Main Arena Layout: Typing Arena on Left/Center + Live Sidebar Leaderboard on Right */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Main Typing Interface */}
        <div className="flex-1 w-full">
          {participant ? (
            <TypingInterface
              event={event!}
              participant={participant}
              serverOffsetMs={serverOffsetMs}
              onAttemptSubmitted={feed.refresh}
            />
          ) : (
            <div className="p-12 rounded-3xl glass-panel border border-slate-200 text-center">
              <UserPlus className="w-12 h-12 text-indigo-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Sign in to compete</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                Enter your name and student ID so your attempts count on the leaderboard.
              </p>
              <button onClick={() => setIsRegisterOpen(true)} className="btn-primary px-8 py-3.5">
                Sign in
              </button>
            </div>
          )}
        </div>

        {/* Live Leaderboard Sidebar (Requirement 11) */}
        <LiveSidebarLeaderboard
          entries={leaderboard}
          currentParticipantId={participant?.id}
          loading={loading}
          finalistsCount={Number(event?.finalists_count) || 2}
          minimumAccuracy={event?.minimum_accuracy || 85}
        />
      </div>

      {isRegisterOpen && (
        <RegisterModal
          eventId={event?.id}
          onRegistered={(p) => {
            setParticipant(p);
            setIsRegisterOpen(false);
          }}
        />
      )}
    </div>
  );
}
