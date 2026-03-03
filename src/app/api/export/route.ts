import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { objectsToCSV } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

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

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    let query = supabase
      .from('cleaning_reports')
      .select('*, user:users(id, name)')
      .order('submitted_at', { ascending: false });

    if (dateParam) {
      query = query.eq('submission_date', dateParam);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format for CSV
    interface ReportRow {
      user?: { name?: string };
      submission_date: string;
      submitted_at: string;
      status: string;
      notes: string | null;
      rejection_note: string | null;
    }

    const csvData = (data || []).map((r: ReportRow) => ({
      Employee: r.user?.name || '—',
      Date: r.submission_date,
      Submitted_At: r.submitted_at,
      Status: r.status,
      Notes: r.notes || '',
      Rejection_Note: r.rejection_note || '',
    }));

    const csv = objectsToCSV(csvData);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cleaning-reports-${dateParam || 'all'}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
