'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChampionshipEvent, Participant } from '@/types';
import { getEventTimerInfo } from '@/lib/utils/timer';
import { loadVerifiedParticipant } from '@/lib/utils/participant-session';
import RegisterModal from '@/components/contest/RegisterModal';
import { ArrowRight, Trophy, Timer, Target, Repeat } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [event, setEvent] = useState<ChampionshipEvent | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [timerDisplay, setTimerDisplay] = useState<string>('');
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  const fetchEvent = async () => {
    try {
      const res = await fetch('/api/event');
      const data = await res.json();
      if (data.success && data.event) {
        setEvent(data.event);
        if (data.serverTime) {
          setServerOffsetMs(new Date(data.serverTime).getTime() - Date.now());
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEvent();
    const interval = setInterval(fetchEvent, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadVerifiedParticipant().then((verified) => {
      if (verified) setParticipant(verified);
    });
  }, []);

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
      if (event.status === 'LIVE') setTimerDisplay(`${info.formattedRemaining} left`);
      else if (event.status === 'NOT_STARTED') setTimerDisplay('Waiting for the host to start');
      else setTimerDisplay('The contest has ended');
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [event, serverOffsetMs]);

  const enterArena = () => {
    if (participant) router.push('/contest');
    else setIsRegisterOpen(true);
  };

  const statusDot =
    event?.status === 'LIVE' ? 'bg-emerald-500' : event?.status === 'ENDED' ? 'bg-slate-400' : 'bg-amber-500';

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Brand backdrop: faint dot grid + the logo's green chevron as an accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-16 h-[520px] opacity-[0.35]"
        style={{ backgroundImage: 'radial-gradient(rgba(67,56,202,0.18) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 70%)' }}
      />
      <section className="relative max-w-3xl mx-auto px-4 sm:px-6 w-full pt-16 sm:pt-24 pb-16 text-center animate-fade-in">
        {/* Status */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-card text-xs font-medium text-slate-600 mb-8">
          <span className="relative flex h-2 w-2">
            {event?.status === 'LIVE' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${statusDot}`} />
          </span>
          <span className="font-semibold text-slate-800">
            {event?.status === 'LIVE' ? 'Live now' : event?.status === 'ENDED' ? 'Ended' : 'Not started'}
          </span>
          {timerDisplay && (
            <>
              <span className="text-slate-300">|</span>
              <span className="font-mono tabular-nums">{timerDisplay}</span>
            </>
          )}
        </div>

        {/* Hero */}
        <span className="ts-eyebrow mb-4 flex items-center justify-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 13h9v9" stroke="#1ecc90" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 7h9v9" stroke="#1ecc90" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Tensor School of CS &amp; AI
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.05] mb-5">
          {event?.name || 'Typing Championship'}
        </h1>
        <p className="text-lg sm:text-xl text-slate-500 max-w-xl mx-auto mb-10">
          {event?.subtitle || 'Type fast. Type clean. Climb the leaderboard.'}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={enterArena} className="btn-primary w-full sm:w-auto px-8 py-4 text-base group">
            <span>Enter Contest Arena</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <Link href="/leaderboard" className="btn-secondary w-full sm:w-auto px-8 py-4 text-base">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Leaderboard</span>
          </Link>
        </div>

        {participant && (
          <p className="mt-4 text-xs text-slate-500">
            Signed in as <span className="font-semibold text-slate-800">{participant.name}</span>{' '}
            <span className="font-mono">({participant.student_id})</span>
          </p>
        )}

        {/* Rules at a glance */}
        <dl className="mt-14 grid grid-cols-3 gap-3 max-w-xl mx-auto">
          <div className="rounded-2xl bg-white border border-slate-200 p-4">
            <dt className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              <Timer className="w-3.5 h-3.5 text-indigo-700" /> Test
            </dt>
            <dd className="text-xl font-bold text-slate-900">{event?.test_duration || 60}s</dd>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-4">
            <dt className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              <Target className="w-3.5 h-3.5 text-indigo-700" /> Min accuracy
            </dt>
            <dd className="text-xl font-bold text-slate-900">{event?.minimum_accuracy || 85}%</dd>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-4">
            <dt className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              <Repeat className="w-3.5 h-3.5 text-indigo-700" /> Attempts
            </dt>
            <dd className="text-xl font-bold text-slate-900">{event?.max_attempts ?? '∞'}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          Only your best qualifying attempt counts. Top {event?.finalists_count || 2} advance to the Grand Final, where a new
          passage is drawn. Every result comes with a second-by-second speed graph.
        </p>
      </section>

      {isRegisterOpen && (
        <RegisterModal
          eventId={event?.id}
          onClose={() => setIsRegisterOpen(false)}
          onRegistered={(p) => {
            setParticipant(p);
            setIsRegisterOpen(false);
            router.push('/contest');
          }}
        />
      )}
    </div>
  );
}
