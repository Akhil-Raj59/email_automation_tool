/**
 * GET  /api/health — Service health check.
 * Checks MongoDB connection and SMTP configuration.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { verifyConnection } from '@/services/email.service';

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {};

  // Check MongoDB
  try {
    await connectToDatabase();
    checks.mongodb = 'ok';
  } catch {
    checks.mongodb = 'error';
  }

  // Check SMTP
  try {
    const smtpOk = await verifyConnection();
    checks.smtp = smtpOk ? 'ok' : 'error';
  } catch {
    checks.smtp = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');

  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks },
    { status: allOk ? 200 : 503 }
  );
}
