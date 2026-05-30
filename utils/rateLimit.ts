/**
 * Rate limit utility — tracks daily email send counts in MongoDB.
 * Uses the EmailLog collection as the source of truth.
 */

import { connectToDatabase } from '@/lib/db';
import { EmailLog } from '@/models/EmailLog';

/**
 * Count how many emails have been sent today (UTC day boundary).
 */
export async function getDailyEmailsSent(): Promise<number> {
  await connectToDatabase();

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const count = await EmailLog.countDocuments({
    status: 'sent',
    sentAt: { $gte: startOfDay },
  });

  return count;
}

/**
 * Simple in-memory rate limiter for API routes.
 * Prevents abuse of the cron trigger endpoint.
 */
const apiRequestMap = new Map<string, { count: number; resetAt: number }>();

export function checkApiRateLimit(
  key: string,
  maxRequests = 10,
  windowMs = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = apiRequestMap.get(key);

  if (!entry || now > entry.resetAt) {
    apiRequestMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}
