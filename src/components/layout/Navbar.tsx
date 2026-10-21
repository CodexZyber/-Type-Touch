'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChampionshipEvent, Participant } from '@/types';
import { getEventTimerInfo } from '@/lib/utils/timer';
import { Trophy, Flame, UserCheck, Shield, Sparkles } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [event, setEvent] = useState<ChampionshipEvent | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [timerText, setTimerText] = useState<string>('');
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);

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
  }, [pathname]);

  // Fetch active event & server clock
  const refreshEvent = async () => {
    try {
      const res = await fetch('/api/event');
      const data = await res.json();
      if (data.success && data.event) {
        setEvent(data.event);
        if (data.serverTime) {
          const serverMs = new Date(data.serverTime).getTime();
          setServerOffsetMs(serverMs - Date.now());
        }
      }
    } catch (e) {
      // offline/silent fallback
    }
  };

  useEffect(() => {
    refreshEvent();
    const interval = setInterval(refreshEvent, 8000);
    return () => clearInterval(interval);
  }, []);

  // Update countdown every second
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
        setTimerText(`${info.formattedRemaining} REMAINING`);
      } else if (event.status === 'NOT_STARTED') {
        setTimerText('NOT STARTED');
      } else {
        setTimerText('CHAMPIONSHIP ENDED');
      }
    };

    tick();
    const timerInterval = setInterval(tick, 1000);
    return () => clearInterval(timerInterval);
  }, [event, serverOffsetMs]);

  const navLinks = [
    { label: 'Overview', href: '/' },
    { label: 'Contest Arena', href: '/contest' },
    { label: 'Live Leaderboard', href: '/leaderboard' },
    { label: 'Grand Final', href: '/final' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 glass-panel">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-glow-orange group-hover:scale-105 transition-transform duration-200">
              <span className="font-mono font-black text-black text-lg">T</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-white tracking-wider text-sm">
                  {event?.organization_name || 'TENSOR'}
                </span>
                <span className="font-extrabold text-orange-400 tracking-wider text-sm">MACtober</span>
                <span className="text-[10px] font-mono text-zinc-400 border border-white/10 px-1 py-0.2 rounded">'26</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono tracking-tight -mt-0.5 truncate max-w-[180px]">
                {event?.name || 'Typing Championship'}
              </span>
            </div>
          </Link>

          {/* Demo Mode Badge */}
          {event?.is_demo && (
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <Sparkles className="w-2.5 h-2.5 mr-1 text-amber-400" />
              DEMO MODE
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
                  isActive
                    ? 'text-white bg-white/10 shadow-sm border border-white/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Status Indicator & User Info */}
        <div className="flex items-center space-x-3">
          {/* Status Badge */}
          {event && (
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-mono border backdrop-blur-md transition-colors ${
                event.status === 'LIVE'
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  : event.status === 'ENDED'
                  ? 'bg-red-950/40 text-red-300 border-red-500/30'
                  : 'bg-zinc-900/60 text-zinc-400 border-white/10'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {event.status === 'LIVE' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    event.status === 'LIVE'
                      ? 'bg-emerald-500'
                      : event.status === 'ENDED'
                      ? 'bg-red-500'
                      : 'bg-zinc-500'
                  }`}
                ></span>
              </span>
              <span className="font-semibold">
                {event.status === 'LIVE' ? 'LIVE' : event.status}
              </span>
              {timerText && event.status === 'LIVE' && (
                <span className="text-zinc-300 font-mono text-[11px] hidden sm:inline pl-1 border-l border-white/10">
                  {timerText}
                </span>
              )}
            </div>
          )}

          {/* Participant Profile Chip */}
          {participant ? (
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
              <UserCheck className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-medium text-white max-w-[100px] truncate">{participant.name}</span>
              <span className="text-[10px] font-mono text-zinc-400">({participant.student_id})</span>
            </div>
          ) : (
            <Link
              href="/#register"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-colors duration-150 shadow-sm"
            >
              Join
            </Link>
          )}

          {/* Admin link */}
          <Link
            href="/admin"
            title="Host & Admin Dashboard"
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <Shield className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
