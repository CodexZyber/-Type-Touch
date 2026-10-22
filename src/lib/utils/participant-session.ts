import { Participant } from '@/types';

export const PARTICIPANT_STORAGE_KEY = 'tensor_mactober_participant';
/** Window event fired after sign-in so the navbar picks up the new identity without a navigation */
export const PARTICIPANT_CHANGED_EVENT = 'tensor-participant-changed';

/**
 * Signs the student out: retires the session on the server (best effort), forgets the
 * stored identity and reloads into the contest page so no page keeps the old participant.
 */
export async function logoutParticipant(): Promise<void> {
  try {
    const raw = localStorage.getItem(PARTICIPANT_STORAGE_KEY);
    const stored: Participant | null = raw ? JSON.parse(raw) : null;
    if (stored?.id) {
      await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout', participantId: stored.id, sessionId: stored.session_id }),
      });
    }
  } catch (e) {
    // Offline: still sign out locally
  }
  try {
    localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
  } catch (e) {
    // storage blocked: nothing stored to clear
  }
  window.location.href = '/contest';
}

/**
 * Loads the browser-stored participant and re-validates it with the server.
 * Clears it when the server no longer recognises that id + session (unknown id, or
 * the student signed in on another device), so the user is prompted to sign in.
 */
export async function loadVerifiedParticipant(): Promise<Participant | null> {
  let stored: Participant | null = null;
  try {
    const raw = localStorage.getItem(PARTICIPANT_STORAGE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!stored?.id) return null;

  try {
    const res = await fetch(
      `/api/participants?participantId=${encodeURIComponent(stored.id)}&sessionId=${encodeURIComponent(stored.session_id || '')}`
    );
    const data = await res.json();
    if (data.success) {
      if (!data.participant) {
        localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
        return null;
      }
      localStorage.setItem(PARTICIPANT_STORAGE_KEY, JSON.stringify(data.participant));
      return data.participant;
    }
  } catch (e) {
    // Network hiccup: keep the stored identity rather than logging the user out
  }
  return stored;
}
