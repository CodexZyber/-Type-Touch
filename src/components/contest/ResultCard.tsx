'use client';

import React from 'react';
import Link from 'next/link';
import { TypingAttempt } from '@/types';
import { Trophy, CheckCircle2, XCircle, RotateCcw, ArrowRight, Award, Flame } from 'lucide-react';

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

  return (
    <div className="w-full max-w-xl mx-auto rounded-3xl p-8 glass-panel-glow border border-white/10 shadow-2xl animate-fade-in text-center relative overflow-hidden">
      {/* Background ambient splash */}
      <div
        className={`absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-[80px] pointer-events-none opacity-25 ${
          isQualified ? 'bg-orange-500' : 'bg-red-500'
        }`}
      />

      <div className="relative z-10">
        <span className="text-xs font-mono uppercase tracking-[0.25em] text-zinc-400 font-semibold mb-2 block">
          YOUR RESULT
        </span>

        {/* Primary WPM & Accuracy */}
        <div className="my-6 flex items-center justify-center gap-6 sm:gap-10">
          <div className="flex flex-col items-center">
            <span className="text-6xl sm:text-7xl font-black tracking-tight text-white font-mono">
              {attempt.wpm_display}
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 mt-1">
              WPM
            </span>
          </div>

          <div className="h-16 w-[1px] bg-white/10" />

          <div className="flex flex-col items-center">
            <span
              className={`text-6xl sm:text-7xl font-black tracking-tight font-mono ${
                attempt.accuracy >= minimumAccuracy ? 'text-white' : 'text-red-400'
              }`}
            >
              {attempt.accuracy}%
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 mt-1">
              ACCURACY
            </span>
          </div>
        </div>

        {/* Qualification Status Badge (Requirement 8) */}
        <div className="mb-6 flex justify-center">
          {isQualified ? (
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>✓ QUALIFIED FOR LEADERBOARD</span>
            </div>
          ) : (
            <div className="inline-flex flex-col items-center px-5 py-3 rounded-2xl bg-red-950/60 border border-red-500/30 text-red-300 text-sm">
              <div className="flex items-center space-x-2 font-bold mb-0.5">
                <XCircle className="w-4 h-4 text-red-400" />
                <span>❌ Not Qualified</span>
              </div>
              <span className="text-xs text-red-200/80">
                You need at least {minimumAccuracy}% accuracy to enter the leaderboard.
              </span>
            </div>
          )}
        </div>

        {/* Personal Best & Rank Highlights (Requirement 18) */}
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-8">
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center">
            <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
              {isPersonalBest ? 'Current Status' : 'Your Personal Best'}
            </span>
            <div className="text-xl font-bold text-white font-mono flex items-center justify-center space-x-1">
              {isPersonalBest ? (
                <>
                  <Award className="w-4 h-4 text-orange-400" />
                  <span className="text-orange-400">NEW BEST!</span>
                </>
              ) : (
                <>
                  <span>{personalBestWpm} WPM</span>
                </>
              )}
            </div>
            {!isPersonalBest && isQualified && (
              <span className="text-[10px] text-zinc-400 block mt-0.5">Keep trying!</span>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center">
            <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
              Leaderboard Position
            </span>
            <div className="text-xl font-bold text-white font-mono flex items-center justify-center space-x-1">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>{isQualified ? `#${leaderboardRank}` : 'Unranked'}</span>
            </div>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              {leaderboardRank <= 2 && isQualified ? '🥇 Grand Finalist Seat!' : 'Live standings'}
            </span>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="flex items-center justify-center space-x-6 text-xs text-zinc-400 font-mono mb-8 border-t border-b border-white/5 py-3">
          <div>
            Correct: <span className="text-emerald-400 font-bold">{attempt.correct_characters}</span>
          </div>
          <div>•</div>
          <div>
            Errors: <span className="text-red-400 font-bold">{attempt.incorrect_characters}</span>
          </div>
          <div>•</div>
          <div>
            Total: <span className="text-white font-bold">{attempt.total_characters}</span>
          </div>
        </div>

        {/* Attempt Limit Notice if Applicable */}
        {maxAttempts && (
          <div className="mb-6">
            <span className="text-xs font-mono text-zinc-400">
              Attempt {attemptsUsed} of {maxAttempts} used
            </span>
            {isMaxAttemptsReached && (
              <div className="mt-1 text-xs text-amber-400 font-mono">
                You have reached your maximum allowed attempts.
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {canTryAgain && !isMaxAttemptsReached ? (
            <button
              onClick={onTryAgain}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-black bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 hover:from-orange-400 hover:to-amber-300 transition-all duration-150 shadow-glow-orange flex items-center justify-center space-x-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>TRY AGAIN</span>
            </button>
          ) : isMaxAttemptsReached ? (
            <div className="text-xs text-amber-300 font-mono py-2">
              Maximum attempts ({maxAttempts}/{maxAttempts}) completed.
            </div>
          ) : (
            <div className="text-xs text-zinc-400 italic">
              Event has ended. Additional attempts are locked.
            </div>
          )}

          <Link
            href="/leaderboard"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-medium text-white glass-panel hover:bg-white/10 transition-colors flex items-center justify-center space-x-2 border border-white/10 text-sm"
          >
            <span>VIEW LEADERBOARD</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
