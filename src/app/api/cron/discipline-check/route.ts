import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// This endpoint is called by Vercel Cron every day at 00:05 WIB (17:05 UTC)
// It checks yesterday's discipline for all active employees
export async function GET(request: Request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Check yesterday's date (WIB = UTC+7)
    const now = new Date();
    // Adjust to WIB
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibNow = new Date(now.getTime() + wibOffset);
    const yesterday = new Date(wibNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const checkDate = yesterday.toISOString().split('T')[0];

    console.log(`[Discipline Check] Running for date: ${checkDate}`);

    // Get all active employees
    const { data: employees } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .eq('role', 'employee')
      .eq('is_active', true);

    if (!employees || employees.length === 0) {
      return NextResponse.json({ success: true, date: checkDate, message: 'No active employees', processed: 0 });
    }

    let violationCount = 0;

    for (const emp of employees) {
      // Check if employee submitted any report yesterday
      const { count } = await supabaseAdmin
        .from('cleaning_reports')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', emp.id)
        .gte('created_at', `${checkDate}T00:00:00`)
        .lt('created_at', `${checkDate}T23:59:59`);

      const submitted = (count || 0) > 0;

      // Get last discipline log for this employee to calculate consecutive missed
      const { data: lastLog } = await supabaseAdmin
        .from('discipline_log')
        .select('consecutive_missed')
        .eq('user_id', emp.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousConsecutive = lastLog?.consecutive_missed || 0;
      const newConsecutive = submitted ? 0 : previousConsecutive + 1;

      // Check if log already exists for this date
      const { data: existingLog } = await supabaseAdmin
        .from('discipline_log')
        .select('id')
        .eq('user_id', emp.id)
        .eq('date', checkDate)
        .maybeSingle();

      if (existingLog) {
        // Update existing
        await supabaseAdmin
          .from('discipline_log')
          .update({
            status: submitted ? 'submitted' : 'missed',
            consecutive_missed: newConsecutive,
          })
          .eq('id', existingLog.id);
      } else {
        // Insert new
        await supabaseAdmin
          .from('discipline_log')
          .insert({
            user_id: emp.id,
            date: checkDate,
            status: submitted ? 'submitted' : 'missed',
            consecutive_missed: newConsecutive,
          });
      }

      if (newConsecutive >= 3) {
        violationCount++;
        console.log(`[Violation] ${emp.name}: ${newConsecutive} hari berturut-turut tidak kirim laporan`);
      }
    }

    console.log(`[Discipline Check] Done. Processed ${employees.length} employees, ${violationCount} violations.`);

    return NextResponse.json({
      success: true,
      date: checkDate,
      processed: employees.length,
      violations: violationCount,
    });
  } catch (error) {
    console.error('[Discipline Check] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
