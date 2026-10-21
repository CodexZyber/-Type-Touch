import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const ADMIN_COOKIE_NAME = 'mactober_admin_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect admin pages, excluding the login page itself
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      // Behind nginx, request.url carries the internal host (e.g. localhost:3100),
      // so build the redirect from the public Host/proto that nginx forwards.
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
      const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
      const loginUrl = new URL('/admin/login', host ? `${proto}://${host}` : request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
