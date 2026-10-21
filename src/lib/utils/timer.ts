// Server-authoritative timing utilities

export interface EventTimerInfo {
  status: 'NOT_STARTED' | 'LIVE' | 'ENDED';
  remainingSeconds: number;
  formattedRemaining: string;
  isExpired: boolean;
  canStartTest: boolean;
  maxTestDurationAllowed: number; // e.g. 60 or less if near event end
}

/**
 * Calculates remaining event time against the server-authoritative end time.
 */
export function getEventTimerInfo(
  status: 'NOT_STARTED' | 'LIVE' | 'ENDED',
  startTime: string | null,
  endTime: string | null,
  configuredTestDuration: number = 60,
  serverOffsetMs: number = 0
): EventTimerInfo {
  if (status !== 'LIVE' || !endTime) {
    return {
      status,
      remainingSeconds: 0,
      formattedRemaining: status === 'NOT_STARTED' ? 'Starting Soon' : 'Event Concluded',
      isExpired: status === 'ENDED',
      canStartTest: false,
      maxTestDurationAllowed: 0,
    };
  }

  const nowMs = Date.now() + serverOffsetMs;
  const endMs = new Date(endTime).getTime();
  const diffMs = endMs - nowMs;
  const remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (remainingSeconds <= 0) {
    return {
      status: 'ENDED',
      remainingSeconds: 0,
      formattedRemaining: '00:00',
      isExpired: true,
      canStartTest: false,
      maxTestDurationAllowed: 0,
    };
  }

  // Edge case 13: If remaining time < configured test duration (e.g. 20s remaining),
  // test cannot exceed remaining time!
  const maxTestDurationAllowed = Math.min(configuredTestDuration, remainingSeconds);

  return {
    status: 'LIVE',
    remainingSeconds,
    formattedRemaining: formatDuration(remainingSeconds),
    isExpired: false,
    canStartTest: remainingSeconds > 0,
    maxTestDurationAllowed,
  };
}

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats an ISO date string cleanly for Mac UI
 */
export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}
