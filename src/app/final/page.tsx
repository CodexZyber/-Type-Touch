'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Participant } from '@/types';
import { useLiveFeed } from '@/lib/hooks/useLiveFeed';
import { loadVerifiedParticipant } from '@/lib/utils/participant-session';
import { getEventTimerInfo } from '@/lib/utils/timer';
import TypingInterface from '@/components/contest/TypingInterface';
import FinalStandings from '@/components/final/FinalStandings';
import { Crown, Swords, Play, ArrowRight } from 'lucide-react';

export default function GrandFinalPage() {
  const feed = useLiveFeed();
  const { event, finalStandings, progress, serverOffsetMs, loaded, connected } = feed;
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [arenaOpen, setArenaOpen] = useState(false);
  const [timerText, setTimerText] = useState('');

  useEffect(() => {
    loadVerifiedParticipant().then((p) => p && setParticipant(p));
  }, []);

  // Grand Final countdown
  useEffect(() => {
    if (!event || event.final_status !== 'LIVE') {
      setTimerText('');
      return;
    }
    const tick = () => {
      const info = getEventTimerInfo('LIVE', event.final_start_time, event.final_end_time, event.test_duration, serverOffsetMs);
      setTimerText(info.formattedRemaining);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [event, serverOffsetMs]);

  const finalStatus = event?.final_status || 'NOT_STARTED';
  const finalistsCount = Number(event?.finalists_count) || 2;
  const isFinalist = Boolean(participant && event?.finalist_ids?.includes(participant.id));
  const champion = finalStatus === 'ENDED' ? finalStandings.find((s) => s.rank === 1) : null;

  if (!loaded && !event) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <span className="ts-eyebrow block mb-2">
            <Crown className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            Grand Final
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            {finalStatus === 'ENDED' && champion ? `${champion.name} is the champion` : 'Grand Final'}
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            {finalStatus === 'NOT_STARTED'
              ? event?.status === 'ENDED'
                ? `The qualifier round is over. The top ${finalistsCount} below are seeded for the final; the host starts it.`
                : `The top ${finalistsCount} of the qualifier leaderboard advance. Current projection below.`
              : finalStatus === 'LIVE'
                ? 'Finalists type the same passage. The board re-ranks live and shows each finalist as they type.'
                : 'Final standings, ranked by best final-round attempt.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              finalStatus === 'LIVE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : finalStatus === 'ENDED'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {finalStatus === 'LIVE' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  finalStatus === 'LIVE' ? 'bg-emerald-500' : finalStatus === 'ENDED' ? 'bg-amber-500' : 'bg-slate-400'
                }`}
              />
            </span>
            {finalStatus === 'LIVE' ? 'Final live' : finalStatus === 'ENDED' ? 'Final over' : 'Not started'}
            {timerText && <span className="font-mono tabular-nums pl-2 border-l border-emerald-200">{timerText}</span>}
          </div>
          {!connected && loaded && (
            <span className="text-[10px] text-slate-400" title="Live stream unavailable; refreshing every few seconds">
              polling
            </span>
          )}
        </div>
      </div>

      {/* Finalist's arena */}
      {finalStatus === 'LIVE' && isFinalist && participant && event && (
        <div className="mb-8">
          {arenaOpen ? (
            <TypingInterface
              event={event}
              participant={participant}
              serverOffsetMs={serverOffsetMs}
              round="FINAL"
              onAttemptSubmitted={feed.refresh}
            />
          ) : (
            <div className="rounded-2xl bg-white border border-indigo-200 shadow-card-lg p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 mx-auto mb-4">
                <Swords className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">You&apos;re in the final, {participant.name.split(' ')[0]}.</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                Same passage, {event.test_duration || 60} seconds. Your best final-round attempt counts. Everyone watching sees
                your progress as you type.
              </p>
              <button onClick={() => setArenaOpen(true)} className="btn-primary px-8 py-3.5">
                <Play className="w-4 h-4 fill-white" />
                <span>Enter the final</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Board */}
      <FinalStandings
        event={event}
        standings={finalStandings}
        progress={progress}
        currentParticipantId={participant?.id}
      />

      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/leaderboard" className="btn-secondary px-5 py-2.5 text-xs">
          Qualifier leaderboard
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
