/**
 * proxy.ts — Next.js 16 route protection proxy.
 * Redirects unauthenticated users to /login.
 * Renamed from middleware.ts per Next.js 16 convention.
 */

import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/health'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths, static assets, and the cron endpoint (secret-protected)
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = req.cookies.get('vanguard_session');
  if (!session || session.value !== 'authenticated') {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
