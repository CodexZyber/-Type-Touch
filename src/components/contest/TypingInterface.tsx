'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChampionshipEvent, Participant, TypingAttempt, RoundKind, AttemptTimelinePoint } from '@/types';
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
  /** QUALIFIER (default) or FINAL: picks the round window, attempt quota and submission tag. */
  round?: RoundKind;
}

export default function TypingInterface({
  event,
  participant,
  serverOffsetMs,
  onAttemptSubmitted,
  round = 'QUALIFIER',
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
  // Per-second performance timeline (net WPM, raw burst, mistypes) for the result graph
  const timelineRef = useRef<AttemptTimelinePoint[]>([]);
  const lastTickRef = useRef<{ chars: number; mistypes: number }>({ chars: 0, mistypes: 0 });

  const recordTimelinePoint = (t: number) => {
    const typed = latestInputRef.current;
    const stats = keystrokeStatsRef.current;
    const elapsed = Math.max(1, (Date.now() - startTimeRef.current) / 1000);
    const m = computeAttemptMetrics({ passage, typedText: typed, elapsedSeconds: elapsed, ...stats });
    const charsNow = stats.totalKeystrokes;
    const burstChars = Math.max(0, charsNow - lastTickRef.current.chars);
    const errors = Math.max(0, stats.incorrectKeystrokes - lastTickRef.current.mistypes);
    lastTickRef.current = { chars: charsNow, mistypes: stats.incorrectKeystrokes };
    const last = timelineRef.current[timelineRef.current.length - 1];
    if (last && last.t >= t) return;
    timelineRef.current.push({ t, wpm: m.wpmDisplay, raw: Math.round(burstChars * 12), errors });
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const finishAttemptRef = useRef<() => void>(() => {});

  // Each round has its own passage; the final's is set when the host starts it
  const passage =
    (round === 'FINAL' ? event.final_passage || event.passage : event.passage) || 'Loading the official passage...';

  // Fetch participant's historical attempt count
  const fetchUserAttempts = async () => {
    try {
      const res = await fetch(`/api/participants?participantId=${participant.id}`);
      const data = await res.json();
      if (data.success && data.attempts) {
        setUserAttemptsCount(
          data.attempts.filter((a: TypingAttempt) => (a.round || 'QUALIFIER') === round).length
        );
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
    const windowEnd = round === 'FINAL' ? event.final_end_time : event.end_time;
    if (!windowEnd) return baseDuration;

    const nowServer = Date.now() + serverOffsetMs;
    const endServer = new Date(windowEnd).getTime();
    const remainingEventSecs = Math.max(0, Math.floor((endServer - nowServer) / 1000));

    return Math.min(baseDuration, remainingEventSecs);
  };

  // Grand Final only: stream in-progress stats so spectators can watch the race live.
  const reportProgress = (
    state: 'TYPING' | 'DONE',
    typed: string,
    stats: KeystrokeStats,
    elapsedSeconds: number
  ) => {
    const m = computeAttemptMetrics({ passage, typedText: typed, elapsedSeconds, ...stats });
    fetch('/api/attempts/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        participantId: participant.id,
        sessionId: participant.session_id,
        wpm: m.wpmDisplay,
        accuracy: m.accuracy,
        progress: Math.min(100, Math.round((typed.length / passage.length) * 100)),
        state,
      }),
    }).catch(() => {
      // best effort: never interrupt the typist
    });
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
    recordTimelinePoint(Math.max(1, Math.ceil(actualElapsedSecs)));
    if (round === 'FINAL') {
      reportProgress('DONE', currentTyped, stats, actualElapsedSecs);
    }

    // The server recomputes WPM / accuracy from typedText + these keystroke counters.
    const payload = {
      eventId: event.id,
      participantId: participant.id,
      sessionId: participant.session_id,
      startedAt: new Date(effectiveStarted).toISOString(),
      completedAt: new Date(completedServerTime).toISOString(),
      elapsedSeconds: actualElapsedSecs,
      tabSwitches: tabSwitchesRef.current,
      round,
      passageText: passage,
      typedText: currentTyped,
      totalKeystrokes: stats.totalKeystrokes,
      incorrectKeystrokes: stats.incorrectKeystrokes,
      corrections: stats.corrections,
      timeline: timelineRef.current,
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
    timelineRef.current = [];
    lastTickRef.current = { chars: 0, mistypes: 0 };
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

  // Record one timeline point per second while typing (every round)
  useEffect(() => {
    if (gameState !== 'TYPING') return;
    const interval = setInterval(() => {
      const t = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (t >= 1) recordTimelinePoint(t);
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Grand Final: push live progress once a second while typing
  useEffect(() => {
    if (round !== 'FINAL' || gameState !== 'TYPING') return;
    const tick = () => {
      const elapsed = Math.max(1, (Date.now() - startTimeRef.current) / 1000);
      reportProgress('TYPING', latestInputRef.current, keystrokeStatsRef.current, elapsed);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, gameState]);

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
      <div className="w-full max-w-3xl mx-auto rounded-3xl p-10 glass-panel border border-slate-200 text-center animate-fade-in shadow-card">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 mx-auto mb-5 shadow-glow-indigo">
          <Flame className="w-8 h-8" />
        </div>

        {round === 'FINAL' && <span className="ts-eyebrow block mb-2">Grand Final round</span>}
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Ready?</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
          The test lasts exactly <strong className="text-slate-900">{event.test_duration || 60} seconds</strong>. {round === 'FINAL' ? 'Every finalist types the same passage; spectators watch your progress live.' : 'All students receive the identical passage.'} Minimum <strong className="text-indigo-700">{event.minimum_accuracy || 85}% accuracy</strong> required to qualify.
        </p>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
          WPM counts correct characters only (5 characters = 1 word). Accuracy is measured per keystroke:
          every wrong key press counts, even if you backspace and fix it.
        </p>

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 mb-6">
          <span>
            {event.max_attempts
              ? `Attempts used: ${userAttemptsCount} of ${event.max_attempts}`
              : `Attempts taken: ${userAttemptsCount} (Unlimited)`}
          </span>
        </div>

        {maxSecs < (event.test_duration || 60) && (
          <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 text-xs inline-flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Event ending soon! This attempt is capped at {maxSecs} seconds.</span>
          </div>
        )}

        {isMaxAttemptsReached && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>You have completed all {event.max_attempts} of your allowed attempts for this competition.</span>
          </div>
        )}

        <button
          onClick={handleStartTest}
          disabled={maxSecs <= 0 || isMaxAttemptsReached}
          className="px-10 py-4 rounded-xl font-black text-white bg-indigo-700 hover:bg-indigo-800 transition-all duration-200 shadow-glow-indigo flex items-center justify-center space-x-2.5 mx-auto text-base disabled:opacity-40 group"
        >
          <Play className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
          <span>{isMaxAttemptsReached ? 'No attempts left' : 'Start test'}</span>
        </button>

        <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-center space-x-6 text-xs text-slate-500 font-mono">
          <span>Keystrokes tracked</span>
          <span>·</span>
          <span>Paste blocked</span>
          <span>·</span>
          <span>Server verified</span>
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
      <div className="w-full max-w-xl mx-auto rounded-3xl p-12 glass-panel border border-slate-200 text-center animate-fade-in">
        <div className="w-12 h-12 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-1">Scoring your attempt…</h3>
        <p className="text-xs text-slate-500">Verifying typing accuracy and server timestamps</p>
      </div>
    );
  }

  // Render Active Typing State
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 animate-fade-in">
      {/* Live Metrics HUD */}
      <div className="grid grid-cols-4 gap-3 p-4 rounded-2xl glass-panel border border-slate-200">
        <div className="flex items-center space-x-3 px-3 py-1.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Time Left</div>
            <div
              className={`text-xl font-black font-mono tracking-tight ${
                timeRemaining <= 10 ? 'text-red-600 animate-pulse' : 'text-slate-900'
              }`}
            >
              {formatDuration(timeRemaining)}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 px-3 py-1.5 border-l border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Live WPM</div>
            <div className="text-xl font-black font-mono text-slate-900 tracking-tight">{liveWpm}</div>
          </div>
        </div>

        <div className="flex items-center space-x-3 px-3 py-1.5 border-l border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Accuracy</div>
            <div
              className={`text-xl font-black font-mono tracking-tight ${
                liveAcc >= (event.minimum_accuracy || 85) ? 'text-slate-900' : 'text-red-600'
              }`}
            >
              {keystrokeStats.totalKeystrokes === 0 ? '100' : liveAcc}%
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 px-3 py-1.5 border-l border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Progress</div>
            <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
              {Math.min(100, Math.round((input.length / passage.length) * 100))}%
            </div>
          </div>
        </div>
      </div>

      {/* Paste / Anti-Cheat Warning Banner */}
      {pasteWarning && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2 animate-fade-in shadow-lg">
          <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
          <span className="font-medium">{pasteWarning}</span>
        </div>
      )}

      {/* Passage Display Arena */}
      <div
        ref={textDisplayRef}
        onCopy={handleCopyPassage}
        onClick={() => inputRef.current?.focus()}
        className="relative min-h-[220px] max-h-[300px] overflow-y-auto p-7 rounded-2xl glass-panel border border-slate-200 cursor-text select-none text-lg sm:text-xl leading-relaxed tracking-wide font-mono transition-all"
      >
        {passage.split('').map((char, index) => {
          let charClass = 'text-slate-500'; // Default untyped
          const isTyped = index < input.length;
          const isCurrent = index === input.length;

          if (isTyped) {
            const isCorrect = input[index] === char;
            charClass = isCorrect ? 'text-slate-900 font-medium' : 'text-red-600 bg-red-100 underline';
          }

          return (
            <span
              key={index}
              className={`${charClass} ${isCurrent ? 'active-char relative bg-indigo-100 text-indigo-700 border-b-2 border-indigo-600 font-bold' : ''}`}
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
          className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-base placeholder-slate-400 focus:outline-none focus:border-indigo-600 transition-colors resize-none shadow-inner"
        />
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-1 px-1">
          <span>Click to focus • Input is auto-locked at {event.test_duration || 60} seconds</span>
          <span>
            Raw {liveMetrics.rawWpm.toFixed(0)} WPM •{' '}
            <span className={keystrokeStats.incorrectKeystrokes > 0 ? 'text-red-600' : ''}>
              {keystrokeStats.incorrectKeystrokes} mistypes
            </span>{' '}
            • {keystrokeStats.corrections} corrected • {input.length} / {passage.length}
          </span>
        </div>
      </div>
    </div>
  );
}
