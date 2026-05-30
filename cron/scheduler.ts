/**
 * Cron Scheduler — runs on server startup in development.
 * In production (Render), trigger via a scheduled GET to /api/cron/send.
 *
 * This file MUST be imported in a Server Component or server-side module
 * that runs at startup (e.g., a Route Handler).
 *
 * Note: node-cron runs in Node.js process only — not in Edge Runtime.
 */

import cron from 'node-cron';
import { getDueCampaigns, processCampaign } from '@/services/campaign.service';

let isScheduled = false;

/**
 * Initialize the cron scheduler.
 * Safe to call multiple times — will only register once.
 */
export function initCronScheduler(): void {
  if (isScheduled) return;
  isScheduled = true;

  // Run every minute — check for due campaigns
  cron.schedule('* * * * *', async () => {
    console.log('[cron] Checking for due campaigns at', new Date().toISOString());

    try {
      const dueCampaigns = await getDueCampaigns();

      if (dueCampaigns.length === 0) {
        console.log('[cron] No campaigns due. Next check in 1 minute.');
        return;
      }

      for (const campaign of dueCampaigns) {
        console.log(`[cron] Processing campaign: ${campaign.title} (${campaign._id})`);
        const result = await processCampaign(String(campaign._id));
        console.log(
          `[cron] Campaign ${campaign.title} — sent: ${result.sent}, failed: ${result.failed}, skipped: ${result.skipped}`
        );
      }
    } catch (err) {
      console.error('[cron] Scheduler error:', err);
    }
  });

  console.log('[cron] Scheduler initialized — polling every minute.');
}
