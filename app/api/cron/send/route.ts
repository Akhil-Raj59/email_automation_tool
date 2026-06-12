/**
 * GET /api/cron/send — Daily campaign processing trigger.
 *
 * Invoked exclusively by Vercel Cron (0 0 * * *) on the Hobby plan.
 * Protected by Vercel's standard Authorization: Bearer <CRON_SECRET> header.
 *
 * Security model:
 *   Vercel automatically forwards the CRON_SECRET env var as a Bearer token
 *   on every cron invocation. Unauthenticated requests are rejected with 401.
 *   This prevents external actors from triggering sends manually.
 *
 * Timeout model:
 *   campaign.service.runDailyCron() enforces its own 12s internal budget,
 *   guaranteeing it returns before Vercel's 15s hard kill.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyCron } from '@/services/campaign.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[cron/send] Unauthorized invocation attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Run ───────────────────────────────────────────────────────────────────
  console.log('[cron/send] Cron invoked at', new Date().toISOString());

  try {
    const result = await runDailyCron();

    console.log('[cron/send] Run complete:', JSON.stringify(result));

    return NextResponse.json({
      ok: true,
      runAt: new Date().toISOString(),
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron/send] Fatal error:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
