import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Get today's date in WIB timezone as YYYY-MM-DD
function getTodayWIB(): string {
  const now = new Date();
  const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const y = wib.getFullYear();
  const m = String(wib.getMonth() + 1).padStart(2, '0');
  const d = String(wib.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * POST /api/reports/complete
 * Completes a draft report by adding the after photo and changing status to 'valid'.
 * Uses service role key to bypass RLS.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { report_id, photo_url, user_id } = body;

    if (!report_id || !photo_url || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Verify the draft exists and belongs to the user
    const { data: draft, error: fetchErr } = await supabaseAdmin
      .from('cleaning_reports')
      .select('*')
      .eq('id', report_id)
      .eq('user_id', user_id)
      .eq('status', 'draft')
      .single();

    if (fetchErr || !draft) {
      return NextResponse.json({ error: 'Draft laporan tidak ditemukan' }, { status: 404 });
    }

    // Update draft → valid with correct WIB date
    const todayWIB = getTodayWIB();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('cleaning_reports')
      .update({
        photo_url: photo_url,
        status: 'valid',
        submitted_at: new Date().toISOString(),
        submission_date: todayWIB,
      })
      .eq('id', report_id)
      .select()
      .single();

    if (updateErr) {
      console.error('[Complete Report] Update error:', updateErr);
      return NextResponse.json({ error: 'Gagal menyelesaikan laporan' }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from('audit_log').insert({
      user_id: user_id,
      action: 'report_submit',
      target_type: 'report',
      target_id: report_id,
      details: { location_id: draft.location_id, has_before: !!draft.photo_before_url },
    });

    return NextResponse.json({ success: true, report: updated });
  } catch (error) {
    console.error('[Complete Report] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
