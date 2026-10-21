import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  constantTimeCompare,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  invalidateSession,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
} from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username, password, action } = body;
    const clientIp = getClientIp(request);

    // 1. Handle Logout
    if (action === 'logout') {
      const cookieStore = cookies();
      const currentToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
      if (currentToken) {
        const session = verifySessionToken(currentToken);
        if (session) {
          invalidateSession(session.sessionId);
        }
      }
      cookieStore.delete(ADMIN_COOKIE_NAME);
      return NextResponse.json({ success: true, authenticated: false });
    }

    // 2. Check Rate Limiter
    const rateCheck = checkLoginRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed login attempts. Please wait ${rateCheck.retryAfterSeconds || 60} seconds before retrying.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfterSeconds || 60),
          },
        }
      );
    }

    // 3. Verify Server Environment Configuration
    const configuredUsername = process.env.ADMIN_USERNAME;
    const configuredPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    const configuredSecret = process.env.ADMIN_SESSION_SECRET;

    if (!configuredUsername || !configuredPasswordHash || !configuredSecret) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin authentication is not configured on this server. Run npm run admin:setup first.',
        },
        { status: 503 }
      );
    }

    // 4. Validate Credentials
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      recordFailedLogin(clientIp);
      return NextResponse.json(
        { success: false, error: 'Invalid admin credentials' },
        { status: 401 }
      );
    }

    const isUsernameMatch = constantTimeCompare(username.trim(), configuredUsername);
    const isPasswordMatch = isUsernameMatch && verifyPassword(password, configuredPasswordHash);

    if (!isUsernameMatch || !isPasswordMatch) {
      const result = recordFailedLogin(clientIp);
      return NextResponse.json(
        {
          success: false,
          error: result.lockedOut
            ? 'Account locked due to multiple failed login attempts. Please try again in 15 minutes.'
            : 'Invalid admin credentials',
        },
        { status: 401 }
      );
    }

    // 5. Successful Authentication
    resetLoginRateLimit(clientIp);
    const sessionToken = createSessionToken(configuredUsername);

    const cookieStore = cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });

    return NextResponse.json({
      success: true,
      authenticated: true,
      username: configuredUsername,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Authentication service error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);

    return NextResponse.json({
      authenticated: Boolean(session),
      username: session ? session.username : null,
    });
  } catch {
    return NextResponse.json({
      authenticated: false,
      username: null,
    });
  }
}
