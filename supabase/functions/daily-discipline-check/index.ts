// ============================================================
// Supabase Edge Function: Daily Discipline Check
// Runs as cron job at 00:05 local time each day
//
// Setup in Supabase Dashboard:
// 1. Go to Edge Functions
// 2. Deploy this function
// 3. Setup a cron job in Database > Extensions > pg_cron:
//    SELECT cron.schedule(
//      'daily-discipline-check',
//      '5 0 * * *',
//      $$
//      SELECT net.http_post(
//        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-discipline-check',
//        headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
//        body := '{}'::jsonb
//      );
//      $$
//    );
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const checkDate = yesterday.toISOString().split('T')[0];

    console.log(`[Discipline Check] Running for date: ${checkDate}`);

    // Call the database function
    const { error } = await supabaseAdmin.rpc('run_daily_discipline_check', {
      check_date: checkDate,
    });

    if (error) {
      console.error('[Discipline Check] Database function error:', error);
      throw error;
    }

    // Check for violations (3+ consecutive missed)
    const { data: violations } = await supabaseAdmin
      .from('discipline_log')
      .select('*, user:users(id, name, phone_number)')
      .eq('date', checkDate)
      .eq('status', 'missed')
      .gte('consecutive_missed', 3);

    if (violations && violations.length > 0) {
      console.log(`[Discipline Check] ${violations.length} violation(s) found`);

      // Get owner for notifications
      const { data: owners } = await supabaseAdmin
        .from('users')
        .select('phone_number')
        .eq('role', 'owner')
        .limit(1);

      const ownerPhone = owners?.[0]?.phone_number || null;

      // Log violations (notification integration point)
      for (const v of violations) {
        const userName = (v.user as { name: string })?.name || 'Unknown';
        console.log(
          `[Violation] Employee: ${userName}, Consecutive Missed: ${v.consecutive_missed}`
        );

        // TODO: Integrate notification service here
        // await sendNotification({
        //   type: 'violation_alert',
        //   employeeName: userName,
        //   employeePhone: v.user?.phone_number,
        //   ownerPhone,
        //   consecutiveMissed: v.consecutive_missed,
        //   message: `Employee ${userName} has missed ${v.consecutive_missed} consecutive days.`,
        // });
      }
    } else {
      console.log('[Discipline Check] No violations found');
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: checkDate,
        violations: violations?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[Discipline Check] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
