/**
 * GET /api/dashboard/stats — Returns aggregate stats for the overview page.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { EmailLog } from '@/models/EmailLog';
import Campaign from '@/models/Campaign';
import { getDailyEmailsSent } from '@/utils/rateLimit';

export async function GET() {
  try {
    await connectToDatabase();

    const [
      totalSent,
      totalFailed,
      totalPending,
      todaySent,
      recentCampaigns,
    ] = await Promise.all([
      EmailLog.countDocuments({ status: 'sent' }),
      EmailLog.countDocuments({ status: 'failed' }),
      EmailLog.countDocuments({ status: 'pending' }),
      getDailyEmailsSent(),
      Campaign.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title subject status sentCount totalCount scheduledAt'),
    ]);

    return NextResponse.json({
      metrics: {
        totalSent,
        totalFailed,
        totalPending,
        todaySent,
        dailyCap: parseInt(process.env.DAILY_EMAIL_CAP || '50', 10),
      },
      recentCampaigns,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
