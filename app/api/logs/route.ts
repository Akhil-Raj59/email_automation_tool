/**
 * GET /api/logs — Get paginated email logs.
 * Supports filtering by campaign and status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { EmailLog } from '@/models/EmailLog';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build filter
    const filter: Record<string, unknown> = {};
    if (campaignId) filter.campaignId = new mongoose.Types.ObjectId(campaignId);
    if (status) filter.status = status;

    const [logs, total] = await Promise.all([
      EmailLog.find(filter)
        .populate('campaignId', 'title')
        .populate('leadId', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      EmailLog.countDocuments(filter),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
