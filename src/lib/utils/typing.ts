// Core Typing Calculations for Tensor MacTober Touch Type Championship

/**
 * Calculates typing accuracy:
 * accuracy = (correctCharacters / totalTypedCharacters) * 100
 * Rounded to 2 decimal places.
 */
export function calculateAccuracy(correctChars: number, totalChars: number): number {
  if (totalChars <= 0) return 0;
  const raw = (correctChars / totalChars) * 100;
  return Math.round(raw * 100) / 100;
}

/**
 * Calculates WPM using standard typing-test formula:
 * WPM = (correctCharacters / 5) / elapsedMinutes
 * For 60 seconds: WPM = correctCharacters / 5
 */
export function calculateWPM(correctChars: number, elapsedSeconds: number): {
  precise: number;
  display: number;
} {
  if (elapsedSeconds <= 0) return { precise: 0, display: 0 };
  const elapsedMinutes = elapsedSeconds / 60;
  const precise = (correctChars / 5) / elapsedMinutes;
  const display = Math.round(precise);
  return {
    precise: Math.round(precise * 100) / 100,
    display,
  };
}

/**
 * Validates whether an attempt qualifies for the leaderboard based on the 85% rule
 */
export function isQualifiedAttempt(accuracy: number, minimumAccuracy: number = 85.0): boolean {
  return accuracy >= minimumAccuracy;
}

/**
 * Compares typed input with the expected passage text character-by-character
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
