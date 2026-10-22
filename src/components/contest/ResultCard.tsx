'use client';

import React from 'react';
import Link from 'next/link';
import { TypingAttempt } from '@/types';
import TimelineChart from '@/components/charts/TimelineChart';
import { Trophy, CheckCircle2, XCircle, RotateCcw, ArrowRight, Award } from 'lucide-react';

interface ResultCardProps {
  attempt: TypingAttempt;
  isPersonalBest: boolean;
  personalBestWpm: number;
  leaderboardRank: number;
  onTryAgain: () => void;
  canTryAgain: boolean;
  minimumAccuracy?: number;
  attemptsUsed?: number;
  maxAttempts?: number | null;
}

function Stat({ label, value, tone = 'ink', hint }: { label: string; value: React.ReactNode; tone?: 'ink' | 'good' | 'bad' | 'warn' | 'muted'; hint?: string }) {
  const color =
    tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : tone === 'muted' ? 'text-slate-500' : 'text-slate-900';
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-left" title={hint}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export default function ResultCard({
  attempt,
  isPersonalBest,
  personalBestWpm,
  leaderboardRank,
  onTryAgain,
  canTryAgain,
  minimumAccuracy = 85.0,
  attemptsUsed,
  maxAttempts,
}: ResultCardProps) {
  const isQualified = attempt.qualified;
  const isMaxAttemptsReached = Boolean(maxAttempts && attemptsUsed && attemptsUsed >= maxAttempts);
  const timeline = attempt.timeline || [];
  const peak = timeline.reduce((m, p) => Math.max(m, p.wpm), 0);
  const cleanSeconds = timeline.length ? timeline.filter((p) => p.errors === 0).length : 0;

  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl bg-white border border-indigo-200 shadow-card-lg animate-fade-in overflow-hidden">
      {/* Hero numbers */}
      <div className="relative px-6 sm:px-10 pt-8 pb-6 text-center">
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-72 rounded-full blur-[80px] pointer-events-none opacity-30 ${
            isQualified ? 'bg-indigo-300' : 'bg-red-200'
          }`}
        />
        <div className="relative">
          <span className="ts-eyebrow block mb-3">Your result {attempt.round === 'FINAL' ? '· Grand Final' : ''}</span>
          <div className="flex items-center justify-center gap-8 sm:gap-12">
            <div>
              <div className="text-6xl sm:text-7xl font-extrabold tracking-tight tabular-nums text-slate-900">{attempt.wpm_display}</div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mt-1">WPM</div>
            </div>
            <div className="h-16 w-px bg-slate-200" />
            <div>
              <div className={`text-6xl sm:text-7xl font-extrabold tracking-tight tabular-nums ${isQualified ? 'text-slate-900' : 'text-red-600'}`}>
                {attempt.accuracy}%
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mt-1">Accuracy</div>
            </div>
          </div>

          <div className="mt-5 flex justify-center">
            {isQualified ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Qualified for the leaderboard
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
                <XCircle className="w-4 h-4" />
                Below the {minimumAccuracy}% accuracy minimum
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mt-5">
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
                {isPersonalBest ? 'Personal best' : 'Your personal best'}
              </div>
              <div className="text-xl font-bold text-slate-900 flex items-center justify-center gap-1.5 mt-0.5">
                {isPersonalBest ? (
                  <>
                    <Award className="w-4 h-4 text-indigo-700" />
                    <span className="text-indigo-700">New best!</span>
                  </>
                ) : (
                  <span>{personalBestWpm} WPM</span>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Leaderboard position</div>
              <div className="text-xl font-bold text-slate-900 flex items-center justify-center gap-1.5 mt-0.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>{isQualified ? `#${leaderboardRank}` : 'Unranked'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance graph */}
      <div className="px-6 sm:px-10 py-5 border-t border-slate-100">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-900">Speed over the attempt</h3>
          <span className="text-[11px] text-slate-500">
            peak {peak} WPM · {cleanSeconds}/{timeline.length || 0} clean seconds
          </span>
        </div>
        <TimelineChart points={timeline} durationSeconds={Math.ceil(attempt.elapsed_seconds)} height={170} />
      </div>

      {/* Detailed metrics */}
      <div className="px-6 sm:px-10 pb-6">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <Stat label="Raw WPM" value={Math.round(attempt.raw_wpm ?? 0)} hint="All typed characters ÷ 5 per minute, mistakes included" />
          <Stat label="Consistency" value={`${Math.round(attempt.consistency ?? 0)}%`} tone={attempt.consistency >= 70 ? 'good' : attempt.consistency >= 45 ? 'warn' : 'bad'} hint="How even your speed stayed second to second" />
          <Stat label="Mistypes" value={attempt.incorrect_keystrokes ?? attempt.incorrect_characters} tone={attempt.incorrect_keystrokes ? 'bad' : 'good'} hint="Wrong key presses, corrected or not" />
          <Stat label="Uncorrected" value={attempt.incorrect_characters} tone={attempt.incorrect_characters ? 'bad' : 'good'} hint="Wrong characters left in the final text" />
          <Stat label="Corrected" value={attempt.corrections ?? 0} tone="warn" hint="Characters removed with backspace" />
          <Stat label="Keystrokes" value={attempt.total_keystrokes ?? attempt.total_characters} tone="muted" hint="Character-producing key presses" />
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Accuracy = correct keystrokes ÷ all keystrokes. Backspacing fixes the text but not the mistype. WPM counts only correct
          characters, 5 per word, over {attempt.elapsed_seconds}s.
        </p>

        {maxAttempts ? (
          <div className="mt-4 text-xs text-slate-500">
            Attempt {attemptsUsed} of {maxAttempts} used
            {isMaxAttemptsReached && <span className="text-amber-600 font-semibold"> · no attempts left</span>}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
          {canTryAgain && !isMaxAttemptsReached ? (
            <button onClick={onTryAgain} className="btn-primary w-full sm:w-auto px-7">
              <RotateCcw className="w-4 h-4" />
              <span>Try again</span>
            </button>
          ) : isMaxAttemptsReached ? (
            <div className="text-xs text-amber-700 py-2">Maximum attempts ({maxAttempts}/{maxAttempts}) completed.</div>
          ) : (
            <div className="text-xs text-slate-500 italic">The round has ended. Attempts are locked.</div>
          )}
          <Link href="/leaderboard" className="btn-secondary w-full sm:w-auto px-6">
            <span>Leaderboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
