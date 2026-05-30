/**
 * POST /api/auth/login — Simple admin authentication.
 * Verifies the submitted password against ADMIN_PASSWORD env var.
 * Sets a session cookie on success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json({ error: 'Server misconfigured: ADMIN_PASSWORD not set.' }, { status: 500 });
    }

    if (password !== adminPassword) {
      // Small delay to prevent brute-force timing attacks
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
    }

    // Set a simple session cookie (HttpOnly, SameSite Strict)
    const cookieStore = await cookies();
    cookieStore.set('vanguard_session', 'authenticated', {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  // Sign out — clear session cookie
  const cookieStore = await cookies();
  cookieStore.delete('vanguard_session');
  return NextResponse.json({ success: true });
}
