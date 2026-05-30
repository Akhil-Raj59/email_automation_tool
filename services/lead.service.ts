/**
 * Lead Service — CSV/Excel parsing and persistence layer.
 * Parses uploaded files, validates rows, and bulk-inserts into MongoDB.
 * Required CSV columns: email, name (all others become template variables)
 */

import { connectToDatabase } from '@/lib/db';
import { Lead, ILead } from '@/models/Lead';
import { EmailLog } from '@/models/EmailLog';
import Campaign from '@/models/Campaign';
import mongoose from 'mongoose';

export interface ParsedLead {
  email: string;
  name: string;
  variables: Record<string, string>;
}

export interface ImportResult {
  inserted: number;
  skipped: number;   // duplicates
  errors: string[];
}

/**
 * Parse a CSV string into an array of leads.
 * Expects first row as header. Required: email, name columns.
 */
export function parseCSV(csvText: string): ParsedLead[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Handle Windows-style CRLF
  const headers = lines[0].replace(/\r/g, '').split(',').map((h) => h.trim().toLowerCase());

  const emailIdx = headers.indexOf('email');
  const nameIdx = headers.indexOf('name');

  if (emailIdx === -1 || nameIdx === -1) {
    throw new Error('CSV must contain "email" and "name" columns.');
  }

  const leads: ParsedLead[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].replace(/\r/g, '').split(',').map((c) => c.trim());
    if (!cols[emailIdx]) continue; // Skip empty rows

    const variables: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (idx !== emailIdx && idx !== nameIdx) {
        variables[header] = cols[idx] || '';
      }
    });

    leads.push({
      email: cols[emailIdx].toLowerCase(),
      name: cols[nameIdx] || 'Friend',
      variables,
    });
  }

  return leads;
}

/**
 * Import leads into MongoDB for a given campaign.
 * Uses ordered:false bulkWrite for max throughput & skip duplicates.
 */
export async function importLeads(
  campaignId: string,
  parsedLeads: ParsedLead[]
): Promise<ImportResult> {
  await connectToDatabase();

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };
  const campaignObjId = new mongoose.Types.ObjectId(campaignId);

  for (const parsed of parsedLeads) {
    try {
      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email)) {
        result.errors.push(`Invalid email: ${parsed.email}`);
        continue;
      }

      // Upsert lead — skip if (email, campaignId) already exists
      const lead = await Lead.findOneAndUpdate(
        { email: parsed.email, campaignId: campaignObjId },
        {
          $setOnInsert: {
            email: parsed.email,
            name: parsed.name,
            variables: parsed.variables,
            campaignId: campaignObjId,
            status: 'active',
          },
        },
        { upsert: true, new: false } // new:false → null means we created it
      );

      if (lead) {
        // Document already existed
        result.skipped++;
        continue;
      }

      // Fetch the freshly created lead
      const newLead = await Lead.findOne({ email: parsed.email, campaignId: campaignObjId });
      if (!newLead) continue;

      // Create corresponding EmailLog (pending delivery)
      await EmailLog.findOneAndUpdate(
        { campaignId: campaignObjId, leadId: newLead._id },
        {
          $setOnInsert: {
            campaignId: campaignObjId,
            leadId: newLead._id,
            recipientEmail: parsed.email,
            status: 'pending',
            attempts: 0,
          },
        },
        { upsert: true }
      );

      result.inserted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Duplicate key errors are expected — treat as skipped
      if (msg.includes('E11000')) {
        result.skipped++;
      } else {
        result.errors.push(`Error for ${parsed.email}: ${msg}`);
      }
    }
  }

  // Update campaign totalCount
  await Campaign.findByIdAndUpdate(campaignId, {
    $inc: { totalCount: result.inserted },
  });

  return result;
}

/**
 * Get paginated leads for a campaign.
 */
export async function getLeadsByCampaign(
  campaignId: string,
  page = 1,
  limit = 50
): Promise<{ leads: ILead[]; total: number }> {
  await connectToDatabase();

  const filter = { campaignId: new mongoose.Types.ObjectId(campaignId) };
  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Lead.countDocuments(filter),
  ]);

  return { leads, total };
}
