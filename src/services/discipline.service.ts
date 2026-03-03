import { createClient } from '@/lib/supabase/client';
import type { DisciplineLog, EmployeeDisciplineSummary } from '@/lib/types';
import { VIOLATION_THRESHOLD } from '@/lib/constants';

const supabase = createClient();

export const disciplineService = {
  /**
   * Get discipline log for a specific user
   */
  async getUserDisciplineLog(userId: string, limit = 30): Promise<DisciplineLog[]> {
    const { data, error } = await supabase
      .from('discipline_log')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as DisciplineLog[];
  },

  /**
   * Get latest discipline status for a user
   */
  async getLatestStatus(userId: string): Promise<DisciplineLog | null> {
    const { data, error } = await supabase
      .from('discipline_log')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return (data as DisciplineLog) || null;
  },

  /**
   * Get discipline summary for all employees (owner only)
   */
  async getAllDisciplineSummary(): Promise<EmployeeDisciplineSummary[]> {
    // Get all employees
    const { data: employees, error: empError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'employee');

    if (empError) throw empError;

    const summaries: EmployeeDisciplineSummary[] = [];

    for (const emp of employees || []) {
      // Get latest discipline log entry
      const { data: latestLog } = await supabase
        .from('discipline_log')
        .select('*')
        .eq('user_id', emp.id)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      // Count total missed
      const { count: missedCount } = await supabase
        .from('discipline_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', emp.id)
        .eq('status', 'missed');

      // Get last submission date
      const { data: lastSubmission } = await supabase
        .from('cleaning_reports')
        .select('submission_date')
        .eq('user_id', emp.id)
        .eq('status', 'valid')
        .order('submission_date', { ascending: false })
        .limit(1)
        .single();

      const consecutiveMissed = latestLog?.consecutive_missed || 0;

      summaries.push({
        user_id: emp.id,
        user_name: emp.name,
        latest_consecutive_missed: consecutiveMissed,
        is_violation: consecutiveMissed >= VIOLATION_THRESHOLD,
        last_submission_date: lastSubmission?.submission_date || null,
        total_missed: missedCount || 0,
      });
    }

    return summaries;
  },

  /**
   * Get all discipline logs with user info (owner only)
   */
  async getAllDisciplineLogs(limit = 100): Promise<DisciplineLog[]> {
    const { data, error } = await supabase
      .from('discipline_log')
      .select('*, user:users(id, name)')
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as DisciplineLog[];
  },
};
