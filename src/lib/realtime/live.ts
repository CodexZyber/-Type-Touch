// In-process realtime hub for the live leaderboard.
//
// The app runs as a single Node process (systemd on the VM, one container
// locally), so an in-memory broadcaster is enough: every browser holds one
// Server-Sent Events connection to /api/live, and the store calls
// `notifyChange()` after any write that affects rankings. The hub then builds
// ONE snapshot (event + qualifier leaderboard + Grand Final standings) and
// writes it to every connection, so 200 viewers cost one database round trip
// per change instead of one per poll.
//
// Finalists additionally stream their in-progress WPM while typing
// (`setProgress`), which is ephemeral and never touches the database.

import type { ChampionshipEvent, FinalStanding, LeaderboardEntry, LiveProgress } from '@/types';

export interface LiveSnapshot {
  event: ChampionshipEvent;
  leaderboard: LeaderboardEntry[];
  finalStandings: FinalStanding[];
  progress: LiveProgress[];
  serverTime: string;
}

type Client = {
  id: number;
  send: (eventName: string, data: unknown) => void;
};

interface Hub {
  clients: Map<number, Client>;
  nextId: number;
  progress: Map<string, LiveProgress>;
  changeTimer: NodeJS.Timeout | null;
  changeAgain: boolean;
  building: boolean;
  progressTimer: NodeJS.Timeout | null;
}

// Survives Next.js dev hot reloads and is shared by every route handler.
const g = globalThis as any;
if (!g.__tensorLiveHub) {
  g.__tensorLiveHub = {
    clients: new Map(),
    nextId: 1,
    progress: new Map(),
    changeTimer: null,
    changeAgain: false,
    building: false,
    progressTimer: null,
  } satisfies Hub;
}
const hub: Hub = g.__tensorLiveHub;

/** Coalesce bursts of submissions into at most ~2 broadcasts per second. */
const CHANGE_DEBOUNCE_MS = 400;
const PROGRESS_THROTTLE_MS = 250;
/** A finalist's live progress is dropped if they stop reporting for this long. */
const PROGRESS_TTL_MS = 20_000;

export function addClient(send: Client['send']): number {
  const id = hub.nextId++;
  hub.clients.set(id, { id, send });
  return id;
}

export function removeClient(id: number): void {
  hub.clients.delete(id);
}

export function clientCount(): number {
  return hub.clients.size;
}

function broadcast(eventName: string, data: unknown): void {
  for (const client of hub.clients.values()) {
    try {
      client.send(eventName, data);
    } catch {
      hub.clients.delete(client.id);
    }
  }
}

/** Current finalist progress entries, with stale ones pruned. */
export function getProgress(): LiveProgress[] {
  const cutoff = Date.now() - PROGRESS_TTL_MS;
  for (const [id, p] of hub.progress) {
    if (new Date(p.updated_at).getTime() < cutoff) hub.progress.delete(id);
  }
  return Array.from(hub.progress.values());
}

export function setProgress(progress: LiveProgress): void {
  hub.progress.set(progress.participant_id, progress);
  if (hub.progressTimer) return;
  hub.progressTimer = setTimeout(() => {
    hub.progressTimer = null;
    broadcast('progress', getProgress());
  }, PROGRESS_THROTTLE_MS);
}

export function clearProgress(participantId?: string): void {
  if (participantId) hub.progress.delete(participantId);
  else hub.progress.clear();
  broadcast('progress', getProgress());
}

/** Builds the full snapshot every connection receives. */
export async function buildSnapshot(): Promise<LiveSnapshot> {
  // Imported lazily: the store imports this module to call notifyChange().
  const { EventService } = await import('@/lib/store/event-store');
  const event = await EventService.getActiveEvent();
  const [leaderboard, finalStandings] = await Promise.all([
    EventService.getLeaderboard(event.id, 'QUALIFIER'),
    EventService.getFinalStandings(event),
  ]);
  return {
    event,
    leaderboard,
    finalStandings,
    progress: getProgress(),
    serverTime: new Date().toISOString(),
  };
}

/**
 * Call after any write that can change rankings or event state. Debounced and
 * serialized: if changes keep arriving while a snapshot is being built, one
 * more build is scheduled afterwards.
 */
export function notifyChange(): void {
  if (hub.clients.size === 0) return;
  if (hub.changeTimer || hub.building) {
    hub.changeAgain = true;
    return;
  }
  hub.changeTimer = setTimeout(async () => {
    hub.changeTimer = null;
    hub.building = true;
    try {
      const snapshot = await buildSnapshot();
      broadcast('update', snapshot);
    } catch (err) {
      console.error('[live] snapshot failed', err);
    } finally {
      hub.building = false;
      if (hub.changeAgain) {
        hub.changeAgain = false;
        notifyChange();
      }
    }
  }, CHANGE_DEBOUNCE_MS);
}
