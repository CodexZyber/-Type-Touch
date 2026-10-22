import {
  ChampionshipEvent,
  Participant,
  TypingAttempt,
  LeaderboardEntry,
  SubmissionPayload,
  AdminStats,
  RoundKind,
  FinalStanding,
} from '@/types';
import { computeAttemptMetrics, isQualifiedAttempt, sanitizeTimeline, calculateConsistency } from '@/lib/utils/typing';
import { pickPassage } from '@/lib/passages';
import { getPool, isUuid } from '@/lib/db/postgres';
import { verifyPassword } from '@/lib/auth/admin-auth';
import crypto from 'node:crypto';
import { notifyChange, clearProgress, getProgress } from '@/lib/realtime/live';

// Initial Official Passage for the Tensor School Typing Championship
export const OFFICIAL_PASSAGE =
  'Silicon precision meets human agility on the keys of the future. Deep learning architectures transform simple vectors into complex thoughts, training neural networks across millions of gradient steps. As artificial intelligence reshapes human potential, mastery over fundamental tools remains paramount. Every keystroke is a signal, an instruction executed with absolute clarity and unmatched velocity. In this championship, focus and discipline separate the ordinary from the extraordinary. Push through the cognitive barrier, maintain composure under intense pressure, and calibrate your rhythm to perfection.';

export const DEMO_PASSAGE =
  'Speed and accuracy define the ultimate champion. Quick reflexes trigger flawless execution on modern mechanical switches.';

// In-Memory Fallback State (persists across server requests in memory)
class MemoryDataStore {
  event: ChampionshipEvent;
  participants: Map<string, Participant> = new Map();
  attempts: TypingAttempt[] = [];
  /** Student logins keyed by lower-cased username (mirrors the student_accounts table) */
  accounts: Map<string, { participant_id: string; password_hash: string }> = new Map();

  constructor() {
    this.event = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Tensor School Typing Championship',
      subtitle: 'Type fast. Type clean. Climb the leaderboard.',
      organization_name: 'TENSOR',
      status: 'NOT_STARTED',
      start_time: null,
      end_time: null,
      test_duration: 60,
      event_duration: 60,
      minimum_accuracy: 85.0,
      max_attempts: null,
      finalists_count: 2,
      passage: OFFICIAL_PASSAGE,
      passage_mode: 'random',
      final_passage: null,
      is_demo: false,
      final_status: 'NOT_STARTED',
      final_start_time: null,
      final_end_time: null,
      final_duration: 10,
      finalist_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Load initial seed demo data (marked as is_demo: true)
    this.seedInitialParticipants();
  }

  seedInitialParticipants() {
    const seedData = [
      { id: 'seed-p1', name: 'Arya', student_id: 'MAC-101', wpm: 102, acc: 94.2 },
      { id: 'seed-p2', name: 'Rahul', student_id: 'MAC-102', wpm: 98, acc: 96.0 },
      { id: 'seed-p3', name: 'Priya', student_id: 'MAC-103', wpm: 95, acc: 91.5 },
      { id: 'seed-p4', name: 'Karan', student_id: 'MAC-104', wpm: 91, acc: 89.0 },
      { id: 'seed-p5', name: 'Aman', student_id: 'MAC-105', wpm: 88, acc: 93.4 },
      { id: 'seed-p6', name: 'Sara', student_id: 'MAC-106', wpm: 84, acc: 90.1 },
      { id: 'seed-p7', name: 'Dev', student_id: 'MAC-107', wpm: 82, acc: 87.2 },
    ];

    const baseTime = Date.now() - 15 * 60 * 1000;

    for (const s of seedData) {
      const p: Participant = {
        id: s.id,
        event_id: this.event.id,
        name: s.name,
        student_id: s.student_id,
        email: `${s.student_id.toLowerCase()}@tensorschool.local`,
        session_id: `sess_${s.student_id}`,
        disqualified: false,
        disqualification_reason: null,
        created_at: new Date(baseTime).toISOString(),
      };
      this.participants.set(p.id, p);

      const elapsed = 60;
      const totalChars = Math.round(s.wpm * 5);
      // Seeded typists corrected most of their mistypes; a few typos remain.
      const mistypes = Math.round(totalChars * (1 - s.acc / 100));
      const typos = Math.floor(mistypes / 3);
      const correctChars = totalChars - typos;

      const att: TypingAttempt = {
        tab_switches: 0,
        round: 'QUALIFIER',
        id: `att_${s.id}`,
        event_id: this.event.id,
        participant_id: p.id,
        started_at: new Date(baseTime).toISOString(),
        completed_at: new Date(baseTime + 60000).toISOString(),
        elapsed_seconds: elapsed,
        wpm: s.wpm,
        wpm_display: s.wpm,
        raw_wpm: Math.round((totalChars / 5) * 100) / 100,
        accuracy: s.acc,
        correct_characters: correctChars,
        incorrect_characters: typos,
        total_characters: totalChars,
        total_keystrokes: totalChars + (mistypes - typos),
        incorrect_keystrokes: mistypes,
        corrections: mistypes - typos,
        consistency: 88,
        timeline: [],
        qualified: true,
        is_demo: true,
        created_at: new Date(baseTime + 60000).toISOString(),
      };
      this.attempts.push(att);
    }
  }
}

// Global singleton in Node environment
const globalAny: any = global;
if (!globalAny.__tensorStore) {
  globalAny.__tensorStore = new MemoryDataStore();
}
const memoryStore: MemoryDataStore = globalAny.__tensorStore;

