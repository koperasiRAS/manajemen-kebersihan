'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getTodayDate, getCurrentWeekRange, cn, formatDateTime } from '@/lib/utils';
import { VIOLATION_THRESHOLD } from '@/lib/constants';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { User, EmployeeDisciplineSummary } from '@/lib/types';

export default function OwnerDashboardPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<User[]>([]);
  const [notSubmitted, setNotSubmitted] = useState<User[]>([]);
  const [disciplineSummaries, setDisciplineSummaries] = useState<EmployeeDisciplineSummary[]>([]);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const today = getTodayDate();
      const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      // Get all employees
      const { data: emps } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'employee')
        .order('name');

      const employeeList = (emps || []) as User[];
      setEmployees(employeeList);

      // Get who submitted today
      const { data: todayReports } = await supabase
        .from('cleaning_reports')
        .select('user_id')
        .eq('submission_date', today)
        .neq('status', 'draft');

      const submittedIds = new Set((todayReports || []).map((r) => r.user_id));
      setNotSubmitted(employeeList.filter((e) => !submittedIds.has(e.id)));

      // Weekly report count
      const { count: wc } = await supabase
        .from('cleaning_reports')
        .select('*', { count: 'exact', head: true })
        .gte('submission_date', weekStart)
        .lte('submission_date', weekEnd)
        .neq('status', 'draft');
      setWeeklyCount(wc || 0);

      // Monthly report count
      const { count: mc } = await supabase
        .from('cleaning_reports')
        .select('*', { count: 'exact', head: true })
        .gte('submission_date', monthStart)
        .neq('status', 'draft');
      setMonthlyCount(mc || 0);

      // Average rating
      const { data: ratingData } = await supabase
        .from('cleaning_reports')
        .select('rating')
        .not('rating', 'is', null)
        .gte('submission_date', monthStart);
      if (ratingData && ratingData.length > 0) {
        const sum = ratingData.reduce((acc, r) => acc + (r.rating || 0), 0);
        setAvgRating(Math.round((sum / ratingData.length) * 10) / 10);
      }

      // Build discipline summaries
      const summaries: EmployeeDisciplineSummary[] = [];
      for (const emp of employeeList) {
        const { data: latestLog } = await supabase
          .from('discipline_log')
          .select('*')
          .eq('user_id', emp.id)
          .order('date', { ascending: false })
          .limit(1)
          .single();

        const { count: missedCount } = await supabase
          .from('discipline_log')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', emp.id)
          .eq('status', 'missed');

        const { data: lastSub } = await supabase
          .from('cleaning_reports')
          .select('submitted_at')
          .eq('user_id', emp.id)
          .eq('status', 'valid')
          .order('submitted_at', { ascending: false })
          .limit(1)
          .single();

        const consecutiveMissed = latestLog?.consecutive_missed || 0;

        summaries.push({
          user_id: emp.id,
          user_name: emp.name,
          latest_consecutive_missed: consecutiveMissed,
          is_violation: consecutiveMissed >= VIOLATION_THRESHOLD,
          last_submission_date: lastSub?.submitted_at || null,
          total_missed: missedCount || 0,
        });
      }

      setDisciplineSummaries(summaries);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const violationCount = disciplineSummaries.filter((s) => s.is_violation).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Pemilik</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ringkasan kepatuhan kebersihan karyawan
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard label="Total Karyawan" value={employees.length} color="blue" />
        <SummaryCard label="Terkirim Hari Ini" value={employees.length - notSubmitted.length} color="green" />
        <SummaryCard label="Belum Mengirim" value={notSubmitted.length} color={notSubmitted.length > 0 ? 'amber' : 'green'} />
        <SummaryCard label="Pelanggaran" value={violationCount} color={violationCount > 0 ? 'red' : 'green'} />
        <SummaryCard label="Laporan Minggu Ini" value={weeklyCount} color="blue" />
        <SummaryCard label="Bulan Ini" value={monthlyCount} suffix={avgRating > 0 ? ` · ★${avgRating}` : ''} color="blue" />
      </div>

      {/* Not submitted today */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Belum Mengirim Hari Ini
          </h2>
        </div>
        {notSubmitted.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              ✓ Semua karyawan telah mengirim laporan hari ini
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {notSubmitted.map((emp) => (
              <div key={emp.id} className="flex items-center gap-4 px-6 py-3">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    {emp.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{emp.name}</p>
                </div>
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                  Tertunda
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discipline overview */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Status Disiplin Karyawan
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Karyawan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Absen Berturut-turut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Absen</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pengiriman Terakhir</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {disciplineSummaries.map((s) => (
                <tr key={s.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{s.user_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{s.latest_consecutive_missed}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{s.total_missed}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{s.last_submission_date ? formatDateTime(s.last_submission_date) : '—'}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full',
                      s.is_violation
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : s.latest_consecutive_missed > 0
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    )}>
                      {s.is_violation ? '⚠ Pelanggaran' : s.latest_consecutive_missed > 0 ? 'Peringatan' : 'Baik'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex items-center gap-3">
        <span className={cn('text-2xl font-bold', colorClasses[color]?.split(' ').filter(c => c.startsWith('text-')).join(' ') || 'text-gray-900 dark:text-white')}>
          {value}{suffix && <span className="text-sm font-normal ml-1">{suffix}</span>}
        </span>
      </div>
    </div>
  );
}
