/**
 * GET    /api/campaigns/[id] — Get a single campaign.
 * PATCH  /api/campaigns/[id] — Update campaign (status, schedule, etc).
 * DELETE /api/campaigns/[id] — Delete campaign and all related data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Campaign from '@/models/Campaign';
import { EmailLog } from '@/models/EmailLog';
import { Lead } from '@/models/Lead';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const campaign = await Campaign.findById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json({ campaign });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();

    // Only allow safe fields to be updated
    const allowedFields: Record<string, unknown> = {};
    const safeKeys = ['title', 'subject', 'body', 'scheduledAt', 'status', 'provider'];
    for (const key of safeKeys) {
      if (body[key] !== undefined) allowedFields[key] = body[key];
    }

    const campaign = await Campaign.findByIdAndUpdate(id, allowedFields, { new: true });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    return NextResponse.json({ campaign });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const { id } = await params;

    await Promise.all([
      Campaign.findByIdAndDelete(id),
      EmailLog.deleteMany({ campaignId: id }),
      Lead.deleteMany({ campaignId: id }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
