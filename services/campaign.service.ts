/**
 * Campaign Service — Orchestrates the daily email sending pipeline.
 *
 * Designed specifically for Vercel Hobby (Free Tier):
 *   - Single daily cron execution via Vercel Cron (0 0 * * *)
 *   - Hard time budget: exits cleanly at 12s, well before Vercel's 15s kill
 *   - Processes emails in concurrent micro-batches of 5
 *   - Atomic claiming prevents duplicate sends across any race condition
 *   - Stale processing recovery prevents permanently stuck records
 *   - Strict 25 emails/day cap enforced against live DB counts
 *
 * Flow per cron invocation:
 *   1. Recover any stale `processing` logs (stuck > 1 hour → back to `pending`)
 *   2. Check today's sent count against DAILY_EMAIL_CAP (25)
 *   3. Find due campaigns (scheduled/processing, scheduledAt <= now)
 *   4. For each campaign, run a time-budgeted loop:
 *      a. Fetch up to CONCURRENT_BATCH_SIZE (5) pending logs
 *      b. Atomically claim each: pending → processing
 *      c. Send all 5 concurrently with Promise.allSettled
 *      d. Update each log: processing → sent | failed
 *      e. Check time budget; exit loop if > TIME_BUDGET_MS
 *   5. Update campaign counters and final status
 */

import { connectToDatabase } from '@/lib/db';
import Campaign, { ICampaign } from '@/models/Campaign';
import { EmailLog } from '@/models/EmailLog';
import { Lead } from '@/models/Lead';
import { sendEmail, interpolateTemplate } from './email.service';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Maximum emails to send across ALL campaigns in a single cron run. */
const DAILY_EMAIL_CAP = parseInt(process.env.DAILY_EMAIL_CAP || '25', 10);

/** How many emails to send concurrently in one batch iteration. */
const CONCURRENT_BATCH_SIZE = 5;

/**
 * Hard stop at 12 000 ms — Vercel Hobby kills at 15 000 ms.
 * The 3-second buffer absorbs final DB writes after the last batch.
 */
const TIME_BUDGET_MS = 12_000;

