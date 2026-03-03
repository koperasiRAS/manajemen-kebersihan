import { createClient } from '@/lib/supabase/client';
import type { CleaningReport, DailySubmissionCount, ReportFilters } from '@/lib/types';
import { MAX_DAILY_REPORTS } from '@/lib/constants';
import { getTodayDate } from '@/lib/utils';

const supabase = createClient();

export const reportService = {
  /**
   * Get today's submission count for current user
   */
  async getTodayCount(userId: string): Promise<DailySubmissionCount> {
    const today = getTodayDate();

    const { count, error } = await supabase
      .from('cleaning_reports')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('submission_date', today);

    if (error) throw error;

    const currentCount = count || 0;
    return {
      count: currentCount,
      max: MAX_DAILY_REPORTS,
      remaining: Math.max(0, MAX_DAILY_REPORTS - currentCount),
    };
  },

  /**
   * Submit a new cleaning report
   */
  async submitReport(userId: string, photoUrl: string, notes?: string): Promise<CleaningReport> {
    const { data, error } = await supabase
      .from('cleaning_reports')
      .insert({
        user_id: userId,
        photo_url: photoUrl,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('Maximum daily cleaning reports')) {
        throw new Error('Maximum daily cleaning reports reached (3).');
      }
      throw error;
    }

    return data as CleaningReport;
  },

  /**
   * Get user's report history
   */
  async getUserReports(userId: string, limit = 50): Promise<CleaningReport[]> {
    const { data, error } = await supabase
      .from('cleaning_reports')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as CleaningReport[];
  },

  /**
   * Get all reports (owner only) with optional filters
   */
  async getAllReports(filters?: ReportFilters): Promise<CleaningReport[]> {
    let query = supabase
      .from('cleaning_reports')
      .select('*, user:users(id, name)')
      .order('submitted_at', { ascending: false });

    if (filters?.date) {
      query = query.eq('submission_date', filters.date);
    }
    if (filters?.employeeId) {
      query = query.eq('user_id', filters.employeeId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.limit(200);
    if (error) throw error;
    return (data || []) as CleaningReport[];
  },

  /**
   * Reject a report (owner only)
   */
  async rejectReport(reportId: string, rejectionNote?: string): Promise<void> {
    const { error } = await supabase
      .from('cleaning_reports')
      .update({
        status: 'rejected' as const,
        rejection_note: rejectionNote || null,
      })
      .eq('id', reportId);

    if (error) throw error;
  },

  /**
   * Get employees who have not submitted today (owner only)
   */
  async getNotSubmittedToday(): Promise<{ id: string; name: string }[]> {
    const today = getTodayDate();

    // Get all employees
    const { data: employees, error: empError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'employee');

    if (empError) throw empError;

    // Get users who submitted today
    const { data: submitted, error: subError } = await supabase
      .from('cleaning_reports')
      .select('user_id')
      .eq('submission_date', today);

    if (subError) throw subError;

    const submittedIds = new Set((submitted || []).map((r) => r.user_id));

    return (employees || []).filter((e) => !submittedIds.has(e.id));
  },
};