// Columns an admin config update may write (whitelist: keys are interpolated into SQL)
const EVENT_UPDATABLE_COLUMNS = [
  'name',
  'subtitle',
  'organization_name',
  'status',
  'start_time',
  'end_time',
  'test_duration',
  'event_duration',
  'minimum_accuracy',
  'max_attempts',
  'finalists_count',
  'passage',
  'passage_mode',
  'final_passage',
  'is_demo',
  'final_status',
  'final_start_time',
  'final_end_time',
  'final_duration',
  'finalist_ids',
  'updated_at',
] as const;

/** Columns stored as JSONB: pg would otherwise serialize a JS array as a Postgres array literal. */
const JSON_COLUMNS = new Set<string>(['finalist_ids']);

const ROUND_WINDOW_GRACE_MS = 5000;

/** The official window of a round; attempts outside it never count. */
function roundWindow(event: ChampionshipEvent, round: RoundKind): { start: string | null; end: string | null } {
  return round === 'FINAL'
    ? { start: event.final_start_time, end: event.final_end_time }
    : { start: event.start_time, end: event.end_time };
}

function inRoundWindow(event: ChampionshipEvent, round: RoundKind, attempt: TypingAttempt): boolean {
  const { start, end } = roundWindow(event, round);
  if (start && new Date(attempt.started_at).getTime() < new Date(start).getTime()) return false;
  if (end && new Date(attempt.completed_at).getTime() > new Date(end).getTime() + ROUND_WINDOW_GRACE_MS) return false;
  return true;
}

function normalizeEvent(event: ChampionshipEvent): ChampionshipEvent {
  if (!Array.isArray(event.finalist_ids)) event.finalist_ids = [];
  if (!event.final_status) event.final_status = 'NOT_STARTED';
  if (!event.final_duration) event.final_duration = 10;
  if (event.passage_mode !== 'custom') event.passage_mode = 'random';
  if (event.final_passage === undefined) event.final_passage = null;
  return event;
}

/** The passage a round is typed against. */
function passageForRound(event: ChampionshipEvent, round: RoundKind): string {
  return round === 'FINAL' ? event.final_passage || event.passage : event.passage;
}

// Postgres error code for foreign_key_violation
const PG_FOREIGN_KEY_VIOLATION = '23503';

// Every student and screen polls the public leaderboard, so concurrent polls share
// one query and reuse the result briefly. Cleared on any write that affects ranking.
const LEADERBOARD_CACHE_MS = 1000;
const leaderboardCache = new Map<string, { expires: number; promise: Promise<LeaderboardEntry[]> }>();

/** Invalidate cached rankings and push a fresh snapshot to live viewers. */
function rankingsChanged(): void {
  leaderboardCache.clear();
  notifyChange();
}

