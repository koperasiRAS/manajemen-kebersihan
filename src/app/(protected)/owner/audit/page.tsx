'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { AuditLogEntry, User } from '@/lib/types';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: 'Masuk', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  logout: { label: 'Keluar', color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  user_create: { label: 'Buat Pengguna', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  user_deactivate: { label: 'Nonaktifkan Pengguna', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  user_activate: { label: 'Aktifkan Pengguna', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  report_reject: { label: 'Tolak Laporan', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  report_submit: { label: 'Kirim Laporan', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  report_rate: { label: 'Rating Laporan', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  report_delete: { label: 'Hapus Laporan', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  data_cleanup: { label: 'Pembersihan Data', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
};

export default function AuditLogPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('audit_log').select('*, user:users(id, name)').order('created_at', { ascending: false }).limit(200);
      if (filterAction) query = query.eq('action', filterAction);
      const { data } = await query;
      setLogs((data || []) as AuditLogEntry[]);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [supabase, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Log Aktivitas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Lacak semua tindakan dan perubahan penting</p>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="max-w-xs">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Filter Aksi</label>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Semua aksi</option>
            {Object.entries(ACTION_LABELS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada log aktivitas ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Waktu</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pengguna</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map((log) => {
                  const userName = (log.user as unknown as User)?.name || '—';
                  const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 dark:bg-gray-800 text-gray-600' };
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{userName}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${actionInfo.color}`}>{actionInfo.label}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 max-w-[300px] truncate">
                        {log.details ? JSON.stringify(log.details) : '—'}
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
