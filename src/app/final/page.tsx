'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { LeaderboardEntry, ChampionshipEvent, Participant } from '@/types';
import TypingInterface from '@/components/contest/TypingInterface';
import { 
  Trophy, 
  Crown, 
  Swords, 
  Flame, 
  Timer, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  Play
} from 'lucide-react';

export default function GrandFinalPage() {
  const [event, setEvent] = useState<ChampionshipEvent | null>(null);
  const [finalists, setFinalists] = useState<LeaderboardEntry[]>([]);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFinalShowdownActive, setIsFinalShowdownActive] = useState(false);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

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

  const fetchData = async () => {
    try {
      const [lbRes, eventRes] = await Promise.all([
        fetch('/api/leaderboard'),
        fetch('/api/event'),
      ]);

      const lbData = await lbRes.json();
      const eventData = await eventRes.json();

      if (lbData.success && lbData.leaderboard) {
        const finalistCount = Number(eventData.event?.finalists_count) || 2;
          setFinalists(lbData.leaderboard.slice(0, finalistCount));
      }

      if (eventData.success && eventData.event) {
        setEvent(eventData.event);
        if (eventData.serverTime) {
          const sTime = new Date(eventData.serverTime).getTime();
          setServerOffsetMs(sTime - Date.now());
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const isUserAFinalist = Boolean(
    participant && finalists.some((f) => f.participant_id === participant.id)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full animate-fade-in">
      {/* Grand Final Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold uppercase tracking-widest mb-3">
          <Crown className="w-3.5 h-3.5" />
          <span>STAGE 2: THE CLIMAX</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight mb-4">
          GRAND FINALISTS
        </h1>

        <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
          The top {event?.finalists_count || 2} qualifying candidates advance to the Grand Final. Each finalist competes in the final typing round for one crown.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-zinc-500">
          Determining finalists from official leaderboard...
        </div>
      ) : finalists.length < (Number(event?.finalists_count) || 2) ? (
        <div className="p-10 rounded-3xl glass-panel border border-white/10 text-center max-w-lg mx-auto">
          <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Finalists Pending</h3>
          <p className="text-xs text-zinc-400 mb-6">
            At least {event?.finalists_count || 2} qualifying participants (meeting the minimum accuracy requirement) are required to populate the Grand Final.
          </p>
          <Link
            href="/contest"
            className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs transition-colors"
          >
            Enter Contest Arena
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Configured Finalist Lineup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {finalists.map((finalist, index) => (
              <div
                key={finalist.participant_id}
                className={`p-6 sm:p-8 rounded-3xl bg-gradient-to-br via-black/60 to-black/80 border relative overflow-hidden ${
                  index === 0
                    ? 'from-amber-500/20 border-amber-500/40 shadow-glow-gold'
                    : index === 1
                      ? 'from-slate-400/20 border-slate-400/40'
                      : 'from-orange-500/10 border-orange-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                  </span>
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                      index === 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : index === 1
                          ? 'bg-slate-500/20 text-slate-300 border-slate-400/40'
                          : 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                    }`}
                  >
                    SEED #{index + 1}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
                  {finalist.name}
                </h2>
                <p className="text-xs font-mono text-zinc-400 mb-6">
                  {finalist.student_id}
                </p>

                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-black/40 border border-white/10">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 block uppercase">
                      Qualifying Speed
                    </span>
                    <span
                      className={`text-xl sm:text-2xl font-black font-mono ${
                        index === 0
                          ? 'text-amber-300'
                          : index === 1
                            ? 'text-slate-200'
                            : 'text-orange-200'
                      }`}
                    >
                      {finalist.best_wpm} WPM
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 block uppercase">
                      Accuracy
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono text-white">
                      {finalist.best_accuracy}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Showdown Typing Stage */}
          <div className="p-8 rounded-3xl glass-panel border border-white/10 text-center">
            {isFinalShowdownActive && participant && isUserAFinalist ? (
              <div className="space-y-4">
                <div className="inline-flex items-center space-x-2 text-xs font-mono text-orange-400 font-bold uppercase mb-2">
                  <Swords className="w-4 h-4" />
                  <span>Grand Final Live Arena</span>
                </div>
                <TypingInterface
                  event={{
                    ...event!,
                    status: 'LIVE',
                  }}
                  participant={participant}
                  serverOffsetMs={serverOffsetMs}
                  onAttemptSubmitted={fetchData}
                />
              </div>
            ) : (
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mx-auto">
                  <Swords className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Grand Final Round</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Qualified finalists can enter the final round and complete the official typing test using the event settings.
                </p>

                {isUserAFinalist ? (
                  <button
                    onClick={() => setIsFinalShowdownActive(true)}
                    className="px-8 py-3.5 rounded-xl font-bold text-black bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 transition-all text-sm shadow-glow-orange flex items-center justify-center space-x-2 mx-auto"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>Enter Final Test</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono text-zinc-400">
                    Spectator Mode: Standings update in real time.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
