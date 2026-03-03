import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Monthly cleanup: runs on 1st of every month at 00:10 WIB (17:10 UTC)
// Deletes all photos and reports from the previous month
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Calculate last month's date range
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibNow = new Date(now.getTime() + wibOffset);
    const firstOfThisMonth = new Date(wibNow.getFullYear(), wibNow.getMonth(), 1);
    const cutoffDate = firstOfThisMonth.toISOString().split('T')[0];

    console.log(`[Monthly Cleanup] Deleting reports before: ${cutoffDate}`);

    // Get all reports before cutoff
    const { data: oldReports } = await supabaseAdmin
      .from('cleaning_reports')
      .select('id, photo_url, photo_before_url')
      .lt('submission_date', cutoffDate);

    if (!oldReports || oldReports.length === 0) {
      return NextResponse.json({ success: true, message: 'No old reports to clean up', deleted: 0 });
    }

    // Collect photo paths to delete
    const photoPaths: string[] = [];
    for (const r of oldReports) {
      if (r.photo_url) photoPaths.push(r.photo_url);
      if (r.photo_before_url) photoPaths.push(r.photo_before_url);
    }

    // Delete photos from storage in batches
    if (photoPaths.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < photoPaths.length; i += batchSize) {
        const batch = photoPaths.slice(i, i + batchSize);
        await supabaseAdmin.storage.from('cleaning-reports').remove(batch);
      }
    }

    // Delete reports from database
    const reportIds = oldReports.map(r => r.id);
    const batchSize = 100;
    for (let i = 0; i < reportIds.length; i += batchSize) {
      const batch = reportIds.slice(i, i + batchSize);
      await supabaseAdmin
        .from('cleaning_reports')
        .delete()
        .in('id', batch);
    }

    console.log(`[Monthly Cleanup] Deleted ${oldReports.length} reports, ${photoPaths.length} photos`);

    return NextResponse.json({
      success: true,
      reports_deleted: oldReports.length,
      photos_deleted: photoPaths.length,
    });
  } catch (error) {
    console.error('[Monthly Cleanup] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
