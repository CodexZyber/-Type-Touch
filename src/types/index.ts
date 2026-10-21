// TypeScript Definitions for Tensor MacTober Touch Type Championship

export type EventStatus = 'NOT_STARTED' | 'LIVE' | 'ENDED';

export interface ChampionshipEvent {
  id: string;
  name: string;
  subtitle?: string | null;
  organization_name?: string | null;
  status: EventStatus;
  start_time: string | null;
  end_time: string | null;
  test_duration: number; // in seconds (e.g. 60)
  event_duration: number; // in minutes (e.g. 60)
  minimum_accuracy: number; // e.g. 85.0
  max_attempts: number | null; // null for unlimited
  finalists_count: number; // default 2
  passage: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  event_id: string;
  name: string;
  student_id: string;
  email?: string | null;
  session_id: string;
  disqualified: boolean;
  disqualification_reason?: string | null;
  attempts_count?: number;
  created_at: string;
}

export interface TypingAttempt {
  id: string;
  event_id: string;
  participant_id: string;
  started_at: string;
  completed_at: string;
  tab_switches: number;
  elapsed_seconds: number;
  wpm: number; // net WPM, precise float: (correct chars / 5) / minutes
  wpm_display: number; // net WPM rounded to an integer
  raw_wpm: number; // all typed chars / 5 / minutes
  accuracy: number; // keystroke accuracy %, 2 decimals: (keystrokes - mistypes) / keystrokes
  correct_characters: number; // correct chars in the final text
  incorrect_characters: number; // uncorrected typos left in the final text
  total_characters: number; // length of the final text
  total_keystrokes: number; // character-producing keypresses (backspace excluded)
  incorrect_keystrokes: number; // mistypes: wrong keypresses, corrected or not
  corrections: number; // characters removed with backspace
  qualified: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  participant_id: string;
  name: string;
  student_id: string;
  best_wpm: number;
  best_wpm_precise: number;
  best_accuracy: number;
  attempts_count: number;
  last_attempt_at: string;
  disqualified?: boolean;
}

export interface AdminStats {
  event: ChampionshipEvent;
  totalParticipants: number;
  totalAttempts: number;
  qualifiedParticipants: number;
  topParticipants: LeaderboardEntry[];
  finalists: LeaderboardEntry[];
  currentServerTime: string;
}

export interface SubmissionPayload {
  eventId: string;
  participantId: string;
  sessionId: string;
  startedAt: string;
  completedAt: string;
  elapsedSeconds: number;
  tabSwitches?: number;
  passageText: string;
  typedText: string;
  /** Keystroke counters tracked by the client; the server clamps them against typedText. */
  totalKeystrokes?: number;
  incorrectKeystrokes?: number;
  corrections?: number;
  /** @deprecated derived server-side from typedText; kept for old clients */
  correctCharacters?: number;
  incorrectCharacters?: number;
  totalCharacters?: number;
}
