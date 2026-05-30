/**
 * GET /api/leads?campaignId=xxx&page=1&limit=50
 * Returns paginated leads for a given campaign.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLeadsByCampaign } from '@/services/lead.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required.' }, { status: 400 });
    }

    const { leads, total } = await getLeadsByCampaign(campaignId, page, limit);

    return NextResponse.json({
      leads,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
