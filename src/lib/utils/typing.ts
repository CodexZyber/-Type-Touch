// Core Typing Calculations for Tensor MacTober Touch Type Championship
//
// Scoring model (follows the convention used by TypeSprint / Monkeytype):
//
//   * One "word" is 5 characters, spaces and punctuation included.
//   * Net WPM  = (correct characters remaining in the final text / 5) / minutes.
//     Uncorrected mistakes ("typos") are simply not counted, so each one costs speed.
//   * Raw WPM  = (all characters in the final text / 5) / minutes.
//   * Accuracy is KEYSTROKE based: every wrong keypress is a "mistype" and
//     backspacing does not undo it.
//       accuracy = (totalKeystrokes - mistypes) / totalKeystrokes * 100
//     Backspace itself is not a keystroke for this purpose; it is counted
//     separately as a "correction".
//   * Two error counts are reported:
//       incorrect_keystrokes  (mistypes)  - wrong keypresses, corrected or not
//       incorrect_characters  (typos)     - wrong characters still in the final text
//
// The server recomputes everything it can from the typed text; the keystroke
// counters come from the client and are sanity-checked against the final text.

export const CHARACTERS_PER_WORD = 5;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Keystroke-based accuracy:
 * accuracy = (correctKeystrokes / totalKeystrokes) * 100, rounded to 2 decimals.
 * Returns 0 when nothing was typed.
 */
export function calculateAccuracy(correctKeystrokes: number, totalKeystrokes: number): number {
  if (totalKeystrokes <= 0) return 0;
  const raw = (Math.max(0, correctKeystrokes) / totalKeystrokes) * 100;
  return Math.min(100, round2(raw));
}

/**
 * Net WPM: (correctCharacters / 5) / elapsedMinutes.
 * For a 60 second test this is simply correctCharacters / 5.
 */
export function calculateWPM(correctChars: number, elapsedSeconds: number): {
  precise: number;
  display: number;
} {
  if (elapsedSeconds <= 0) return { precise: 0, display: 0 };
  const elapsedMinutes = elapsedSeconds / 60;
  const precise = (correctChars / CHARACTERS_PER_WORD) / elapsedMinutes;
  return {
    precise: round2(precise),
    display: Math.round(precise),
  };
}

/**
 * Raw WPM: every typed character counts, right or wrong.
 */
export function calculateRawWPM(totalChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return round2((totalChars / CHARACTERS_PER_WORD) / (elapsedSeconds / 60));
}

/**
 * Validates whether an attempt qualifies for the leaderboard based on the minimum accuracy rule
 */
export function isQualifiedAttempt(accuracy: number, minimumAccuracy: number = 85.0): boolean {
  return accuracy >= minimumAccuracy;
}

/**
 * Compares the FINAL typed text with the passage character-by-character.
 * `incorrectCharacters` are the uncorrected typos still in the text.
 */
export function analyzeTyping(passage: string, input: string): {
  correctCharacters: number;
  incorrectCharacters: number;
  totalCharacters: number;
  isComplete: boolean;
} {
  const totalCharacters = input.length;
  let correctCharacters = 0;
  let incorrectCharacters = 0;

  for (let i = 0; i < input.length; i++) {
    if (i < passage.length && input[i] === passage[i]) {
      correctCharacters++;
    } else {
      incorrectCharacters++;
    }
  }

  return {
    correctCharacters,
    incorrectCharacters,
    totalCharacters,
    isComplete: input.length >= passage.length,
  };
}

export interface KeystrokeStats {
  /** Character-producing keypresses (backspace excluded). */
  totalKeystrokes: number;
  /** Keypresses that produced a character different from the passage at that position. */
  incorrectKeystrokes: number;
  /** Characters removed with backspace / delete. */
  corrections: number;
}

export const EMPTY_KEYSTROKE_STATS: KeystrokeStats = {
  totalKeystrokes: 0,
  incorrectKeystrokes: 0,
  corrections: 0,
};

/**
 * Derives keystroke counts from a change of the input value.
 * Works on the common prefix so it also handles multi-character edits
 * (IME composition, selecting and retyping) sensibly.
 */
export function diffKeystrokes(
  previous: string,
  next: string,
  passage: string,
  stats: KeystrokeStats
): KeystrokeStats {
  let prefix = 0;
  const limit = Math.min(previous.length, next.length);
  while (prefix < limit && previous[prefix] === next[prefix]) prefix++;

  const removed = previous.length - prefix;
  const added = next.length - prefix;

  let mistyped = 0;
  for (let i = prefix; i < next.length; i++) {
    if (i >= passage.length || next[i] !== passage[i]) mistyped++;
  }

  return {
    totalKeystrokes: stats.totalKeystrokes + added,
    incorrectKeystrokes: stats.incorrectKeystrokes + mistyped,
    corrections: stats.corrections + removed,
  };
}

export interface AttemptMetricsInput {
  passage: string;
  typedText: string;
  /** Actual time spent typing, in seconds (may be fractional). */
  elapsedSeconds: number;
  /** Client-reported keystroke counters; sanity-checked against the final text. */
  totalKeystrokes?: number;
  incorrectKeystrokes?: number;
  corrections?: number;
}

export interface AttemptMetrics {
  wpm: number;
  wpmDisplay: number;
  rawWpm: number;
  accuracy: number;
  correctCharacters: number;
  incorrectCharacters: number;
  totalCharacters: number;
  totalKeystrokes: number;
  incorrectKeystrokes: number;
  corrections: number;
  isComplete: boolean;
}

/**
 * Single source of truth for an attempt's score. Used by the server when an
 * attempt is submitted and by the client for the live HUD so both agree.
 *
 * Keystroke counters cannot be derived from the final text alone, so they are
 * taken from the client but clamped so they can never flatter the result:
 *   - at least as many keystrokes as characters in the final text
 *   - at least as many mistypes as uncorrected typos in the final text
 *   - never more mistypes than keystrokes
 */
export function computeAttemptMetrics(input: AttemptMetricsInput): AttemptMetrics {
  const typed = input.typedText || '';
  const final = analyzeTyping(input.passage, typed);

  const totalKeystrokes = Math.max(
    final.totalCharacters,
    Math.floor(Number(input.totalKeystrokes) || 0)
  );
  const incorrectKeystrokes = Math.min(
    totalKeystrokes,
    Math.max(final.incorrectCharacters, Math.floor(Number(input.incorrectKeystrokes) || 0))
  );
  const corrections = Math.max(
    totalKeystrokes - final.totalCharacters,
    Math.floor(Number(input.corrections) || 0)
  );

  const { precise: wpm, display: wpmDisplay } = calculateWPM(final.correctCharacters, input.elapsedSeconds);

  return {
    wpm,
    wpmDisplay,
    rawWpm: calculateRawWPM(final.totalCharacters, input.elapsedSeconds),
    accuracy: calculateAccuracy(totalKeystrokes - incorrectKeystrokes, totalKeystrokes),
    correctCharacters: final.correctCharacters,
    incorrectCharacters: final.incorrectCharacters,
    totalCharacters: final.totalCharacters,
    totalKeystrokes,
    incorrectKeystrokes,
    corrections,
    isComplete: final.isComplete,
  };
}