export class EventService {
  /**
   * Returns current active event with updated server-authoritative status
   */
  static async getActiveEvent(): Promise<ChampionshipEvent> {
    const pool = getPool();
    if (pool) {
      const { rows } = await pool.query<ChampionshipEvent>(
        'SELECT * FROM events ORDER BY created_at DESC LIMIT 1'
      );
      let event = rows[0];

      if (!event) {
        // Schema applied without the seed row: create the default event
        const seed = memoryStore.event;
        const created = await pool.query<ChampionshipEvent>(
          `INSERT INTO events (name, subtitle, organization_name, passage)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [seed.name, seed.subtitle, seed.organization_name, seed.passage]
        );
        event = created.rows[0];
      }

      // Check if LIVE event has expired based on current server clock
      if (event.status === 'LIVE' && event.end_time) {
        if (new Date() >= new Date(event.end_time)) {
          const ended = await pool.query<ChampionshipEvent>(
            `UPDATE events SET status = 'ENDED', updated_at = now()
             WHERE id = $1 AND status = 'LIVE' RETURNING *`,
            [event.id]
          );
          event = ended.rows[0] || { ...event, status: 'ENDED' };
          rankingsChanged();
        }
      }
      // Same for the Grand Final clock
      if (event.final_status === 'LIVE' && event.final_end_time) {
        if (new Date() >= new Date(event.final_end_time)) {
          const ended = await pool.query<ChampionshipEvent>(
            `UPDATE events SET final_status = 'ENDED', updated_at = now()
             WHERE id = $1 AND final_status = 'LIVE' RETURNING *`,
            [event.id]
          );
          event = ended.rows[0] || { ...event, final_status: 'ENDED' };
          rankingsChanged();
        }
      }
      return normalizeEvent(event);
    }

    // In-memory fallback
    const event = normalizeEvent(memoryStore.event);
    if (event.status === 'LIVE' && event.end_time) {
      if (new Date() >= new Date(event.end_time)) {
        event.status = 'ENDED';
        event.updated_at = new Date().toISOString();
        rankingsChanged();
      }
    }
    if (event.final_status === 'LIVE' && event.final_end_time) {
      if (new Date() >= new Date(event.final_end_time)) {
        event.final_status = 'ENDED';
        event.updated_at = new Date().toISOString();
        rankingsChanged();
      }
    }
    return event;
  }

  /**
   * Updates event configuration (Admin)
   */
  static async updateEvent(updates: Partial<ChampionshipEvent>): Promise<ChampionshipEvent> {
    const activeEvent = await this.getActiveEvent();

    // 1. Lock check: Do not allow configuration changes that create inconsistent attempts during a LIVE round (Requirement 4)
    if (activeEvent.status === 'LIVE' || activeEvent.final_status === 'LIVE') {
      const configKeys: (keyof ChampionshipEvent)[] = [
        'name',
        'subtitle',
        'organization_name',
        'event_duration',
        'test_duration',
        'minimum_accuracy',
        'max_attempts',
        'passage',
        'passage_mode',
        'final_passage',
        'finalists_count',
        'final_duration',
      ];
      const hasConfigChanges = configKeys.some(
        (key) => updates[key] !== undefined && updates[key] !== (activeEvent as any)[key]
      );
      if (hasConfigChanges) {
        throw new Error(
          activeEvent.final_status === 'LIVE'
            ? 'Configuration cannot be changed while the Grand Final is LIVE. End the final first.'
            : 'Configuration cannot be changed while the championship is LIVE. Please pause or end the event first.'
        );
      }
    }

    if (updates.final_duration !== undefined) {
      const fd = Number(updates.final_duration);
      if (isNaN(fd) || fd < 1 || fd > 240) {
        throw new Error('Grand Final duration must be between 1 and 240 minutes.');
      }
      updates.final_duration = fd;
    }

    if (updates.finalists_count !== undefined) {
      const fc = Number(updates.finalists_count);
      if (isNaN(fc) || fc < 1 || fc > 50 || !Number.isInteger(fc)) {
        throw new Error('Number of finalists must be a whole number between 1 and 50.');
      }
      updates.finalists_count = fc;
    }

    // 2. Field-by-Field Validations (Requirement 15)
    if (updates.name !== undefined) {
      const cleanName = updates.name.trim();
      if (!cleanName) {
        throw new Error('Event name cannot be empty.');
      }
      if (cleanName.length > 120) {
        throw new Error('Event name must not exceed 120 characters.');
      }
      updates.name = cleanName;
    }

    if (updates.subtitle !== undefined && updates.subtitle !== null) {
      updates.subtitle = updates.subtitle.trim();
    }

    if (updates.organization_name !== undefined && updates.organization_name !== null) {
      updates.organization_name = updates.organization_name.trim();
    }

    if (updates.event_duration !== undefined) {
      const dur = Number(updates.event_duration);
      if (isNaN(dur) || dur < 1 || dur > 1440) {
        throw new Error('Event duration must be between 1 and 1440 minutes.');
      }
      updates.event_duration = dur;
    }

    if (updates.test_duration !== undefined) {
      const td = Number(updates.test_duration);
      if (isNaN(td) || td < 5 || td > 300) {
        throw new Error('Attempt duration must be between 5 and 300 seconds.');
      }
      updates.test_duration = td;
    }

    if (updates.minimum_accuracy !== undefined) {
      const acc = Number(updates.minimum_accuracy);
      if (isNaN(acc) || acc < 1 || acc > 100) {
        throw new Error('Minimum accuracy must be between 1% and 100%.');
      }
      updates.minimum_accuracy = acc;
    }

    if (updates.max_attempts !== undefined) {
      if (updates.max_attempts !== null && (updates.max_attempts as any) !== '') {
        const ma = Number(updates.max_attempts);
        if (isNaN(ma) || ma < 1 || !Number.isInteger(ma)) {
          throw new Error('Maximum attempts must be a positive number.');
        }
        updates.max_attempts = ma;
      } else {
        updates.max_attempts = null;
      }
    }

    if (updates.passage !== undefined) {
      const p = updates.passage.trim();
      if (!p) {
        throw new Error('Competition passage cannot be empty.');
      }
      if (p.length < 20) {
        throw new Error('Competition passage must be at least 20 characters.');
      }
      updates.passage = p;
    }

    if (updates.passage_mode !== undefined && updates.passage_mode !== 'random' && updates.passage_mode !== 'custom') {
      throw new Error('Passage mode must be "random" or "custom".');
    }

    if (updates.final_passage !== undefined && updates.final_passage !== null) {
      const fp = String(updates.final_passage).trim();
      if (fp && fp.length < 20) {
        throw new Error('Grand Final passage must be at least 20 characters (or left blank for a random one).');
      }
      updates.final_passage = fp || null;
    }

    const newValues = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const pool = getPool();
    if (pool) {
      const columns = EVENT_UPDATABLE_COLUMNS.filter((col) => (newValues as any)[col] !== undefined);
      const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
      const { rows } = await pool.query<ChampionshipEvent>(
        `UPDATE events SET ${setClause} WHERE id = $1 RETURNING *`,
        [
          activeEvent.id,
          ...columns.map((col) =>
            JSON_COLUMNS.has(col) ? JSON.stringify((newValues as any)[col]) : (newValues as any)[col]
          ),
        ]
      );
      if (!rows[0]) {
        throw new Error('Event not found.');
      }
      rankingsChanged();
      return normalizeEvent(rows[0]);
    }

    // In-memory fallback
    Object.assign(memoryStore.event, newValues);
    rankingsChanged();
    return normalizeEvent(memoryStore.event);
  }

  /**
   * Starts the event
   */
  static async startEvent(durationMinutes?: number): Promise<ChampionshipEvent> {
    const active = await this.getActiveEvent();
    const duration = durationMinutes || active.event_duration || 60;
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    // Resuming after a pause keeps the passage; a fresh start rotates it so every
    // contest types a different text (unless the host chose a custom passage).
    const resuming = Boolean(active.start_time) && active.status === 'NOT_STARTED';
    const passage =
      active.passage_mode === 'random' && !resuming ? pickPassage([active.passage, active.final_passage]) : active.passage;

    return this.updateEvent({
      status: 'LIVE',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      event_duration: duration,
      passage,
    });
  }

  /**
   * Pauses the event
   */
  static async pauseEvent(): Promise<ChampionshipEvent> {
    return this.updateEvent({
      status: 'NOT_STARTED',
    });
  }

  /**
   * Ends the event
   */
  static async endEvent(): Promise<ChampionshipEvent> {
    return this.updateEvent({
      status: 'ENDED',
      end_time: new Date().toISOString(),
    });
  }

  /**
   * Resets the event (qualifier round and Grand Final)
   */
  static async resetEvent(clearAttempts: boolean = true): Promise<ChampionshipEvent> {
    const pool = getPool();
    const active = await this.getActiveEvent();

    if (clearAttempts) {
      if (pool) {
        await pool.query('DELETE FROM attempts WHERE event_id = $1', [active.id]);
      } else {
        memoryStore.attempts = [];
      }
    }
    clearProgress();

    return this.updateEvent({
      status: 'NOT_STARTED',
      start_time: null,
      end_time: null,
      final_status: 'NOT_STARTED',
      final_start_time: null,
      final_end_time: null,
      final_passage: null,
      finalist_ids: [],
    });
  }

  /**
   * Starts the Grand Final: freezes the top `finalists_count` of the qualifier
   * leaderboard as finalists and opens the final-round window. Attempts from an
   * earlier final fall outside the new window, so restarting gives a clean board.
   */
  static async startFinal(durationMinutes?: number): Promise<ChampionshipEvent> {
    const active = await this.getActiveEvent();
    if (active.status !== 'ENDED') {
      throw new Error('End the qualifier round before starting the Grand Final.');
    }
    if (active.final_status === 'LIVE') {
      throw new Error('The Grand Final is already live.');
    }

    const leaderboard = await this.getLeaderboard(active.id, 'QUALIFIER');
    const finalists = leaderboard.slice(0, active.finalists_count || 2);
    if (finalists.length === 0) {
      throw new Error('No qualified participants: nobody can be seeded into the Grand Final.');
    }

    const duration = durationMinutes || active.final_duration || 10;
    const start = new Date();
    const end = new Date(start.getTime() + duration * 60 * 1000);
    clearProgress();

    // Finalists type a passage nobody has seen in the qualifier round
    const finalPassage =
      active.passage_mode === 'custom' && active.final_passage?.trim()
        ? active.final_passage.trim()
        : pickPassage([active.passage, active.final_passage]);

    return this.updateEvent({
      final_status: 'LIVE',
      final_start_time: start.toISOString(),
      final_end_time: end.toISOString(),
      final_duration: duration,
      final_passage: finalPassage,
      finalist_ids: finalists.map((f) => f.participant_id),
    });
  }

  /**
   * Ends the Grand Final
   */
  static async endFinal(): Promise<ChampionshipEvent> {
    const active = await this.getActiveEvent();
    if (active.final_status !== 'LIVE') {
      throw new Error('The Grand Final is not live.');
    }
    clearProgress();
    return this.updateEvent({
      final_status: 'ENDED',
      final_end_time: new Date().toISOString(),
    });
  }

  /**
   * Configures Demo Mode (Requirement 25)
   */
  static async configureDemoMode(enable: boolean): Promise<ChampionshipEvent> {
    if (enable) {
      return this.updateEvent({
        is_demo: true,
        event_duration: 5, // 5 minute demo event
        test_duration: 10, // 10 second quick test
        passage: DEMO_PASSAGE,
        minimum_accuracy: 85.0,
      });
    } else {
      return this.updateEvent({
        is_demo: false,
        event_duration: 60,
        test_duration: 60,
        passage: OFFICIAL_PASSAGE,
        minimum_accuracy: 85.0,
      });
    }
  }

  /**
   * Registers a participant or returns existing by student_id / session_id
   */
  static async registerParticipant(
    eventId: string,
    name: string,
    studentId: string,
    email?: string,
    sessionId?: string
  ): Promise<Participant> {
    const cleanStudentId = studentId.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const pool = getPool();
    if (pool) {
      if (!isUuid(eventId)) {
        throw new Error('Unknown event. Please refresh the page and try again.');
      }

      // Check existing by student_id or session_id (a student_id match wins)
      const findExisting = () =>
        pool.query<Participant>(
          `SELECT * FROM participants
           WHERE event_id = $1 AND (student_id = $2 OR session_id = $3)
           ORDER BY (student_id = $2) DESC
           LIMIT 1`,
          [eventId, cleanStudentId, cleanSessionId]
        );

      const existing = await findExisting();
      if (existing.rows[0]) {
        return existing.rows[0];
      }

      const created = await pool.query<Participant>(
        `INSERT INTO participants (event_id, name, student_id, email, session_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_id, student_id) DO NOTHING
         RETURNING *`,
        [eventId, cleanName, cleanStudentId, email?.trim() || null, cleanSessionId]
      );
      if (created.rows[0]) {
        return created.rows[0];
      }

      // Lost a race with a concurrent registration of the same student_id
      const raced = await findExisting();
      if (raced.rows[0]) {
        return raced.rows[0];
      }
      throw new Error('Registration failed. Please try again.');
    }

    // In-memory fallback
    for (const p of Array.from(memoryStore.participants.values())) {
      if (p.event_id === eventId && (p.student_id === cleanStudentId || p.session_id === cleanSessionId)) {
        return p;
      }
    }

    const newParticipant: Participant = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      event_id: eventId,
      name: cleanName,
      student_id: cleanStudentId,
      email: email?.trim() || null,
      session_id: cleanSessionId,
      disqualified: false,
      disqualification_reason: null,
      created_at: new Date().toISOString(),
    };

    memoryStore.participants.set(newParticipant.id, newParticipant);
    return newParticipant;
  }

  /**
   * Signs a host-created student in. Each sign-in issues a fresh session id, so the
   * student's previous device is signed out and only the new session can submit.
   * Returns null for an unknown username or wrong password (callers don't say which).
   */
  static async loginStudent(username: string, password: string): Promise<Participant | null> {
    const event = await this.getActiveEvent();
    const key = username.trim().toLowerCase();
    const sessionId = `sess_${crypto.randomBytes(16).toString('hex')}`;

    const pool = getPool();
    if (pool) {
      const { rows } = await pool.query<{ participant_id: string; password_hash: string }>(
        `SELECT sa.participant_id, sa.password_hash
         FROM student_accounts sa
         JOIN participants p ON p.id = sa.participant_id
         WHERE lower(sa.username) = $1 AND p.event_id = $2`,
        [key, event.id]
      );
      const account = rows[0];
      if (!account || !verifyPassword(password, account.password_hash)) return null;

      const updated = await pool.query<Participant>(
        'UPDATE participants SET session_id = $2 WHERE id = $1 RETURNING *',
        [account.participant_id, sessionId]
      );
      return updated.rows[0] || null;
    }

    const account = memoryStore.accounts.get(key);
    const participant = account && memoryStore.participants.get(account.participant_id);
    if (!account || !participant || participant.event_id !== event.id) return null;
    if (!verifyPassword(password, account.password_hash)) return null;
    participant.session_id = sessionId;
    return participant;
  }

  /**
   * Signs a student out by retiring their session id, so the old session can no longer
   * submit or report progress. A stale/mismatched session is a no-op.
   */
  static async logoutStudent(participantId: string, sessionId: string): Promise<void> {
    const retired = `sess_${crypto.randomBytes(16).toString('hex')}`;
    const pool = getPool();
    if (pool) {
      if (!isUuid(participantId)) return;
      await pool.query('UPDATE participants SET session_id = $3 WHERE id = $1 AND session_id = $2', [
        participantId,
        sessionId,
        retired,
      ]);
      return;
    }

    const participant = memoryStore.participants.get(participantId);
    if (participant && participant.session_id === sessionId) participant.session_id = retired;
  }

  /**
   * Submits a typing attempt with strict server-side validation and anti-cheat
   */
  static async submitAttempt(payload: SubmissionPayload): Promise<{
    attempt: TypingAttempt;
    isPersonalBest: boolean;
    personalBestWpm: number;
    leaderboardRank: number;
    attemptsUsed: number;
    maxAttempts: number | null;
    attemptsRemaining: number | null;
  }> {
    const event = await this.getActiveEvent();
    const now = new Date();
    const round: RoundKind = payload.round === 'FINAL' ? 'FINAL' : 'QUALIFIER';

    // 0. Only the signed-in session may submit (participant ids are public on the leaderboard)
    const participant = await this.getParticipant(payload.participantId);
    if (!participant || !payload.sessionId || participant.session_id !== payload.sessionId) {
      throw new Error('Your session has expired or you signed in elsewhere. Please sign in again.');
    }

    // 1. Validate round status
    if (round === 'FINAL') {
      if (event.final_status !== 'LIVE') {
        throw new Error('Final-round attempts are only allowed while the Grand Final is LIVE.');
      }
      if (!event.finalist_ids.includes(payload.participantId)) {
        throw new Error('Only seeded finalists can take part in the Grand Final.');
      }
    } else if (event.status !== 'LIVE') {
      throw new Error('Attempts are only allowed while the championship is LIVE.');
    }

    // 2. Validate timing: reject if the round's end time passed
    const windowEnd = roundWindow(event, round).end;
    if (windowEnd && now.getTime() > new Date(windowEnd).getTime() + ROUND_WINDOW_GRACE_MS) {
      throw new Error(
        round === 'FINAL'
          ? 'The Grand Final has ended. No more attempts are accepted.'
          : 'The competition has ended. No more attempts are accepted.'
      );
    }

    // 3. Enforce Maximum Attempts Limit (Requirement 1.D, 8, 9) — counted per round, inside its window
    const userAttempts = (await this.getParticipantAttempts(payload.participantId)).filter(
      (a) => (a.round || 'QUALIFIER') === round && inRoundWindow(event, round, a)
    );
    if (event.max_attempts !== null && event.max_attempts > 0) {
      if (userAttempts.length >= event.max_attempts) {
        throw new Error(
          `Maximum attempts reached (${event.max_attempts} / ${event.max_attempts}). No further attempts are permitted.`
        );
      }
    }

    // 4. Server-side Score Calculation (Do NOT trust client WPM/Accuracy).
    //    Correct / incorrect characters are recomputed from the typed text against the
    //    event's own passage; keystroke counters are clamped so they cannot flatter the result.
    const typedText = typeof payload.typedText === 'string' ? payload.typedText : '';
    const passage = passageForRound(event, round);
    if (typedText.length > passage.length) {
      throw new Error('Typed text is longer than the passage.');
    }

    // Timing: actual time typed (sub-second precision), bounded by the configured test duration.
    // An attempt that finishes the passage early is scored over the time it actually took.
    const configuredDuration = event.test_duration || 60;
    const reportedElapsed = Number(payload.elapsedSeconds);
    const effectiveElapsedSecs =
      Number.isFinite(reportedElapsed) && reportedElapsed > 0
        ? Math.round(Math.min(configuredDuration, Math.max(1, reportedElapsed)) * 100) / 100
        : configuredDuration;

    const metrics = computeAttemptMetrics({
      passage,
      typedText,
      elapsedSeconds: effectiveElapsedSecs,
      totalKeystrokes: payload.totalKeystrokes,
      incorrectKeystrokes: payload.incorrectKeystrokes,
      corrections: payload.corrections,
    });
    const { wpm, wpmDisplay, accuracy } = metrics;
    const qualified = isQualifiedAttempt(accuracy, event.minimum_accuracy);
    const timeline = sanitizeTimeline(payload.timeline, Math.ceil(configuredDuration) + 5);
    const consistency = calculateConsistency(timeline);

    // 5. Save attempt
    const attemptData: Omit<TypingAttempt, 'id'> = {
      tab_switches: payload.tabSwitches || 0,
      round,
      event_id: event.id,
      participant_id: payload.participantId,
      started_at: payload.startedAt,
      completed_at: payload.completedAt,
      elapsed_seconds: effectiveElapsedSecs,
      wpm,
      wpm_display: wpmDisplay,
      raw_wpm: metrics.rawWpm,
      accuracy,
      correct_characters: metrics.correctCharacters,
      incorrect_characters: metrics.incorrectCharacters,
      total_characters: metrics.totalCharacters,
      total_keystrokes: metrics.totalKeystrokes,
      incorrect_keystrokes: metrics.incorrectKeystrokes,
      corrections: metrics.corrections,
      consistency,
      timeline,
      qualified,
      is_demo: event.is_demo,
      created_at: new Date().toISOString(),
    };

    let attempt: TypingAttempt;
    const pool = getPool();
    if (pool) {
      if (!isUuid(payload.participantId)) {
        throw new Error('Unknown participant. Please register again.');
      }
      const columns = Object.keys(attemptData) as (keyof typeof attemptData)[];
      try {
        const { rows } = await pool.query<TypingAttempt>(
          `INSERT INTO attempts (${columns.join(', ')})
           VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
           RETURNING *`,
          columns.map((col) => (col === 'timeline' ? JSON.stringify(attemptData[col]) : attemptData[col]))
        );
        attempt = rows[0];
      } catch (err: any) {
        if (err?.code === PG_FOREIGN_KEY_VIOLATION) {
          throw new Error('Unknown participant. Please register again.');
        }
        throw err;
      }
    } else {
      attempt = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ...attemptData,
      };
      memoryStore.attempts.push(attempt);
    }
    if (round === 'FINAL') clearProgress(payload.participantId);
    rankingsChanged();

    // 6. Personal Best Determination
    const allUserAttempts = [attempt, ...userAttempts];
    const qualifyingUserAttempts = allUserAttempts.filter((a) => a.qualified);

    // Sort descending by WPM then Accuracy
    qualifyingUserAttempts.sort((a, b) => {
      if (b.wpm !== a.wpm) return b.wpm - a.wpm;
      return b.accuracy - a.accuracy;
    });

    const bestAttempt = qualifyingUserAttempts[0];
    const isPersonalBest = qualified && bestAttempt?.id === attempt.id;
    const personalBestWpm = bestAttempt ? bestAttempt.wpm_display : wpmDisplay;

    // 7. Get updated leaderboard rank for this user (within the round)
    const leaderboard = await this.getLeaderboard(event.id, round);
    const userRankEntry = leaderboard.find((e) => e.participant_id === payload.participantId);
    const leaderboardRank = userRankEntry ? userRankEntry.rank : leaderboard.length + 1;

    const attemptsUsed = userAttempts.length + 1;
    const maxAttempts = event.max_attempts;
    const attemptsRemaining = maxAttempts !== null ? Math.max(0, maxAttempts - attemptsUsed) : null;

    return {
      attempt,
      isPersonalBest,
      personalBestWpm,
      leaderboardRank,
      attemptsUsed,
      maxAttempts,
      attemptsRemaining,
    };
  }

  /**
   * Public leaderboard for polling clients: getLeaderboard behind a short shared cache
   */
  static getLeaderboardCached(eventId: string, round: RoundKind = 'QUALIFIER'): Promise<LeaderboardEntry[]> {
    const now = Date.now();
    const key = `${eventId}:${round}`;
    const hit = leaderboardCache.get(key);
    if (hit && hit.expires > now) return hit.promise;

    const promise = this.getLeaderboard(eventId, round);
    leaderboardCache.set(key, { expires: now + LEADERBOARD_CACHE_MS, promise });
    promise.catch(() => leaderboardCache.delete(key));
    return promise;
  }

  /**
   * Retrieves live leaderboard with personal bests, 85% qualification filter, and tie-breakers:
   * 1. Highest WPM
   * 2. Highest Accuracy (tie-breaker)
   * 3. Earliest completed attempt (tie-breaker)
   */
  static async getLeaderboard(eventId: string, round: RoundKind = 'QUALIFIER'): Promise<LeaderboardEntry[]> {
    const pool = getPool();
    if (pool) {
      if (!isUuid(eventId)) return [];
      const { rows } = await pool.query<LeaderboardEntry>(
        'SELECT * FROM get_event_leaderboard($1, $2)',
        [eventId, round]
      );
      return rows;
    }

    // In-Memory Fallback calculation (must mirror get_event_leaderboard in SQL)
    const event = normalizeEvent(memoryStore.event);
    const participants = Array.from(memoryStore.participants.values()).filter(
      (p) =>
        p.event_id === eventId &&
        !p.disqualified &&
        (round !== 'FINAL' || event.finalist_ids.includes(p.id))
    );

    // Group attempts by participant
    const entries: {
      participant_id: string;
      name: string;
      student_id: string;
      best_wpm: number;
      best_wpm_precise: number;
      best_accuracy: number;
      best_raw_wpm: number;
      best_consistency: number;
      best_attempt_id: string;
      attempts_count: number;
      last_attempt_at: string;
    }[] = [];

    for (const p of participants) {
      const pAttempts = memoryStore.attempts.filter(
        (a) => a.participant_id === p.id && a.event_id === eventId && (a.round || 'QUALIFIER') === round
      );
      const qualifying = pAttempts.filter((a) => a.qualified && inRoundWindow(event, round, a));

      if (qualifying.length > 0) {
        // Sort to find best
        qualifying.sort((a, b) => {
          if (b.wpm !== a.wpm) return b.wpm - a.wpm;
          if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
          return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
        });

        const best = qualifying[0];
        entries.push({
          participant_id: p.id,
          name: p.name,
          student_id: p.student_id,
          best_wpm: best.wpm_display,
          best_wpm_precise: best.wpm,
          best_accuracy: best.accuracy,
          best_raw_wpm: best.raw_wpm,
          best_consistency: best.consistency,
          best_attempt_id: best.id,
          attempts_count: pAttempts.length,
          last_attempt_at: best.completed_at,
        });
      }
    }

    // Sort whole leaderboard by WPM descending, accuracy descending, timestamp ascending
    entries.sort((a, b) => {
      if (b.best_wpm_precise !== a.best_wpm_precise) return b.best_wpm_precise - a.best_wpm_precise;
      if (b.best_accuracy !== a.best_accuracy) return b.best_accuracy - a.best_accuracy;
      return new Date(a.last_attempt_at).getTime() - new Date(b.last_attempt_at).getTime();
    });

    return entries.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));
  }

  /**
   * Grand Final board: every finalist (seed order), ranked by best final-round attempt,
   * with any in-progress attempt attached. Before the final starts, the projected
   * finalists are the current top of the qualifier leaderboard.
   */
  static async getFinalStandings(eventArg?: ChampionshipEvent): Promise<FinalStanding[]> {
    const event = eventArg || (await this.getActiveEvent());
    const qualifier = await this.getLeaderboard(event.id, 'QUALIFIER');
    const started = event.final_status !== 'NOT_STARTED' && event.finalist_ids.length > 0;

    const seeds: LeaderboardEntry[] = started
      ? (event.finalist_ids
          .map((id) => qualifier.find((e) => e.participant_id === id))
          .filter(Boolean) as LeaderboardEntry[])
      : qualifier.slice(0, event.finalists_count || 2);

    // A finalist who was disqualified after seeding drops off the qualifier board; keep their seat visible.
    if (started && seeds.length < event.finalist_ids.length) {
      for (const id of event.finalist_ids) {
        if (seeds.some((s) => s.participant_id === id)) continue;
        const p = await this.getParticipant(id);
        if (p) {
          seeds.push({
            rank: 0, participant_id: p.id, name: p.name, student_id: p.student_id,
            best_wpm: 0, best_wpm_precise: 0, best_accuracy: 0, attempts_count: 0, last_attempt_at: '',
            disqualified: p.disqualified,
          });
        }
      }
      // restore seed order
      seeds.sort((a, b) => event.finalist_ids.indexOf(a.participant_id) - event.finalist_ids.indexOf(b.participant_id));
    }

    const finalBoard = started ? await this.getLeaderboard(event.id, 'FINAL') : [];
    const progress = new Map(getProgress().map((p) => [p.participant_id, p]));

    const standings: FinalStanding[] = seeds.map((seed, i) => {
      const f = finalBoard.find((e) => e.participant_id === seed.participant_id);
      return {
        seed: i + 1,
        participant_id: seed.participant_id,
        name: seed.name,
        student_id: seed.student_id,
        qualifier_wpm: seed.best_wpm,
        qualifier_accuracy: seed.best_accuracy,
        rank: f ? f.rank : null,
        best_wpm: f ? f.best_wpm : null,
        best_wpm_precise: f ? f.best_wpm_precise : null,
        best_accuracy: f ? f.best_accuracy : null,
        attempts_count: f ? f.attempts_count : 0,
        last_attempt_at: f ? f.last_attempt_at : null,
        live: progress.get(seed.participant_id) || null,
      };
    });

    // Ranked finalists first, then the rest in seed order
    standings.sort((a, b) => {
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
      if (a.rank !== null) return -1;
      if (b.rank !== null) return 1;
      return a.seed - b.seed;
    });
    return standings;
  }

  /**
   * Looks up a single participant (used to re-validate the browser-stored participant)
   */
  static async getParticipant(participantId: string): Promise<Participant | null> {
    const pool = getPool();
    if (pool) {
      if (!isUuid(participantId)) return null;
      const { rows } = await pool.query<Participant>('SELECT * FROM participants WHERE id = $1', [
        participantId,
      ]);
      return rows[0] || null;
    }

    return memoryStore.participants.get(participantId) || null;
  }

  /**
   * Retrieves participant attempt history
   */
  static async getParticipantAttempts(participantId: string): Promise<TypingAttempt[]> {
    const pool = getPool();
    if (pool) {
      if (!isUuid(participantId)) return [];
      const { rows } = await pool.query<TypingAttempt>(
        'SELECT * FROM attempts WHERE participant_id = $1 ORDER BY created_at DESC',
        [participantId]
      );
      return rows;
    }

    return memoryStore.attempts
      .filter((a) => a.participant_id === participantId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Retrieves all participants (with search & filter for Admin)
   */
  static async getAllParticipants(eventId: string): Promise<Participant[]> {
    const pool = getPool();
    if (pool) {
      if (!isUuid(eventId)) return [];
      const { rows } = await pool.query<Participant>(
        `SELECT p.*,
                (SELECT COUNT(*) FROM attempts a
                  WHERE a.participant_id = p.id AND a.event_id = p.event_id) AS attempts_count
         FROM participants p
         WHERE p.event_id = $1
         ORDER BY p.created_at DESC`,
        [eventId]
      );
      return rows;
    }

    return Array.from(memoryStore.participants.values())
      .filter((p) => p.event_id === eventId)
      .map((p) => {
        const count = memoryStore.attempts.filter(
          (a) => a.participant_id === p.id && a.event_id === eventId
        ).length;
        return {
          ...p,
          attempts_count: count,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Disqualify or reverse disqualification of a participant
   */
  static async setDisqualification(
    participantId: string,
    disqualified: boolean,
    reason?: string
  ): Promise<Participant | null> {
    const pool = getPool();
    if (pool) {
      if (!isUuid(participantId)) return null;
      const { rows } = await pool.query<Participant>(
        `UPDATE participants SET disqualified = $2, disqualification_reason = $3
         WHERE id = $1 RETURNING *`,
        [participantId, disqualified, disqualified ? reason || 'Rule violation' : null]
      );
      rankingsChanged();
      return rows[0] || null;
    }

    const p = memoryStore.participants.get(participantId);
    if (p) {
      p.disqualified = disqualified;
      p.disqualification_reason = disqualified ? reason || 'Rule violation' : null;
      rankingsChanged();
      return p;
    }
    return null;
  }

  /**
   * Admin stats overview (Requirement 29)
   */
  static async getAdminStats(): Promise<AdminStats> {
    const event = await this.getActiveEvent();
    const leaderboard = await this.getLeaderboard(event.id);
    const allParticipants = await this.getAllParticipants(event.id);

    let totalAttemptsCount = 0;
    const pool = getPool();
    if (pool) {
      const { rows } = await pool.query<{ count: number }>(
        'SELECT COUNT(*) AS count FROM attempts WHERE event_id = $1',
        [event.id]
      );
      totalAttemptsCount = rows[0]?.count || 0;
    } else {
      totalAttemptsCount = memoryStore.attempts.filter((a) => a.event_id === event.id).length;
    }

    const qualifiedCount = leaderboard.length;
    const finalists = leaderboard.slice(0, event.finalists_count || 2);
    const finalStandings = await this.getFinalStandings(event);

    return {
      event,
      totalParticipants: allParticipants.length,
      totalAttempts: totalAttemptsCount,
      qualifiedParticipants: qualifiedCount,
      topParticipants: leaderboard.slice(0, 10),
      finalists,
      finalStandings,
      currentServerTime: new Date().toISOString(),
    };
  }

  /**
   * Generates mock simulated activity for Demo mode (Requirement 25)
   */
  static async simulateDemoActivity(): Promise<void> {
    const event = await this.getActiveEvent();
    const demoNames = [
      { name: 'Vikram', id: 'MAC-201' },
      { name: 'Ananya', id: 'MAC-202' },
      { name: 'Rohan', id: 'MAC-203' },
      { name: 'Sneha', id: 'MAC-204' },
      { name: 'Aditya', id: 'MAC-205' },
    ];

    for (const d of demoNames) {
      const p = await this.registerParticipant(event.id, d.name, d.id, `${d.id.toLowerCase()}@demo.local`);
      const duration = event.test_duration || 60;
      const wpm = Math.floor(Math.random() * 45) + 65; // 65 - 110 WPM
      const acc = Math.round((Math.random() * 15 + 85) * 10) / 10; // 85% - 100%
      const totalChars = Math.min(event.passage.length, Math.round((wpm * 5 * duration) / 60));

      // Build a typed text with a few uncorrected typos; the rest of the
      // mistypes were corrected with backspace (counted as keystrokes, not text).
      const mistypes = Math.round(totalChars * (1 - acc / 100));
      const typos = Math.floor(mistypes / 3);
      const chars = event.passage.substring(0, totalChars).split('');
      for (let i = 0; i < typos && chars.length > 0; i++) {
        const idx = Math.floor(Math.random() * chars.length);
        chars[idx] = chars[idx] === 'x' ? 'z' : 'x';
      }

      await this.submitAttempt({
        eventId: event.id,
        participantId: p.id,
        sessionId: p.session_id,
        startedAt: new Date(Date.now() - duration * 1000).toISOString(),
        completedAt: new Date().toISOString(),
        elapsedSeconds: duration,
        passageText: event.passage,
        typedText: chars.join(''),
        totalKeystrokes: totalChars + (mistypes - typos),
        incorrectKeystrokes: mistypes,
        corrections: mistypes - typos,
      });
    }
  }

  /**
   * Retrieves all attempts for CSV export
   */
  static async getAllAttempts(eventId: string): Promise<any[]> {
    const pool = getPool();
    if (pool) {
      if (!isUuid(eventId)) return [];
      const { rows } = await pool.query(
        `SELECT a.*,
                json_build_object(
                  'name', p.name,
                  'student_id', p.student_id,
                  'disqualified', p.disqualified
                ) AS participant
         FROM attempts a
         JOIN participants p ON p.id = a.participant_id
         WHERE a.event_id = $1
         ORDER BY a.created_at DESC`,
        [eventId]
      );
      return rows;
    }

    return memoryStore.attempts
      .filter((a) => a.event_id === eventId)
      .map((a) => {
        const p = memoryStore.participants.get(a.participant_id);
        return {
          ...a,
          participant: {
            name: p?.name || 'Unknown',
            student_id: p?.student_id || 'N/A',
            disqualified: p?.disqualified || false,
          },
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}
