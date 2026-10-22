// TypeScript Definitions for the Tensor School Typing Championship

export type EventStatus = 'NOT_STARTED' | 'LIVE' | 'ENDED';
export type RoundKind = 'QUALIFIER' | 'FINAL';
export type PassageMode = 'random' | 'custom';

/** One second of an attempt: cumulative net WPM, raw burst speed that second, mistypes that second. */
export interface AttemptTimelinePoint {
  t: number;
  wpm: number;
  raw: number;
  errors: number;
}

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
  passage: string; // qualifier-round passage
  passage_mode: PassageMode; // 'random': fresh library passage each round; 'custom': host-provided text
  final_passage: string | null; // Grand Final passage (set when the final starts)
  is_demo: boolean;
  // Grand Final round (runs after the qualifier round has ENDED)
  final_status: EventStatus;
  final_start_time: string | null;
  final_end_time: string | null;
  final_duration: number; // in minutes
  finalist_ids: string[]; // frozen when the final starts (seed order)
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
  round: RoundKind;
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
  consistency: number; // 0-100: how even the per-second raw speed was
  timeline: AttemptTimelinePoint[]; // one point per second
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
  best_raw_wpm?: number | null;
  best_consistency?: number | null;
  best_attempt_id?: string | null;
  attempts_count: number;
  last_attempt_at: string;
  disqualified?: boolean;
}

/** A finalist's in-progress attempt, streamed while they type (ephemeral, in-memory). */
export interface LiveProgress {
  participant_id: string;
  wpm: number;
  accuracy: number;
  progress: number; // 0..100 of the passage
  state: 'TYPING' | 'DONE';
  updated_at: string;
}

/** One row of the Grand Final board: every finalist, ranked by best final-round attempt. */
export interface FinalStanding {
  seed: number; // 1-based order in which they qualified
  participant_id: string;
  name: string;
  student_id: string;
  qualifier_wpm: number;
  qualifier_accuracy: number;
  rank: number | null; // null until they post a qualifying final attempt
  best_wpm: number | null;
  best_wpm_precise: number | null;
  best_accuracy: number | null;
  attempts_count: number;
  last_attempt_at: string | null;
  live?: LiveProgress | null;
}

export interface AdminStats {
  event: ChampionshipEvent;
  totalParticipants: number;
  totalAttempts: number;
  qualifiedParticipants: number;
  topParticipants: LeaderboardEntry[];
  finalists: LeaderboardEntry[];
  finalStandings: FinalStanding[];
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
  /** Which round this attempt belongs to; defaults to QUALIFIER. */
  round?: RoundKind;
  passageText: string;
  typedText: string;
  /** Keystroke counters tracked by the client; the server clamps them against typedText. */
  totalKeystrokes?: number;
  incorrectKeystrokes?: number;
  corrections?: number;
  /** Per-second timeline recorded by the client (informational; sanitized server-side). */
  timeline?: AttemptTimelinePoint[];
  /** @deprecated derived server-side from typedText; kept for old clients */
  correctCharacters?: number;
  incorrectCharacters?: number;
  totalCharacters?: number;
}
