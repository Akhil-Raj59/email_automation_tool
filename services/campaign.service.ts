/**
 * Campaign Service — Orchestrates the email sending pipeline.
 * Redesigned for Vercel Hobby Free Tier (Micro-batching & Idempotency).
 */

import { connectToDatabase } from '@/lib/db';
import Campaign from '@/models/Campaign';
import { EmailLog } from '@/models/EmailLog';
import { Lead } from '@/models/Lead';
import { sendEmail, interpolateTemplate } from './email.service';
import { getDailyEmailsSent } from '@/utils/rateLimit';

const DAILY_EMAIL_CAP = parseInt(process.env.DAILY_EMAIL_CAP || '25', 10);
const BATCH_SIZE = 5; // Safe limit for Vercel Hobby 15s execution time

/**
 * Process a single campaign — send a small micro-batch of emails.
 */
export async function processCampaign(campaignId: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  await connectToDatabase();

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  if (!['scheduled', 'processing'].includes(campaign.status)) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Mark as actively processing if scheduled
  if (campaign.status === 'scheduled') {
    campaign.status = 'processing';
    await campaign.save();
  }

  // 1. Check global daily cap before we proceed
  const todaySent = await getDailyEmailsSent();
  if (todaySent >= DAILY_EMAIL_CAP) {
    console.warn(`[campaign.service] Daily cap of ${DAILY_EMAIL_CAP} reached. Skipping.`);
    return { sent: 0, failed: 0, skipped: 1 };
  }

  const remainingCapacity = DAILY_EMAIL_CAP - todaySent;
  const currentBatchSize = Math.min(BATCH_SIZE, remainingCapacity);

  if (currentBatchSize <= 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // 2. Fetch pending email logs
  const pendingLogs = await EmailLog.find({
    campaignId: campaign._id,
    status: 'pending',
  }).limit(currentBatchSize);

  let sent = 0;
  let failed = 0;

  // 3. Atomically claim and process logs to prevent duplicate sending (Idempotency)
  for (const log of pendingLogs) {
    // Atomic update to claim this log
    const claimedLog = await EmailLog.findOneAndUpdate(
      { _id: log._id, status: 'pending' },
      { $set: { status: 'processing', attempts: log.attempts + 1 } },
      { new: true }
    );

    // If claimedLog is null, another concurrent process already grabbed it
    if (!claimedLog) {
      console.log(`[campaign.service] Log ${log._id} already claimed. Skipping.`);
      continue;
    }

    try {
      const lead = await Lead.findById(log.leadId);
      if (!lead || lead.status === 'unsubscribed') {
        await EmailLog.findByIdAndUpdate(log._id, { status: 'failed', errorReason: 'Lead unsubscribed or not found' });
        failed++;
        continue;
      }

      // Interpolate template variables
      const personalizedBody = interpolateTemplate(campaign.body, {
        name: lead.name,
        email: lead.email,
        ...Object.fromEntries(lead.variables as unknown as Map<string, string>),
      });
      const personalizedSubject = interpolateTemplate(campaign.subject, {
        name: lead.name,
        email: lead.email,
        ...Object.fromEntries(lead.variables as unknown as Map<string, string>),
      });

      const result = await sendEmail({
        to: lead.email,
        subject: personalizedSubject,
        html: personalizedBody,
      });

      if (result.success) {
        await EmailLog.findByIdAndUpdate(log._id, {
          status: 'sent',
          sentAt: new Date(),
        });
        sent++;
      } else {
        await EmailLog.findByIdAndUpdate(log._id, {
          status: 'failed',
          errorReason: result.error,
        });
        failed++;
      }
    } catch (err: any) {
      await EmailLog.findByIdAndUpdate(log._id, {
        status: 'failed',
        errorReason: err.message || 'Unknown error during send',
      });
      failed++;
    }
  }

  // 4. Update campaign counters
  const newSentCount = campaign.sentCount + sent;
  const newFailedCount = campaign.failedCount + failed;
  
  // Check if all logs are processed (no pending/processing left)
  const remainingLogsCount = await EmailLog.countDocuments({
    campaignId: campaign._id,
    status: { $in: ['pending', 'processing'] }
  });

  const allDone = remainingLogsCount === 0;

  await Campaign.findByIdAndUpdate(campaign._id, {
    sentCount: newSentCount,
    failedCount: newFailedCount,
    status: allDone ? 'completed' : 'processing',
  });

  return { sent, failed, skipped: 0 };
}

/**
 * Find all campaigns that are due for sending.
 * A campaign is "due" if its status is 'scheduled' or 'processing' and scheduledAt <= now.
 */
export async function getDueCampaigns() {
  await connectToDatabase();
  return Campaign.find({
    status: { $in: ['scheduled', 'processing'] },
    scheduledAt: { $lte: new Date() },
  });
}

/**
 * Retry all failed email logs for a given campaign.
 * Resets status back to 'pending' so the next cron run picks them up.
 */
export async function retryFailedEmails(campaignId: string): Promise<number> {
  await connectToDatabase();

  const result = await EmailLog.updateMany(
    { campaignId, status: 'failed' },
    { $set: { status: 'pending', errorReason: undefined } }
  );

  // Reset campaign back to processing
  await Campaign.findByIdAndUpdate(campaignId, { status: 'processing' });

  return result.modifiedCount;
}
