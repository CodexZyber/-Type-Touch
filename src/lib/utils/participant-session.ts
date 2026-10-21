import { Participant } from '@/types';

export const PARTICIPANT_STORAGE_KEY = 'tensor_mactober_participant';

/**
 * Loads the browser-stored participant and re-validates it with the server.
 * Clears it when the server no longer knows that id (e.g. it was created
 * against a different/in-memory store), so the user is prompted to register.
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
    const res = await fetch(`/api/participants?participantId=${encodeURIComponent(stored.id)}`);
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
