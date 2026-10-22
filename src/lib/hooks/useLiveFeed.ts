'use client';

import { useEffect, useRef, useState } from 'react';
import { ChampionshipEvent, FinalStanding, LeaderboardEntry, LiveProgress } from '@/types';

export interface LiveFeedState {
  event: ChampionshipEvent | null;
  leaderboard: LeaderboardEntry[];
  finalStandings: FinalStanding[];
  progress: Record<string, LiveProgress>;
  serverOffsetMs: number;
  connected: boolean;
  loaded: boolean;
}

/** How often to poll if the event stream is unavailable (proxies, old browsers). */
const FALLBACK_POLL_MS = 5000;

/**
 * Subscribes to /api/live (Server-Sent Events). The server pushes a full
 * snapshot whenever rankings or event state change, plus finalists' live
 * progress during the Grand Final. Falls back to polling when the stream
 * cannot connect. Call `refresh()` to force a fetch (e.g. right after a submit).
 */
export function useLiveFeed(): LiveFeedState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<LiveFeedState>({
    event: null,
    leaderboard: [],
    finalStandings: [],
    progress: {},
    serverOffsetMs: 0,
    connected: false,
    loaded: false,
  });
  const connectedRef = useRef(false);

  const applySnapshot = (snap: any) => {
    if (!snap) return;
    const progress: Record<string, LiveProgress> = {};
    for (const p of snap.progress || []) progress[p.participant_id] = p;
    setState((prev) => ({
      ...prev,
      event: snap.event || prev.event,
      leaderboard: snap.leaderboard || prev.leaderboard,
      finalStandings: snap.finalStandings || prev.finalStandings,
      progress: snap.progress ? progress : prev.progress,
      serverOffsetMs: snap.serverTime ? new Date(snap.serverTime).getTime() - Date.now() : prev.serverOffsetMs,
      loaded: true,
    }));
  };

  const refresh = async () => {
    try {
      const [eventRes, lbRes, finalRes] = await Promise.all([
        fetch('/api/event'),
        fetch('/api/leaderboard'),
        fetch('/api/leaderboard?round=final'),
      ]);
      const eventData = await eventRes.json();
      const lbData = await lbRes.json();
      const finalData = await finalRes.json();
      applySnapshot({
        event: eventData.event,
        leaderboard: lbData.leaderboard,
        finalStandings: finalData.finalStandings,
        serverTime: eventData.serverTime,
      });
    } catch (e) {
      // keep last known state
    }
  };

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (poll) return;
      refresh();
      poll = setInterval(() => {
        if (!connectedRef.current) refresh();
      }, FALLBACK_POLL_MS);
    };

    if (typeof EventSource === 'undefined') {
      startPolling();
      return () => {
        if (poll) clearInterval(poll);
      };
    }

    es = new EventSource('/api/live');
    es.addEventListener('update', (ev) => {
      connectedRef.current = true;
      applySnapshot(JSON.parse((ev as MessageEvent).data));
      setState((prev) => (prev.connected ? prev : { ...prev, connected: true }));
    });
    es.addEventListener('progress', (ev) => {
      const list: LiveProgress[] = JSON.parse((ev as MessageEvent).data);
      const progress: Record<string, LiveProgress> = {};
      for (const p of list) progress[p.participant_id] = p;
      setState((prev) => ({ ...prev, progress }));
    });
    es.onerror = () => {
      // EventSource reconnects on its own; poll in the meantime
      connectedRef.current = false;
      setState((prev) => (prev.connected ? { ...prev, connected: false } : prev));
      startPolling();
    };

    // Safety net: if the first snapshot hasn't arrived shortly, fetch it
    const firstLoad = setTimeout(() => {
      if (!connectedRef.current) refresh();
    }, 1500);

    return () => {
      clearTimeout(firstLoad);
      if (poll) clearInterval(poll);
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, refresh };
}
