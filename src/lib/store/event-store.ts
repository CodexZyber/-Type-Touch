import {
  ChampionshipEvent,
  Participant,
  TypingAttempt,
  LeaderboardEntry,
  SubmissionPayload,
  AdminStats,
} from '@/types';
import { calculateAccuracy, calculateWPM, isQualifiedAttempt } from '@/lib/utils/typing';
import { getPool, isUuid } from '@/lib/db/postgres';

// Initial Official Passage for Tensor MacTober
export const OFFICIAL_PASSAGE =
  'Silicon precision meets human agility on the keys of the future. Deep learning architectures transform simple vectors into complex thoughts, training neural networks across millions of gradient steps. As artificial intelligence reshapes human potential, mastery over fundamental tools remains paramount. Every keystroke is a signal, an instruction executed with absolute clarity and unmatched velocity. In this championship, focus and discipline separate the ordinary from the extraordinary. Push through the cognitive barrier, maintain composure under intense pressure, and calibrate your rhythm to perfection.';

export const DEMO_PASSAGE =
  'Speed and accuracy define the ultimate champion. Quick reflexes trigger flawless execution on modern mechanical switches.';

// In-Memory Fallback State (persists across server requests in memory)
class MemoryDataStore {
  event: ChampionshipEvent;
  participants: Map<string, Participant> = new Map();
  attempts: TypingAttempt[] = [];

