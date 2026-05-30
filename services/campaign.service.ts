/**
 * Campaign Service — Orchestrates the email sending pipeline.
 * Responsible for:
 *   1. Fetching due campaigns
 *   2. Loading their pending leads (EmailLogs)
 *   3. Sending each email via email.service
 *   4. Updating EmailLog status (sent / failed)
 *   5. Updating Campaign counters
 *   6. Enforcing the daily 50-email rate cap
 */

import { connectToDatabase } from '@/lib/db';
import Campaign from '@/models/Campaign';
import { EmailLog } from '@/models/EmailLog';
import { Lead } from '@/models/Lead';
import { sendEmail, interpolateTemplate } from './email.service';
import { getDailyEmailsSent } from '@/utils/rateLimit';

const DAILY_EMAIL_CAP = parseInt(process.env.DAILY_EMAIL_CAP || '50', 10);

/**
 * Process a single campaign — send remaining pending emails.
 * Called by the cron job or manual trigger API.
 */
export async function processCampaign(campaignId: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  await connectToDatabase();

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  if (!['scheduled', 'sending'].includes(campaign.status)) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Mark as actively sending
  campaign.status = 'sending';
  await campaign.save();

  // Check global daily cap before we proceed
  const todaySent = await getDailyEmailsSent();
  if (todaySent >= DAILY_EMAIL_CAP) {
    console.warn(`[campaign.service] Daily cap of ${DAILY_EMAIL_CAP} reached. Skipping.`);
    return { sent: 0, failed: 0, skipped: 1 };
  }

  const remainingCapacity = DAILY_EMAIL_CAP - todaySent;

  // Fetch pending email logs for this campaign
  const pendingLogs = await EmailLog.find({
    campaignId: campaign._id,
    status: 'pending',
  }).limit(remainingCapacity);

  let sent = 0;
  let failed = 0;

  for (const log of pendingLogs) {
    const lead = await Lead.findById(log.leadId);
    if (!lead || lead.status === 'unsubscribed') {
      // Skip unsubscribed leads silently
      await EmailLog.findByIdAndUpdate(log._id, { status: 'failed', errorReason: 'Lead unsubscribed or not found' });
      failed++;
      continue;
    }

    // Interpolate template variables (e.g., {{name}}, {{company}})
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

    // Mark as sending and increment attempt count
    await EmailLog.findByIdAndUpdate(log._id, {
      $inc: { attempts: 1 },
      status: 'sending',
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
  }

  // Update campaign counters
  const newSentCount = campaign.sentCount + sent;
  const newFailedCount = campaign.failedCount + failed;
  const allDone = newSentCount + newFailedCount >= campaign.totalCount;

  await Campaign.findByIdAndUpdate(campaign._id, {
    sentCount: newSentCount,
    failedCount: newFailedCount,
    status: allDone ? 'completed' : 'sending',
  });

  return { sent, failed, skipped: 0 };
}

/**
 * Find all campaigns that are due for sending.
 * A campaign is "due" if its status is 'scheduled' and scheduledAt <= now.
 */
export async function getDueCampaigns() {
  await connectToDatabase();
  return Campaign.find({
    status: 'scheduled',
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

  // Reset campaign back to scheduled if it was completed/failed
  await Campaign.findByIdAndUpdate(campaignId, { status: 'scheduled' });

  return result.modifiedCount;
}
