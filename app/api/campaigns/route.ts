/**
 * POST /api/campaigns — Create a new campaign.
 * GET  /api/campaigns — List all campaigns (paginated).
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Campaign from '@/models/Campaign';
import { validateCampaignPayload } from '@/utils/helpers';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status');

    const filter = status ? { status } : {};

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Campaign.countDocuments(filter),
    ]);

    return NextResponse.json({
      campaigns,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const errors = validateCampaignPayload(body);

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const campaign = await Campaign.create({
      title: body.title.trim(),
      subject: body.subject.trim(),
      body: body.body.trim(),
      scheduledAt: new Date(body.scheduledAt),
      provider: body.provider || 'gmail',
      status: 'draft',
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
