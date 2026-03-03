import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Verify auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if owner
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the report first to find the photo path
    const { data: report, error: fetchErr } = await supabase
      .from('cleaning_reports')
      .select('id, photo_url, user_id')
      .eq('id', id)
      .single();

    if (fetchErr || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // 1. Delete photo from Supabase Storage
    if (report.photo_url) {
      const { error: storageErr } = await supabase.storage
        .from('cleaning-photos')
        .remove([report.photo_url]);

      if (storageErr) {
        console.warn('Failed to delete photo from storage:', storageErr.message);
        // Continue anyway — don't block report deletion for storage failure
      }
    }

    // 2. Delete the report record from database
    const { error: deleteErr } = await supabase
      .from('cleaning_reports')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 3. Audit log
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'report_delete',
      target_type: 'report',
      target_id: id,
      details: { photo_url: report.photo_url, employee_id: report.user_id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
