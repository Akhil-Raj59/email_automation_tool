/**
 * POST /api/leads/upload — Upload CSV for a campaign.
 * Accepts multipart/form-data with:
 *   - file: CSV file
 *   - campaignId: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, importLeads } from '@/services/lead.service';
import { checkApiRateLimit } from '@/utils/rateLimit';

export async function POST(req: NextRequest) {
  // Basic rate limit: max 5 uploads per minute per IP
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rateCheck = checkApiRateLimit(`upload:${ip}`, 5, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait before uploading again.' }, { status: 429 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const campaignId = formData.get('campaignId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    if (!campaignId) return NextResponse.json({ error: 'campaignId is required.' }, { status: 400 });

    // Validate file type
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are supported.' }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 5MB.' }, { status: 400 });
    }

    const csvText = await file.text();
    let parsedLeads;

    try {
      parsedLeads = parseCSV(csvText);
    } catch (parseErr: unknown) {
      const msg = parseErr instanceof Error ? parseErr.message : 'CSV parse error';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (parsedLeads.length === 0) {
      return NextResponse.json({ error: 'CSV contains no valid leads.' }, { status: 400 });
    }

    const result = await importLeads(campaignId, parsedLeads);

    return NextResponse.json({
      success: true,
      message: `Imported ${result.inserted} leads. Skipped ${result.skipped} duplicates.`,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