  constructor() {
    this.event = {
      id: '00000000-0000-0000-0000-000000000001',
      name: "Tensor MacTober Touch Type Championship '26",
      subtitle: '60 seconds. One hour. Type your way to the top.',
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
      is_demo: false,
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
        email: `${s.student_id.toLowerCase()}@tensormactober.org`,
        session_id: `sess_${s.student_id}`,
        disqualified: false,
        disqualification_reason: null,
        created_at: new Date(baseTime).toISOString(),
      };
      this.participants.set(p.id, p);

      const elapsed = 60;
      const totalChars = Math.round(s.wpm * 5);
      const correctChars = Math.round((s.acc / 100) * totalChars);
      const incorrectChars = totalChars - correctChars;

      const att: TypingAttempt = {
        tab_switches: 0,
        id: `att_${s.id}`,
        event_id: this.event.id,
        participant_id: p.id,
        started_at: new Date(baseTime).toISOString(),
        completed_at: new Date(baseTime + 60000).toISOString(),
        elapsed_seconds: elapsed,
        wpm: s.wpm,
        wpm_display: s.wpm,
        accuracy: s.acc,
        correct_characters: correctChars,
        incorrect_characters: incorrectChars,
        total_characters: totalChars,
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
  'is_demo',
  'updated_at',
] as const;

// Postgres error code for foreign_key_violation
const PG_FOREIGN_KEY_VIOLATION = '23503';

// Every student and screen polls the public leaderboard, so concurrent polls share
// one query and reuse the result briefly. Cleared on any write that affects ranking.
const LEADERBOARD_CACHE_MS = 1000;
const leaderboardCache = new Map<string, { expires: number; promise: Promise<LeaderboardEntry[]> }>();

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
        }
      }
      return event;
    }

    // In-memory fallback
    const event = memoryStore.event;
    if (event.status === 'LIVE' && event.end_time) {
      if (new Date() >= new Date(event.end_time)) {
        event.status = 'ENDED';
        event.updated_at = new Date().toISOString();
      }
    }
    return event;
  }

  /**
   * Updates event configuration (Admin)
   */
  static async updateEvent(updates: Partial<ChampionshipEvent>): Promise<ChampionshipEvent> {
    const activeEvent = await this.getActiveEvent();

    // 1. Lock check: Do not allow configuration changes that create inconsistent attempts during a LIVE event (Requirement 4)
    if (activeEvent.status === 'LIVE') {
      const configKeys: (keyof ChampionshipEvent)[] = [
        'name',
        'subtitle',
        'organization_name',
        'event_duration',
        'test_duration',
        'minimum_accuracy',
        'max_attempts',
        'passage',
      ];
      const hasConfigChanges = configKeys.some(
        (key) => updates[key] !== undefined && updates[key] !== (activeEvent as any)[key]
      );
      if (hasConfigChanges) {
        throw new Error(
          'Configuration cannot be changed while the championship is LIVE. Please pause or end the event first.'
        );
      }
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
        [activeEvent.id, ...columns.map((col) => (newValues as any)[col])]
      );
      if (!rows[0]) {
        throw new Error('Event not found.');
      }
      leaderboardCache.clear();
      return rows[0];
    }

    // In-memory fallback
    Object.assign(memoryStore.event, newValues);
    leaderboardCache.clear();
    return memoryStore.event;
  }

  /**
   * Starts the event
   */
  static async startEvent(durationMinutes?: number): Promise<ChampionshipEvent> {
    const active = await this.getActiveEvent();
    const duration = durationMinutes || active.event_duration || 60;
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    return this.updateEvent({
      status: 'LIVE',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      event_duration: duration,
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
   * Resets the event
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

    return this.updateEvent({
      status: 'NOT_STARTED',
      start_time: null,
      end_time: null,
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

    // 1. Validate Event Status
    if (event.status !== 'LIVE') {
      throw new Error('Attempts are only allowed while the championship is LIVE.');
    }

    // 2. Validate Event Timing: Reject if event end time passed
    if (event.end_time && now.getTime() > new Date(event.end_time).getTime() + 5000) {
      throw new Error('The competition has ended. No more attempts are accepted.');
    }

    // 3. Enforce Maximum Attempts Limit (Requirement 1.D, 8, 9)
    const userAttempts = await this.getParticipantAttempts(payload.participantId);
    if (event.max_attempts !== null && event.max_attempts > 0) {
      if (userAttempts.length >= event.max_attempts) {
        throw new Error(
          `Maximum attempts reached (${event.max_attempts} / ${event.max_attempts}). No further attempts are permitted.`
        );
      }
    }

    // 4. Server-side Score Calculation (Do NOT trust client WPM/Accuracy)
    const { correctCharacters, incorrectCharacters, totalCharacters, elapsedSeconds } = payload;
    
    // Validate character counts
    const effectiveTotal = Math.max(totalCharacters, correctCharacters + incorrectCharacters);
    const accuracy = calculateAccuracy(correctCharacters, effectiveTotal);

    // Standard typing WPM: use server configured test duration or actual bounded elapsed time
    const configuredDuration = event.test_duration || 60;
    const effectiveElapsedSecs = elapsedSeconds
      ? Math.min(configuredDuration, Math.max(1, elapsedSeconds))
      : configuredDuration;

    const { precise: wpm, display: wpmDisplay } = calculateWPM(correctCharacters, effectiveElapsedSecs);
    const qualified = isQualifiedAttempt(accuracy, event.minimum_accuracy);

    // 5. Save attempt
    const attemptData: Omit<TypingAttempt, 'id'> = {
      tab_switches: payload.tabSwitches || 0,
      event_id: event.id,
      participant_id: payload.participantId,
      started_at: payload.startedAt,
      completed_at: payload.completedAt,
      elapsed_seconds: effectiveElapsedSecs,
      wpm,
      wpm_display: wpmDisplay,
      accuracy,
      correct_characters: correctCharacters,
      incorrect_characters: incorrectCharacters,
      total_characters: effectiveTotal,
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
          columns.map((col) => attemptData[col])
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
    leaderboardCache.clear();

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

    // 7. Get updated leaderboard rank for this user
    const leaderboard = await this.getLeaderboard(event.id);
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
  static getLeaderboardCached(eventId: string): Promise<LeaderboardEntry[]> {
    const now = Date.now();
    const hit = leaderboardCache.get(eventId);
    if (hit && hit.expires > now) return hit.promise;

    const promise = this.getLeaderboard(eventId);
    leaderboardCache.set(eventId, { expires: now + LEADERBOARD_CACHE_MS, promise });
    promise.catch(() => leaderboardCache.delete(eventId));
    return promise;
  }

  /**
   * Retrieves live leaderboard with personal bests, 85% qualification filter, and tie-breakers:
   * 1. Highest WPM
   * 2. Highest Accuracy (tie-breaker)
   * 3. Earliest completed attempt (tie-breaker)
   */
  static async getLeaderboard(eventId: string): Promise<LeaderboardEntry[]> {
    const pool = getPool();
    if (pool) {
      if (!isUuid(eventId)) return [];
      const { rows } = await pool.query<LeaderboardEntry>(
        'SELECT * FROM get_event_leaderboard($1)',
        [eventId]
      );
      return rows;
    }

    // In-Memory Fallback calculation
    const event = memoryStore.event;
    const participants = Array.from(memoryStore.participants.values()).filter(
      (p) => p.event_id === eventId && !p.disqualified
    );

    // Group attempts by participant
    const entries: {
      participant_id: string;
      name: string;
      student_id: string;
      best_wpm: number;
      best_wpm_precise: number;
      best_accuracy: number;
      attempts_count: number;
      last_attempt_at: string;
    }[] = [];

    for (const p of participants) {
      const pAttempts = memoryStore.attempts.filter(
        (a) => a.participant_id === p.id && a.event_id === eventId
      );
      const qualifying = pAttempts.filter((a) => a.qualified);

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
      leaderboardCache.clear();
      return rows[0] || null;
    }

    const p = memoryStore.participants.get(participantId);
    if (p) {
      p.disqualified = disqualified;
      p.disqualification_reason = disqualified ? reason || 'Rule violation' : null;
      leaderboardCache.clear();
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

    return {
      event,
      totalParticipants: allParticipants.length,
      totalAttempts: totalAttemptsCount,
      qualifiedParticipants: qualifiedCount,
      topParticipants: leaderboard.slice(0, 10),
      finalists,
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
      const wpm = Math.floor(Math.random() * 45) + 65; // 65 - 110 WPM
      const acc = Math.round((Math.random() * 15 + 85) * 10) / 10; // 85% - 100%
      const totalChars = Math.round(wpm * 5);
      const correctChars = Math.round((acc / 100) * totalChars);

      await this.submitAttempt({
        eventId: event.id,
        participantId: p.id,
        sessionId: p.session_id,
        startedAt: new Date(Date.now() - 60000).toISOString(),
        completedAt: new Date().toISOString(),
        elapsedSeconds: event.test_duration,
        passageText: event.passage,
        typedText: event.passage.substring(0, totalChars),
        correctCharacters: correctChars,
        incorrectCharacters: totalChars - correctChars,
        totalCharacters: totalChars,
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
