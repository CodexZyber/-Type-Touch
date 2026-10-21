import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const ADMIN_COOKIE_NAME = 'mactober_admin_session';
export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours

// In-memory revocation set for invalidated sessions
// In multi-replica serverless setups, this provides instant local revocation;
// for persistent revocation across cold starts, token exp enforces bounded lifetime.
const revokedSessionIds = new Set<string>();

// Rate limiter state for login attempts (IP -> { count, lockUntil, lastAttempt })
interface RateLimitRecord {
  count: number;
  lockUntil: number;
  lastAttempt: number;
}
const loginRateLimits = new Map<string, RateLimitRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Validates login rate limit for a client IP.
 * Returns true if allowed, false if locked out.
 */
export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = loginRateLimits.get(ip);

  if (!record) return { allowed: true };

  // If currently locked out
  if (record.lockUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // If lockout expired, reset
  if (now - record.lastAttempt > LOCKOUT_WINDOW_MS) {
    loginRateLimits.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Records a failed login attempt.
 */
export function recordFailedLogin(ip: string): { lockedOut: boolean; attemptsRemaining: number } {
  const now = Date.now();
  const record = loginRateLimits.get(ip) || { count: 0, lockUntil: 0, lastAttempt: now };

  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockUntil = now + LOCKOUT_WINDOW_MS;
    loginRateLimits.set(ip, record);
    return { lockedOut: true, attemptsRemaining: 0 };
  }

  loginRateLimits.set(ip, record);
  return { lockedOut: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - record.count };
}

/**
 * Resets failed login attempts for a client IP upon successful authentication.
 */
export function resetLoginRateLimit(ip: string): void {
  loginRateLimits.delete(ip);
}

/**
 * Secure constant-time string comparison using SHA-256 digests
 * to prevent timing side-channel attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Verifies a password against the stored scrypt hash string.
 * Format: scrypt$N=16384,r=8,p=1$<saltHex>$<derivedKeyHex>
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!password || !storedHash) return false;

    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') {
      return false;
    }

    const paramsStr = parts[1]; // e.g. N=16384,r=8,p=1
    const saltHex = parts[2];
    const expectedKeyHex = parts[3];

    const paramMap: Record<string, number> = {};
    for (const pair of paramsStr.split(',')) {
      const [k, v] = pair.split('=');
      paramMap[k] = parseInt(v, 10);
    }

    const N = paramMap.N || 16384;
    const r = paramMap.r || 8;
    const p = paramMap.p || 1;

    const derivedKey = crypto.scryptSync(password, saltHex, 64, { N, r, p });
    const expectedKey = Buffer.from(expectedKeyHex, 'hex');

    if (derivedKey.length !== expectedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}

export interface AdminSession {
  sessionId: string;
  username: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Creates a cryptographically signed session token.
 */
export function createSessionToken(username: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET is not configured or too short.');
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_SECONDS * 1000;

  const sessionData: AdminSession = {
    sessionId,
    username,
    issuedAt: now,
    expiresAt,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Validates a signed session token.
 * Rejects expired, forged, or revoked sessions.
 */
export function verifySessionToken(token: string | undefined | null): AdminSession | null {
  try {
    if (!token) return null;

    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || secret.length < 32) return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64url');

    // Constant-time check on signature
    if (!constantTimeCompare(signature, expectedSignature)) {
      return null;
    }

    const sessionData: AdminSession = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf8')
    );

    // Validate fields
    if (!sessionData.sessionId || !sessionData.username || !sessionData.expiresAt) {
      return null;
    }

    // Check expiration
    if (Date.now() >= sessionData.expiresAt) {
      return null;
    }

    // Check revocation
    if (revokedSessionIds.has(sessionData.sessionId)) {
      return null;
    }

    // Check username matches configured admin
    const configuredUser = process.env.ADMIN_USERNAME;
    if (!configuredUser || !constantTimeCompare(sessionData.username, configuredUser)) {
      return null;
    }

    return sessionData;
  } catch {
    return null;
  }
}

/**
 * Invalidates / revokes a session ID.
 */
export function invalidateSession(sessionId: string): void {
  if (sessionId) {
    revokedSessionIds.add(sessionId);
  }
}

/**
 * Server guard function to enforce admin authentication across API routes.
 */
export async function requireAdminSession(request?: Request): Promise<
  | { authorized: true; session: AdminSession }
  | { authorized: false; response: NextResponse }
> {
  let token: string | undefined;

  // 1. Try reading from Next.js cookie store
  try {
    const cookieStore = cookies();
    token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  } catch {
    // If running in a context where cookies() is not initialized, read from request header
    if (request) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
      if (match) token = match[1];
    }
  }

  // Fallback to request header if still empty
  if (!token && request) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
    if (match) token = match[1];
  }

  const session = verifySessionToken(token);

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Admin authentication required to perform this action.',
        },
        { status: 401 }
      ),
    };
  }

  return { authorized: true, session };
}
