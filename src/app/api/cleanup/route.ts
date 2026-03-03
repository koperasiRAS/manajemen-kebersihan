import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Cleanup API: deletes photos from Storage that are older than retention period.
 * Should be called by a cron job (e.g., weekly).
 * Requires: Authorization header with service role key or owner session.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify auth - must be owner
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const retentionMonths = body.retention_months || 6;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Get old reports with photo paths
    const { data: oldReports, error: fetchErr } = await supabase
      .from('cleaning_reports')
      .select('id, photo_url')
      .lt('submission_date', cutoffDateStr);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!oldReports || oldReports.length === 0) {
      return NextResponse.json({ message: 'No old reports found', deleted: 0 });
    }

    // Collect photo paths to delete from storage
    const photoPaths = oldReports
      .map((r) => r.photo_url)
      .filter((url): url is string => !!url);

    // Delete photos from storage in batches of 100
    let photosDeleted = 0;
    for (let i = 0; i < photoPaths.length; i += 100) {
      const batch = photoPaths.slice(i, i + 100);
      const { error: storageErr } = await supabase.storage
        .from('cleaning-photos')
        .remove(batch);

      if (!storageErr) {
        photosDeleted += batch.length;
      } else {
        console.warn(`Failed to delete storage batch ${i}:`, storageErr.message);
      }
    }

    // Delete old report records
    const reportIds = oldReports.map((r) => r.id);
    const { error: deleteErr } = await supabase
      .from('cleaning_reports')
      .delete()
      .in('id', reportIds);

    if (deleteErr) {
      console.warn('Failed to delete old reports:', deleteErr.message);
    }

    // Delete old audit logs (>12 months)
    const auditCutoff = new Date();
    auditCutoff.setMonth(auditCutoff.getMonth() - 12);
    await supabase
      .from('audit_log')
      .delete()
      .lt('created_at', auditCutoff.toISOString());

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'data_cleanup',
      details: {
        reports_deleted: oldReports.length,
        photos_deleted: photosDeleted,
        cutoff_date: cutoffDateStr,
      },
    });

    return NextResponse.json({
      success: true,
      reports_deleted: oldReports.length,
      photos_deleted: photosDeleted,
      cutoff_date: cutoffDateStr,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
