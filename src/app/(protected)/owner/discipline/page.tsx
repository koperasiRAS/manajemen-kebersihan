'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate, cn } from '@/lib/utils';
import { VIOLATION_THRESHOLD } from '@/lib/constants';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { DisciplineLog, User } from '@/lib/types';

export default function OwnerDisciplinePage() {
  const supabase = useMemo(() => createClient(), []);
  const [logs, setLogs] = useState<DisciplineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [employees, setEmployees] = useState<User[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const { data: emps } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'employee')
        .order('name');
      setEmployees((emps || []) as User[]);

      let query = supabase
        .from('discipline_log')
        .select('*, user:users(id, name)')
        .order('date', { ascending: false })
        .limit(200);

      if (filterEmployee) {
        query = query.eq('user_id', filterEmployee);
      }

      const { data } = await query;
      setLogs((data || []) as DisciplineLog[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [supabase, filterEmployee]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Log Disiplin</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pantau disiplin dan pelanggaran karyawan
        </p>
      </div>

      {/* Filter karyawan */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="max-w-xs">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Filter Karyawan</label>
          <select
            value={filterEmployee}
            onChange={(e) => { setFilterEmployee(e.target.value); setLoading(true); }}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Semua karyawan</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabel log */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada catatan disiplin ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Karyawan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Absen Berturut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pelanggaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map((log) => {
                  const userName = (log.user as unknown as User)?.name || '—';
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{userName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(log.date)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded-full',
                          log.status === 'submitted'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        )}>
                          {log.status === 'submitted' ? 'Terkirim' : 'Tidak Kirim'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {log.consecutive_missed}
                      </td>
                      <td className="px-6 py-4">
                        {log.consecutive_missed >= VIOLATION_THRESHOLD ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                            ⚠ Pelanggaran
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
