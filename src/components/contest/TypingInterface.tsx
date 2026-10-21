'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChampionshipEvent, Participant, TypingAttempt } from '@/types';
import {
  computeAttemptMetrics,
  diffKeystrokes,
  EMPTY_KEYSTROKE_STATS,
  KeystrokeStats,
} from '@/lib/utils/typing';
import { formatDuration } from '@/lib/utils/timer';
import ResultCard from './ResultCard';
import { Play, Timer, Target, Flame, AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';

interface TypingInterfaceProps {
  event: ChampionshipEvent;
  participant: Participant;
  serverOffsetMs: number;
  onAttemptSubmitted?: () => void;
}

export default function TypingInterface({
  event,
  participant,
  serverOffsetMs,
  onAttemptSubmitted,
}: TypingInterfaceProps) {
  const [gameState, setGameState] = useState<'READY' | 'TYPING' | 'SUBMITTING' | 'RESULT'>('READY');
  const [input, setInput] = useState<string>('');
  const [keystrokeStats, setKeystrokeStats] = useState<KeystrokeStats>(EMPTY_KEYSTROKE_STATS);
  const [timeRemaining, setTimeRemaining] = useState<number>(event.test_duration || 60);
  const [attemptResult, setAttemptResult] = useState<{
    attempt: TypingAttempt;
    isPersonalBest: boolean;
    personalBestWpm: number;
    leaderboardRank: number;
  } | null>(null);
  const [userAttemptsCount, setUserAttemptsCount] = useState<number>(0);
  const [pasteWarning, setPasteWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Precision Timing & State Refs (immune to re-render cycles and keystroke churn)
  const startTimeRef = useRef<number>(0);
  const deadlineRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestInputRef = useRef<string>('');
  const keystrokeStatsRef = useRef<KeystrokeStats>(EMPTY_KEYSTROKE_STATS);
  const isSubmittingRef = useRef<boolean>(false);
  const tabSwitchesRef = useRef<number>(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const finishAttemptRef = useRef<() => void>(() => {});

  const passage = event.passage || 'Tensor MacTober official passage loading...';

  // Fetch participant's historical attempt count
  const fetchUserAttempts = async () => {
    try {
      const res = await fetch(`/api/participants?participantId=${participant.id}`);
      const data = await res.json();
      if (data.success && data.attempts) {
        setUserAttemptsCount(data.attempts.length);
      }
    } catch (e) {
      // silent fallback
    }
  };

  useEffect(() => {
    fetchUserAttempts();
  }, [participant.id]);

  const isMaxAttemptsReached = Boolean(
    event.max_attempts && userAttemptsCount >= event.max_attempts
  );

  // Maximum allowed test duration taking into account event end time (Requirement 13)
  const calculateEffectiveTestDuration = () => {
    const baseDuration = event.test_duration || 60;
    if (!event.end_time) return baseDuration;

    const nowServer = Date.now() + serverOffsetMs;
    const endServer = new Date(event.end_time).getTime();
    const remainingEventSecs = Math.max(0, Math.floor((endServer - nowServer) / 1000));

    return Math.min(baseDuration, remainingEventSecs);
  };

  // Finish Attempt & Submit to Server (Guaranteed single submission with latest state)
  const finishAttempt = useCallback(async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    // Immediately cancel timer interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setGameState('SUBMITTING');

    const now = Date.now();
    const completedServerTime = now + serverOffsetMs;
    const startMs = startTimeRef.current || now;
    const effectiveStarted = startMs + serverOffsetMs;
    // Sub-second precision so an early finish is scored over the time it actually took.
    const actualElapsedSecs = Math.max(1, Math.round((now - startMs) / 10) / 100);

    const currentTyped = latestInputRef.current;
    const stats = keystrokeStatsRef.current;

    // The server recomputes WPM / accuracy from typedText + these keystroke counters.
    const payload = {
      eventId: event.id,
      participantId: participant.id,
      sessionId: participant.session_id,
      startedAt: new Date(effectiveStarted).toISOString(),
      completedAt: new Date(completedServerTime).toISOString(),
      elapsedSeconds: actualElapsedSecs,
      tabSwitches: tabSwitchesRef.current,
      passageText: passage,
      typedText: currentTyped,
      totalKeystrokes: stats.totalKeystrokes,
      incorrectKeystrokes: stats.incorrectKeystrokes,
      corrections: stats.corrections,
    };

    try {
      const res = await fetch('/api/attempts/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record attempt');
      }

      if (data.attemptsUsed !== undefined) {
        setUserAttemptsCount(data.attemptsUsed);
      } else {
        setUserAttemptsCount((prev) => prev + 1);
      }

      setAttemptResult({
        attempt: data.attempt,
        isPersonalBest: data.isPersonalBest,
        personalBestWpm: data.personalBestWpm,
        leaderboardRank: data.leaderboardRank,
      });
      setGameState('RESULT');
      if (onAttemptSubmitted) onAttemptSubmitted();
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission error');
      setGameState('RESULT');
    }
  }, [
    event.id,
    participant.id,
    participant.session_id,
    passage,
    serverOffsetMs,
    onAttemptSubmitted,
  ]);

  // Keep finishAttemptRef always pointing to current finishAttempt
  useEffect(() => {
    finishAttemptRef.current = finishAttempt;
  }, [finishAttempt]);

  // Start Test Action
  const handleStartTest = () => {
    const effectiveSecs = calculateEffectiveTestDuration();
    if (effectiveSecs <= 0) {
      setErrorMessage('The event time has expired. No new attempts are permitted.');
      return;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    isSubmittingRef.current = false;
    tabSwitchesRef.current = 0;
    latestInputRef.current = '';
    keystrokeStatsRef.current = EMPTY_KEYSTROKE_STATS;
    setKeystrokeStats(EMPTY_KEYSTROKE_STATS);
    setInput('');
    setTimeRemaining(effectiveSecs);

    const now = Date.now();
    startTimeRef.current = now;
    deadlineRef.current = now + effectiveSecs * 1000;

    setGameState('TYPING');
    setPasteWarning(null);
    setErrorMessage(null);

    // Auto focus typing input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Continuous Real-Time Countdown Timer (Fixed deadline based on Date.now())
  // NOTE: This effect depends ONLY on gameState. It does NOT depend on 'input' state,
  // preventing the timer from pausing or resetting on keystrokes!
  useEffect(() => {
    if (gameState !== 'TYPING') {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    const tick = () => {
      const now = Date.now();
      const remainingMs = deadlineRef.current - now;
      const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1000));

      setTimeRemaining(remainingSecs);

      if (remainingMs <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        finishAttemptRef.current();
      }
    };

    // Immediate initial sync tick
    tick();

    // 200ms interval guarantees visible sub-second second changes without any keystroke interference
    timerIntervalRef.current = setInterval(tick, 200);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [gameState]);

  // Tab-switch monitoring (Anti-cheat)
  useEffect(() => {
    if (gameState !== 'TYPING') return;

    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchesRef.current += 1;
        setPasteWarning(`⚠️ Tab switch detected (${tabSwitchesRef.current}). Please remain on the contest page.`);
        setTimeout(() => setPasteWarning(null), 4000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [gameState]);

  // Anti-Cheat: Paste Interception (Requirement 17)
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setPasteWarning('⚠️ Pasting is strictly disabled. Keystrokes must be typed manually.');
    setTimeout(() => setPasteWarning(null), 4000);
  };

  // Anti-Cheat: Passage Copy Interception
  const handleCopyPassage = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setPasteWarning('⚠️ Copying the championship passage is prohibited.');
    setTimeout(() => setPasteWarning(null), 3000);
  };

  // Handle Input Changes (Keeps latestInputRef in sync for safe asynchronous submissions)
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (gameState !== 'TYPING') return;
    const value = e.target.value;

    // Do not allow typing beyond the passage length
    if (value.length > passage.length) return;

    // Keystroke accounting: every new character is a keystroke, every character that
    // differs from the passage is a mistype, every removed character is a correction.
    // Backspacing never undoes a mistype (keystroke-based accuracy).
    const nextStats = diffKeystrokes(latestInputRef.current, value, passage, keystrokeStatsRef.current);
    keystrokeStatsRef.current = nextStats;
    setKeystrokeStats(nextStats);

    latestInputRef.current = value;
    setInput(value);

    // Auto-scroll passage view to keep active word visible
    if (textDisplayRef.current) {
      const activeChar = textDisplayRef.current.querySelector('.active-char');
      if (activeChar) {
        activeChar.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // If passage completely typed before timer expires, finish attempt
    if (value.length === passage.length) {
      finishAttemptRef.current();
    }
  };

  // Live Stats calculations (same formula the server applies on submit)
  const effectiveElapsed = startTimeRef.current
    ? Math.max(1, (Date.now() - startTimeRef.current) / 1000)
    : Math.max(1, (event.test_duration || 60) - timeRemaining);
  const liveMetrics = computeAttemptMetrics({
    passage,
    typedText: input,
    elapsedSeconds: effectiveElapsed,
    ...keystrokeStats,
  });
  const liveAcc = liveMetrics.accuracy;
  const liveWpm = liveMetrics.wpmDisplay;

  // Render Ready State
  if (gameState === 'READY') {
    const maxSecs = calculateEffectiveTestDuration();

    return (
      <div className="w-full max-w-3xl mx-auto rounded-3xl p-10 glass-panel border border-white/10 text-center animate-fade-in shadow-apple-card">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mx-auto mb-5 shadow-glow-orange">
          <Flame className="w-8 h-8" />
        </div>

        <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Ready?</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto mb-4">
          The test lasts exactly <strong className="text-white">{event.test_duration || 60} seconds</strong>. All students receive the identical passage. Minimum <strong className="text-orange-400">{event.minimum_accuracy || 85}% accuracy</strong> required to qualify.
        </p>
        <p className="text-xs text-zinc-500 max-w-md mx-auto mb-4">
          WPM counts correct characters only (5 characters = 1 word). Accuracy is measured per keystroke:
          every wrong key press counts, even if you backspace and fix it.
        </p>

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-zinc-300 mb-6">
          <span>
            {event.max_attempts
              ? `Attempts used: ${userAttemptsCount} of ${event.max_attempts}`
              : `Attempts taken: ${userAttemptsCount} (Unlimited)`}
          </span>
        </div>

        {maxSecs < (event.test_duration || 60) && (
          <div className="mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs inline-flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Event ending soon! This attempt is capped at {maxSecs} seconds.</span>
          </div>
        )}

        {isMaxAttemptsReached && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-500/30 text-red-300 text-xs flex items-center justify-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>You have completed all {event.max_attempts} of your allowed attempts for this competition.</span>
          </div>
        )}

        <button
          onClick={handleStartTest}
          disabled={maxSecs <= 0 || isMaxAttemptsReached}
          className="px-10 py-4 rounded-xl font-black text-black bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 hover:from-orange-400 hover:to-amber-300 transition-all duration-200 shadow-glow-orange flex items-center justify-center space-x-2.5 mx-auto text-base disabled:opacity-40 group"
        >
          <Play className="w-5 h-5 fill-black group-hover:scale-110 transition-transform" />
          <span>{isMaxAttemptsReached ? 'ATTEMPTS EXHAUSTED' : 'START TEST'}</span>
        </button>

        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center space-x-6 text-xs text-zinc-500 font-mono">
          <span>Keystroke Tracked</span>
          <span>•</span>
          <span>Paste Blocked</span>
          <span>•</span>
          <span>Server Verified</span>
        </div>
      </div>
    );
  }

  // Render Result State
  if (gameState === 'RESULT' && attemptResult) {
    const isNowMaxReached = Boolean(event.max_attempts && userAttemptsCount >= event.max_attempts);

    return (
      <ResultCard
        attempt={attemptResult.attempt}
        isPersonalBest={attemptResult.isPersonalBest}
        personalBestWpm={attemptResult.personalBestWpm}
        leaderboardRank={attemptResult.leaderboardRank}
        onTryAgain={handleStartTest}
        canTryAgain={calculateEffectiveTestDuration() > 0 && !isNowMaxReached}
        minimumAccuracy={event.minimum_accuracy || 85}
        attemptsUsed={userAttemptsCount}
        maxAttempts={event.max_attempts}
      />
    );
  }

  // Render Submitting / Processing State
  if (gameState === 'SUBMITTING') {
    return (
      <div className="w-full max-w-xl mx-auto rounded-3xl p-12 glass-panel border border-white/10 text-center animate-fade-in">
        <div className="w-12 h-12 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-1">Calculating Result...</h3>
        <p className="text-xs text-zinc-400">Verifying typing accuracy and server timestamps</p>
      </div>
    );
  }

  // Render Active Typing State
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 animate-fade-in">
      {/* Live Metrics HUD */}
      <div className="grid grid-cols-4 gap-3 p-4 rounded-2xl glass-panel border border-white/10">
        <div className="flex items-center space-x-3 px-3 py-1.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-zinc-400">Time Left</div>
            <div
              className={`text-xl font-black font-mono tracking-tight ${
                timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-white'
              }`}
            >
              {formatDuration(timeRemaining)}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 px-3 py-1.5 border-l border-white/10">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-zinc-400">Live WPM</div>
            <div className="text-xl font-black font-mono text-white tracking-tight">{liveWpm}</div>
          </div>
        </div>

        <div className="flex items-center space-x-3 px-3 py-1.5 border-l border-white/10">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-zinc-400">Accuracy</div>
            <div
              className={`text-xl font-black font-mono tracking-tight ${
                liveAcc >= (event.minimum_accuracy || 85) ? 'text-white' : 'text-red-400'
              }`}
            >
              {keystrokeStats.totalKeystrokes === 0 ? '100' : liveAcc}%
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 px-3 py-1.5 border-l border-white/10">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-zinc-400">Progress</div>
            <div className="text-xl font-black font-mono text-white tracking-tight">
              {Math.min(100, Math.round((input.length / passage.length) * 100))}%
            </div>
          </div>
        </div>
      </div>

      {/* Paste / Anti-Cheat Warning Banner */}
      {pasteWarning && (
        <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs flex items-center space-x-2 animate-fade-in shadow-lg">
          <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
          <span className="font-medium">{pasteWarning}</span>
        </div>
      )}

      {/* Passage Display Arena */}
      <div
        ref={textDisplayRef}
        onCopy={handleCopyPassage}
        onClick={() => inputRef.current?.focus()}
        className="relative min-h-[220px] max-h-[300px] overflow-y-auto p-7 rounded-2xl glass-panel border border-white/15 cursor-text select-none text-lg sm:text-xl leading-relaxed tracking-wide font-mono transition-all"
      >
        {passage.split('').map((char, index) => {
          let charClass = 'text-zinc-500'; // Default untyped
          const isTyped = index < input.length;
          const isCurrent = index === input.length;

          if (isTyped) {
            const isCorrect = input[index] === char;
            charClass = isCorrect ? 'text-white font-medium' : 'text-red-400 bg-red-900/40 underline';
          }

          return (
            <span
              key={index}
              className={`${charClass} ${isCurrent ? 'active-char relative bg-orange-500/20 text-orange-300 border-b-2 border-orange-400 font-bold' : ''}`}
            >
              {char}
            </span>
          );
        })}
      </div>

      {/* Hidden Transparent Input for Typing Handling & Paste Blocking */}
      <div className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onPaste={handlePaste}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          placeholder="Start typing the passage here..."
          rows={2}
          className="w-full px-5 py-3.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-base placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors resize-none shadow-inner"
        />
        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono mt-1 px-1">
          <span>Click to focus • Input is auto-locked at {event.test_duration || 60} seconds</span>
          <span>
            Raw {liveMetrics.rawWpm.toFixed(0)} WPM •{' '}
            <span className={keystrokeStats.incorrectKeystrokes > 0 ? 'text-red-400' : ''}>
              {keystrokeStats.incorrectKeystrokes} mistypes
            </span>{' '}
            • {keystrokeStats.corrections} corrected • {input.length} / {passage.length}
          </span>
        </div>
      </div>
    </div>
  );
}
