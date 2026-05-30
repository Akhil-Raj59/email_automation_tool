/**
 * GET /api/cron/send — Manually trigger campaign processing.
 * Used by Render Cron Jobs or external schedulers.
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDueCampaigns, processCampaign } from '@/services/campaign.service';

export async function GET(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dueCampaigns = await getDueCampaigns();

    if (dueCampaigns.length === 0) {
      return NextResponse.json({ message: 'No campaigns due.', processed: 0 });
    }

    const results = await Promise.all(
      dueCampaigns.map(async (campaign) => {
        const result = await processCampaign(String(campaign._id));
        return { id: String(campaign._id), title: campaign.title, ...result };
      })
    );

    return NextResponse.json({
      message: `Processed ${dueCampaigns.length} campaign(s).`,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
