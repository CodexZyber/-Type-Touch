'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChampionshipEvent, Participant, LeaderboardEntry } from '@/types';
import { getEventTimerInfo } from '@/lib/utils/timer';
import { loadVerifiedParticipant } from '@/lib/utils/participant-session';
import TypingInterface from '@/components/contest/TypingInterface';
import LiveSidebarLeaderboard from '@/components/contest/LiveSidebarLeaderboard';
import { 
  Trophy, 
  Timer, 
  Crown, 
  AlertCircle, 
  ArrowRight, 
  UserPlus, 
  Clock, 
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

export default function ContestPage() {
  const router = useRouter();
  const [event, setEvent] = useState<ChampionshipEvent | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [eventTimerText, setEventTimerText] = useState('');

  // Quick Registration State if unregistered
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regStudentId, setRegStudentId] = useState('');
  const [regError, setRegError] = useState<string | null>(null);

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

  // Fetch Event & Leaderboard
  const loadData = async () => {
    try {
      const [eventRes, lbRes] = await Promise.all([
        fetch('/api/event'),
        fetch('/api/leaderboard'),
      ]);

      const eventData = await eventRes.json();
      const lbData = await lbRes.json();

      if (eventData.success && eventData.event) {
        setEvent(eventData.event);
        if (eventData.serverTime) {
          const sTime = new Date(eventData.serverTime).getTime();
          setServerOffsetMs(sTime - Date.now());
        }
      }

      if (lbData.success && lbData.leaderboard) {
        setLeaderboard(lbData.leaderboard);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 5s debounced sync
    return () => clearInterval(interval);
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
        setEventTimerText(`${info.formattedRemaining} REMAINING`);
      } else if (event.status === 'NOT_STARTED') {
        setEventTimerText('EVENT NOT STARTED');
      } else {
        setEventTimerText('EVENT ENDED');
      }
    };

    tick();
    const timerInterval = setInterval(tick, 1000);
    return () => clearInterval(timerInterval);
  }, [event, serverOffsetMs]);

  // Handle Quick Registration
  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regStudentId.trim()) {
      setRegError('Please provide your name and student ID.');
      return;
    }

    try {
      let sessionId = localStorage.getItem('tensor_mactober_session_id');
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('tensor_mactober_session_id', sessionId);
      }

      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event?.id,
          name: regName.trim(),
          studentId: regStudentId.trim(),
          sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register');
      }

      localStorage.setItem('tensor_mactober_participant', JSON.stringify(data.participant));
      setParticipant(data.participant);
      setIsRegisterOpen(false);
    } catch (err: any) {
      setRegError(err.message || 'Registration failed');
    }
  };

  if (loading && !event) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-mono text-zinc-400">Loading championship arena...</p>
        </div>
      </div>
    );
  }

  // 1. STATE: NOT_STARTED (Requirement 5)
  if (event?.status === 'NOT_STARTED') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg p-10 rounded-3xl glass-panel border border-white/10 text-center animate-fade-in shadow-apple-card">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-white/10 flex items-center justify-center text-zinc-400 mx-auto mb-6">
            <Clock className="w-8 h-8" />
          </div>

          <span className="text-xs font-mono uppercase tracking-[0.2em] text-orange-400 font-bold block mb-2">
            PRE-CHAMPIONSHIP STAGE
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 tracking-tight">
            The championship hasn't started yet.
          </h2>

          <p className="text-sm text-zinc-400 mb-8 max-w-sm mx-auto leading-relaxed">
            The host has not initiated the live countdown. Typing attempts are currently locked. Stand by at your keys.
          </p>

          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-6">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                Attempt Duration
              </span>
              <span className="text-lg font-bold font-mono text-white">
                {event.test_duration || 60} Seconds
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                Min Accuracy
              </span>
              <span className="text-lg font-bold font-mono text-orange-400">
                {event.minimum_accuracy || 85}%
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-4">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white glass-panel border border-white/10 transition-colors"
            >
              Back to Overview
            </Link>
            <Link
              href="/admin"
              className="px-5 py-2.5 rounded-xl text-xs font-medium text-orange-400 hover:text-orange-300 glass-panel border border-orange-500/20 transition-colors"
            >
              Host Dashboard
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
        <div className="w-full max-w-xl p-10 rounded-3xl glass-panel-glow border border-amber-500/30 text-center animate-fade-in shadow-apple-card">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-6 shadow-glow-gold">
            <Trophy className="w-8 h-8" />
          </div>

          <span className="text-xs font-mono uppercase tracking-[0.2em] text-amber-400 font-bold block mb-2">
            OFFICIAL RESULTS
          </span>

          <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            The competition has ended.
          </h2>

          <p className="text-sm text-zinc-400 mb-8 max-w-md mx-auto">
            All typing attempts are permanently closed. Congratulations to all participants.
          </p>

          {/* Top 2 Finalists Display */}
          <div className="p-6 rounded-2xl bg-black/40 border border-white/10 mb-8 text-left">
            <div className="text-xs font-mono uppercase text-amber-400 font-bold tracking-wider mb-4 flex items-center justify-between">
              <span>GRAND FINALISTS</span>
              <Crown className="w-4 h-4 text-amber-400" />
            </div>

            {finalists.length >= 2 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🥇</span>
                    <div>
                      <div className="font-bold text-white text-base">{finalists[0].name}</div>
                      <div className="text-[11px] font-mono text-zinc-400">{finalists[0].student_id}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black font-mono text-amber-300">{finalists[0].best_wpm} WPM</div>
                    <div className="text-[11px] font-mono text-zinc-400">{finalists[0].best_accuracy}% Acc</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-500/10 border border-slate-500/30">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🥈</span>
                    <div>
                      <div className="font-bold text-white text-base">{finalists[1].name}</div>
                      <div className="text-[11px] font-mono text-zinc-400">{finalists[1].student_id}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black font-mono text-slate-300">{finalists[1].best_wpm} WPM</div>
                    <div className="text-[11px] font-mono text-zinc-400">{finalists[1].best_accuracy}% Acc</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-400 py-3 text-center">
                Reviewing final standings...
              </div>
            )}
          </div>

          <div className="flex items-center justify-center space-x-4">
            <Link
              href="/leaderboard"
              className="px-6 py-3 rounded-xl text-xs font-semibold text-white glass-panel hover:bg-white/10 transition-colors border border-white/10"
            >
              View Full Standings
            </Link>
            <Link
              href="/final"
              className="px-6 py-3 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 transition-all shadow-glow-orange flex items-center space-x-1.5"
            >
              <span>Watch Grand Final</span>
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 p-4 rounded-2xl glass-panel border border-white/10">
        <div className="flex items-center space-x-3">
          <div className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-emerald-400">CHAMPIONSHIP LIVE</span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs font-mono text-zinc-300 font-bold">{eventTimerText}</span>
            </div>
            <div className="text-[11px] text-zinc-400">
              {event?.max_attempts ? `${event?.max_attempts} attempts maximum` : 'Unlimited attempts'} • {event?.test_duration || 60}-second tests • Min {event?.minimum_accuracy || 85}% accuracy
            </div>
          </div>
        </div>

        {participant ? (
          <div className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold text-xs">
              {participant.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-none mb-0.5">{participant.name}</div>
              <div className="text-[10px] font-mono text-zinc-400 leading-none">{participant.student_id}</div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors flex items-center space-x-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register to Compete</span>
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
              onAttemptSubmitted={loadData}
            />
          ) : (
            <div className="p-12 rounded-3xl glass-panel border border-white/10 text-center">
              <UserPlus className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Participant Registration Required</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6">
                Please enter your Full Name and Student ID to join the competition and record your official typing scores.
              </p>
              <button
                onClick={() => setIsRegisterOpen(true)}
                className="px-8 py-3.5 rounded-xl font-bold text-black bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-sm shadow-glow-orange"
              >
                Register Now
              </button>
            </div>
          )}
        </div>

        {/* Live Leaderboard Sidebar (Requirement 11) */}
        <LiveSidebarLeaderboard
          entries={leaderboard}
          currentParticipantId={participant?.id}
          loading={loading}
        />
      </div>

      {/* Quick Registration Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-2xl p-7 glass-panel-glow border border-orange-500/30 shadow-apple-card relative">
            <h3 className="text-lg font-bold text-white mb-1">Enter Participant Information</h3>
            <p className="text-xs text-zinc-400 mb-4">Required to track your WPM and rank</p>

            {regError && (
              <div className="p-2.5 mb-4 rounded-lg bg-red-950/60 border border-red-500/30 text-red-300 text-xs">
                {regError}
              </div>
            )}

            <form onSubmit={handleQuickRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arya Sovakar"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">Student ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MAC-101"
                  value={regStudentId}
                  onChange={(e) => setRegStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono uppercase text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-black bg-orange-500 hover:bg-orange-400 transition-colors text-sm"
                >
                  Confirm & Start
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
