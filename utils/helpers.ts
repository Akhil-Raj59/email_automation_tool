/**
 * Format utilities for dates and string manipulation.
 */
import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'MMM d, yyyy HH:mm');
}

export function timeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/**
 * Truncate long strings for display in tables.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '…';
}

/**
 * Validate a campaign's required fields before insert.
 */
export function validateCampaignPayload(data: unknown): string[] {
  const errors: string[] = [];
  const d = data as Record<string, unknown>;

  if (!d.title || typeof d.title !== 'string' || !d.title.trim()) {
    errors.push('Campaign title is required.');
  }
  if (!d.subject || typeof d.subject !== 'string' || !d.subject.trim()) {
    errors.push('Email subject is required.');
  }
  if (!d.body || typeof d.body !== 'string' || !d.body.trim()) {
    errors.push('Email body/template is required.');
  }
  if (!d.scheduledAt) {
    errors.push('Schedule date is required.');
  } else {
    const date = new Date(d.scheduledAt as string);
    if (isNaN(date.getTime())) errors.push('Invalid schedule date.');
  }

  return errors;
}
