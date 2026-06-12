/**
 * GET /api/cron/send — Manually trigger campaign processing.
 * Invoked securely by Vercel Cron on an hourly schedule.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDueCampaigns, processCampaign } from '@/services/campaign.service';

// Allow maximum possible execution time for this endpoint
export const maxDuration = 60; // 60s for Pro, Hobby defaults to 15s natively
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Verify Vercel Cron Secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('Unauthorized cron invocation attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dueCampaigns = await getDueCampaigns();

    if (dueCampaigns.length === 0) {
      return NextResponse.json({ message: 'No campaigns due.', processed: 0 });
    }

    const results = [];
    let totalSent = 0;
    
    // We process them sequentially. Given our micro-batch size of 5, this is safe.
    for (const campaign of dueCampaigns) {
      const result = await processCampaign(String(campaign._id));
      results.push({ id: String(campaign._id), title: campaign.title, ...result });
      totalSent += result.sent;
      
      // If we hit a daily limit during processing of one campaign, we shouldn't keep processing others
      if (result.skipped > 0) {
        break; // Daily cap reached
      }
    }

    return NextResponse.json({
      message: `Cron executed. Processed ${dueCampaigns.length} campaign(s). Sent ${totalSent} emails.`,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron/send] Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