/**
 * A log stuck in `processing` for longer than this is considered stale
 * (Vercel killed the function mid-send). Reverted to `pending` so it
 * can be retried on the next cron run.
 */
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CronRunResult {
  campaignsProcessed: number;
  sent: number;
  failed: number;
  skipped: number;
  staleLogs: number;        // logs recovered from stale processing
  timedOut: boolean;        // true if we hit the budget before finishing
  dailyCapReached: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Top-level entry point called by the cron route.
 * Processes all due campaigns within the shared time budget.
 */
export async function runDailyCron(): Promise<CronRunResult> {
  await connectToDatabase();

  const startTime = Date.now();
  const result: CronRunResult = {
    campaignsProcessed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    staleLogs: 0,
    timedOut: false,
    dailyCapReached: false,
  };

  // ── Step 1: Stale recovery ──────────────────────────────────────────────────
  result.staleLogs = await recoverStaleLogs();
  console.log(`[cron] Recovered ${result.staleLogs} stale processing log(s).`);

  // ── Step 2: Daily cap check ─────────────────────────────────────────────────
  const todaySent = await getDailyEmailsSent();
  if (todaySent >= DAILY_EMAIL_CAP) {
    console.log(`[cron] Daily cap of ${DAILY_EMAIL_CAP} already reached (${todaySent} sent). Exiting.`);
    result.dailyCapReached = true;
    return result;
  }

  const remainingToday = DAILY_EMAIL_CAP - todaySent;
  console.log(`[cron] Daily quota: ${todaySent}/${DAILY_EMAIL_CAP} sent. ${remainingToday} remaining.`);

  // ── Step 3: Find due campaigns ──────────────────────────────────────────────
  const dueCampaigns = await getDueCampaigns();
  if (dueCampaigns.length === 0) {
    console.log('[cron] No campaigns due. Exiting.');
    return result;
  }
  console.log(`[cron] Found ${dueCampaigns.length} due campaign(s).`);

  // ── Step 4: Process each campaign within shared time + quota budget ─────────
  let quotaRemaining = remainingToday;

  for (const campaign of dueCampaigns) {
    // Hard time check before starting each campaign
    if (Date.now() - startTime >= TIME_BUDGET_MS) {
      console.warn('[cron] Time budget reached before processing all campaigns.');
      result.timedOut = true;
      break;
    }

    if (quotaRemaining <= 0) {
      result.dailyCapReached = true;
      break;
    }

    console.log(`[cron] Processing campaign: "${campaign.title}" (${campaign._id})`);

    // Mark as processing if still scheduled
    if (campaign.status === 'scheduled') {
      await Campaign.findByIdAndUpdate(campaign._id, { status: 'processing' });
    }

    const campaignResult = await processCampaignWithBudget(
      String(campaign._id),
      quotaRemaining,
      startTime
    );

    result.sent    += campaignResult.sent;
    result.failed  += campaignResult.failed;
    result.skipped += campaignResult.skipped;
    quotaRemaining -= campaignResult.sent;
    result.campaignsProcessed++;

    if (campaignResult.timedOut) {
      result.timedOut = true;
      break;
    }
  }

  if (result.timedOut) {
    console.warn(`[cron] Exited early due to time budget. Sent ${result.sent} email(s) this run.`);
  } else {
    console.log(`[cron] Run complete. Sent: ${result.sent}, Failed: ${result.failed}.`);
  }

  return result;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Time-budgeted batch loop for a single campaign.
 * Keeps sending batches of CONCURRENT_BATCH_SIZE until:
 *   (a) no pending logs remain,
 *   (b) the quota for this run is exhausted,
 *   (c) the global time budget is exceeded.
 */
async function processCampaignWithBudget(
  campaignId: string,
  maxToSend: number,
  cronStartTime: number
): Promise<{ sent: number; failed: number; skipped: number; timedOut: boolean }> {
  const campaign = (await Campaign.findById(campaignId)) as ICampaign | null;
  if (!campaign) return { sent: 0, failed: 0, skipped: 0, timedOut: false };

  let sent = 0;
  let failed = 0;
  let timedOut = false;

  // ── Time-budgeted batch loop ─────────────────────────────────────────────
  while (true) {
    // Guard: time budget
    if (Date.now() - cronStartTime >= TIME_BUDGET_MS) {
      console.warn(`[campaign] Time budget hit mid-campaign "${campaign.title}". Will resume tomorrow.`);
      timedOut = true;
      break;
    }

    // Guard: quota exhausted for this run
    const batchSize = Math.min(CONCURRENT_BATCH_SIZE, maxToSend - sent);
    if (batchSize <= 0) break;

    // Fetch next batch of pending logs
    const pendingLogs = await EmailLog.find({
      campaignId: campaign._id,
      status: 'pending',
    }).limit(batchSize);

    if (pendingLogs.length === 0) break; // Nothing left to process

    // ── Atomic claim: pending → processing ──────────────────────────────────
    const claimedLogs = (
      await Promise.all(
        pendingLogs.map((log) =>
          EmailLog.findOneAndUpdate(
            { _id: log._id, status: 'pending' },
            { $set: { status: 'processing' }, $inc: { attempts: 1 } },
            { new: true }
          )
        )
      )
    ).filter(Boolean); // null means another concurrent process already claimed it

    if (claimedLogs.length === 0) {
      // All were already claimed concurrently — nothing to do this iteration
      break;
    }

    // ── Concurrent send ──────────────────────────────────────────────────────
    const sendResults = await Promise.allSettled(
      claimedLogs.map((log) => sendOneEmail(campaign, log!))
    );

    // ── Persist results ──────────────────────────────────────────────────────
    for (const outcome of sendResults) {
      if (outcome.status === 'fulfilled') {
        if (outcome.value.success) {
          sent++;
        } else {
          failed++;
        }
      } else {
        // Promise itself rejected (unexpected; sendOneEmail catches internally)
        failed++;
        console.error('[campaign] Unexpected send rejection:', outcome.reason);
      }
    }

    console.log(`[campaign] Batch done — cumulative sent: ${sent}, failed: ${failed}`);
  }

  // ── Update campaign counters and status ──────────────────────────────────
  const newSentCount = campaign.sentCount + sent;
  const newFailedCount = campaign.failedCount + failed;

  const remainingCount = await EmailLog.countDocuments({
    campaignId: campaign._id,
    status: { $in: ['pending', 'processing'] },
  });

  const allDone = remainingCount === 0;

  await Campaign.findByIdAndUpdate(campaign._id, {
    sentCount: newSentCount,
    failedCount: newFailedCount,
    status: allDone ? 'completed' : 'processing',
  });

  if (allDone) {
    console.log(`[campaign] Campaign "${campaign.title}" completed.`);
  }

  return { sent, failed, skipped: 0, timedOut };
}

/**
 * Send a single email and update the EmailLog record.
 * Always resolves (never rejects) — errors are caught and stored on the log.
 */
async function sendOneEmail(
  campaign: ICampaign,
  log: InstanceType<typeof EmailLog>
): Promise<{ success: boolean }> {
  try {
    const lead = await Lead.findById(log.leadId);
    if (!lead || lead.status === 'unsubscribed') {
      await EmailLog.findByIdAndUpdate(log._id, {
        status: 'failed',
        errorReason: 'Lead unsubscribed or not found',
      });
      return { success: false };
    }

    const vars = {
      name: lead.name,
      email: lead.email,
      ...Object.fromEntries(lead.variables as unknown as Map<string, string>),
    };

    const personalizedSubject = interpolateTemplate(campaign!.subject, vars);
    const personalizedBody    = interpolateTemplate(campaign!.body, vars);

    const result = await sendEmail({
      to: lead.email,
      subject: personalizedSubject,
      html: personalizedBody,
    });

    if (result.success) {
      await EmailLog.findByIdAndUpdate(log._id, {
        status: 'sent',
        sentAt: new Date(),
        errorReason: undefined,
      });
      return { success: true };
    } else {
      await EmailLog.findByIdAndUpdate(log._id, {
        status: 'failed',
        errorReason: result.error ?? 'Provider rejected the send',
      });
      return { success: false };
    }
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Unknown error during send';
    console.error(`[campaign] sendOneEmail error for log ${log._id}:`, reason);
    await EmailLog.findByIdAndUpdate(log._id, {
      status: 'failed',
      errorReason: reason,
    });
    return { success: false };
  }
}

/**
 * Revert stale `processing` logs to `pending`.
 * Called at the start of every cron run to clean up after any previous crash.
 *
 * A log is "stale" if it has been `processing` for longer than STALE_THRESHOLD_MS.
 * This is safe because Vercel Hobby functions never run longer than 15 seconds —
 * so any log still `processing` after 1 hour is definitely orphaned.
 */
async function recoverStaleLogs(): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
  const result = await EmailLog.updateMany(
    {
      status: 'processing',
      updatedAt: { $lt: staleThreshold },
    },
    {
      $set: { status: 'pending', errorReason: 'Recovered from stale processing state' },
    }
  );
  return result.modifiedCount;
}

/**
 * Count how many emails have been successfully sent today (UTC midnight boundary).
 */
async function getDailyEmailsSent(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  return EmailLog.countDocuments({
    status: 'sent',
    sentAt: { $gte: startOfDay },
  });
}

/**
 * Find all campaigns eligible for processing:
 *   - status is `scheduled` or `processing` (partially done from a previous run)
 *   - scheduledAt is in the past or now
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
 * Resets them to `pending` so the next cron run picks them up.
 */
export async function retryFailedEmails(campaignId: string): Promise<number> {
  await connectToDatabase();

  const result = await EmailLog.updateMany(
    { campaignId, status: 'failed' },
    { $set: { status: 'pending', errorReason: undefined } }
  );

  await Campaign.findByIdAndUpdate(campaignId, { status: 'processing' });

  return result.modifiedCount;
}

/**
 * Legacy shim — kept for any existing callers in tests or API routes.
 * Delegates to the new time-budgeted implementation.
 */
export async function processCampaign(campaignId: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  await connectToDatabase();

  const todaySent = await getDailyEmailsSent();
  const quotaRemaining = Math.max(0, DAILY_EMAIL_CAP - todaySent);

  const r = await processCampaignWithBudget(campaignId, quotaRemaining, Date.now());
  return { sent: r.sent, failed: r.failed, skipped: r.skipped };
}
