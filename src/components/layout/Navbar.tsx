'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChampionshipEvent, Participant } from '@/types';
import { getEventTimerInfo } from '@/lib/utils/timer';
import { PARTICIPANT_STORAGE_KEY, PARTICIPANT_CHANGED_EVENT, logoutParticipant } from '@/lib/utils/participant-session';
import { Keyboard, Trophy, UserRound, Crown, LogOut } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [event, setEvent] = useState<ChampionshipEvent | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [timerText, setTimerText] = useState<string>('');
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);

  // The host dashboard has its own chrome; keep the candidate nav out of it.
  const isAdmin = pathname?.startsWith('/admin');

  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const load = () => {
      try {
        const stored = localStorage.getItem(PARTICIPANT_STORAGE_KEY);
        setParticipant(stored ? JSON.parse(stored) : null);
      } catch (e) {
        setParticipant(null);
      }
    };
    load();
    // Sign-in happens in a modal without navigating
    window.addEventListener(PARTICIPANT_CHANGED_EVENT, load);
    return () => window.removeEventListener(PARTICIPANT_CHANGED_EVENT, load);
  }, [pathname]);

  const handleLogout = async () => {
    if (loggingOut) return;
    if (!window.confirm('Log out? Any attempt in progress will be lost.')) return;
    setLoggingOut(true);
    await logoutParticipant();
  };

  const refreshEvent = async () => {
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
      // offline: keep last known state
    }
  };

  useEffect(() => {
    refreshEvent();
    const interval = setInterval(refreshEvent, 8000);
    return () => clearInterval(interval);
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
      if (event.final_status === 'LIVE') {
        const finalInfo = getEventTimerInfo('LIVE', event.final_start_time, event.final_end_time, event.test_duration, serverOffsetMs);
        setTimerText(finalInfo.formattedRemaining);
      } else {
        setTimerText(event.status === 'LIVE' ? info.formattedRemaining : '');
      }
    };
    tick();
    const timerInterval = setInterval(tick, 1000);
    return () => clearInterval(timerInterval);
  }, [event, serverOffsetMs]);

  const finalStarted = Boolean(event && event.final_status !== 'NOT_STARTED');
  const navLinks = [
    { label: 'Contest Arena', href: '/contest', icon: Keyboard },
    { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    // The Grand Final only matters once it exists
    ...(finalStarted ? [{ label: 'Grand Final', href: '/final', icon: Crown }] : []),
  ];

  const finalLive = event?.final_status === 'LIVE';
  const live = finalLive || event?.status === 'LIVE';
  const statusStyles = live
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : event?.status === 'ENDED'
      ? 'bg-slate-100 text-slate-600 border-slate-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';

  const statusLabel = finalLive
    ? 'Final live'
    : event?.status === 'LIVE'
      ? 'Live'
      : event?.status === 'ENDED'
        ? event?.final_status === 'ENDED'
          ? 'Final over'
          : 'Ended'
        : 'Not started';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="Tensor School home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tensor-logo.png" alt="Tensor School of CS & AI" className="h-9 w-auto" />
          <span className="hidden sm:block h-6 w-px bg-slate-200" />
          <span className="hidden sm:block text-sm font-semibold text-slate-700 truncate max-w-[220px]">
            {event?.name || 'Typing Championship'}
          </span>
        </Link>

        {/* Candidate navigation */}
        {!isAdmin && (
          <nav className="flex items-center gap-1">
            {navLinks.map(({ label, href, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    isActive
                      ? 'text-indigo-700 bg-indigo-50'
                      : 'text-slate-600 hover:text-indigo-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden xs:inline sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Status + identity */}
        <div className="flex items-center gap-2 shrink-0">
          {event && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusStyles}`}
            >
              <span className="relative flex h-2 w-2">
                {live && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    live
                      ? 'bg-emerald-500'
                      : event.status === 'ENDED'
                        ? 'bg-slate-400'
                        : 'bg-amber-500'
                  }`}
                />
              </span>
              <span>{statusLabel}</span>
              {timerText && (
                <span className="hidden sm:inline font-mono tabular-nums pl-2 border-l border-emerald-200">
                  {timerText}
                </span>
              )}
            </div>
          )}

          {!isAdmin && participant && (
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs">
              <UserRound className="w-3.5 h-3.5 text-indigo-700" />
              <span className="font-semibold text-slate-800 max-w-[120px] truncate">{participant.name}</span>
              <span className="font-mono text-slate-500">{participant.student_id}</span>
            </div>
          )}

          {!isAdmin && participant && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Log out"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{loggingOut ? 'Logging out…' : 'Log out'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
