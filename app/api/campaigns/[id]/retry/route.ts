/**
 * POST /api/campaigns/[id]/retry — Retry failed emails for a campaign.
 * Resets all 'failed' EmailLogs back to 'pending' and campaign to 'scheduled'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { retryFailedEmails } from '@/services/campaign.service';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const retried = await retryFailedEmails(id);
    return NextResponse.json({
      success: true,
      message: `${retried} failed email(s) queued for retry.`,
      retried,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
