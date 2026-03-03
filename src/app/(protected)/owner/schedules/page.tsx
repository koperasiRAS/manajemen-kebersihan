'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { DAY_NAMES } from '@/lib/constants';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ToastContainer } from '@/components/ui/Toast';
import type { User, Location, CleaningSchedule } from '@/lib/types';

export default function SchedulesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { toasts, addToast, removeToast } = useToast();
  const [employees, setEmployees] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [schedules, setSchedules] = useState<CleaningSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  
  // Toggle between Routine (Day of Week) and Specific Date
  const [scheduleType, setScheduleType] = useState<'routine' | 'specific'>('routine');
  
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [empRes, locRes, schedRes] = await Promise.all([
        supabase.from('users').select('*').eq('role', 'employee').eq('is_active', true).order('name'),
        supabase.from('locations').select('*').eq('is_active', true).order('name'),
        supabase.from('cleaning_schedules').select('*, user:users(id, name), location:locations(id, name)').eq('is_active', true).order('day_of_week'),
      ]);
      setEmployees((empRes.data || []) as User[]);
      setLocations((locRes.data || []) as Location[]);
      setSchedules((schedRes.data || []) as CleaningSchedule[]);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAssign = async () => {
    if (!selectedEmployee) { addToast('Pilih karyawan', 'warning'); return; }
    if (scheduleType === 'specific' && !selectedDate) { addToast('Pilih tanggal', 'warning'); return; }
    
    setSaving(true);
    try {
      const payload: any = {
        user_id: selectedEmployee,
        location_id: selectedLocation || null,
        is_active: true,
      };
      
      if (scheduleType === 'routine') {
        payload.day_of_week = selectedDay;
        payload.scheduled_date = null;
      } else {
        payload.day_of_week = null;
        payload.scheduled_date = selectedDate;
      }

      // Upsert without onConflict if it's a specific date because it's a different unique constraint now
      // Actually, since we changed the unique constraint to two partial indexes, we can't use simple upsert with onConflict.
      // We'll manage it by first checking if it exists, or doing an insert, then catching error.
      // Instead, let's delete existing first if we want to overwrite, or just do an insert and handle conflict.
      
      if (scheduleType === 'routine') {
        // Find existing routine
        const { data: existing } = await supabase
          .from('cleaning_schedules')
          .select('id')
          .eq('user_id', selectedEmployee)
          .eq('day_of_week', selectedDay)
          .maybeSingle();
          
        if (existing) payload.id = existing.id;
      } else {
        // Find existing specific date
        const { data: existing } = await supabase
          .from('cleaning_schedules')
          .select('id')
          .eq('user_id', selectedEmployee)
          .eq('scheduled_date', selectedDate)
          .maybeSingle();
          
        if (existing) payload.id = existing.id;
      }
      
      const { error } = await supabase.from('cleaning_schedules').upsert(payload);
      if (error) throw error;
      
      addToast('Jadwal ditugaskan!', 'success');
      fetchData();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Gagal', 'error'); }
    finally { setSaving(false); }
  };

  const handleRemove = async (s: CleaningSchedule) => {
    try {
      await supabase.from('cleaning_schedules').update({ is_active: false }).eq('id', s.id);
      addToast('Jadwal dihapus', 'success');
      fetchData();
    } catch { addToast('Gagal', 'error'); }
  };

  if (loading) return <div className="flex justify-center min-h-[60vh]"><LoadingSpinner size="lg" /></div>;

  // Group schedules by day
  const byDay: Record<number, CleaningSchedule[]> = {};
  for (let i = 0; i <= 6; i++) byDay[i] = [];
  
  const specificSchedules: CleaningSchedule[] = [];

  schedules.forEach((s) => { 
    if (s.day_of_week !== null && s.day_of_week !== undefined) {
      if (byDay[s.day_of_week]) byDay[s.day_of_week].push(s); 
    } else if (s.scheduled_date) {
      specificSchedules.push(s);
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jadwal Piket</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Atur jadwal kebersihan berdasarkan hari</p>
      </div>

      {/* Assign form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Tugaskan Jadwal</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Pilih karyawan</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button 
              onClick={() => setScheduleType('routine')}
              className={cn("flex-1 text-xs font-medium py-1 rounded-md transition-colors", scheduleType === 'routine' ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}
            >Rutin Mingguan</button>
            <button 
              onClick={() => setScheduleType('specific')}
              className={cn("flex-1 text-xs font-medium py-1 rounded-md transition-colors", scheduleType === 'specific' ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400")}
            >Tanggal Spesifik</button>
          </div>

          {scheduleType === 'routine' ? (
            <select value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))} className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          ) : (
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
          )}
          <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Lokasi mana saja</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button onClick={handleAssign} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Menyimpan...' : 'Tugaskan'}
          </button>
        </div>
      </div>

      {/* Schedule grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {DAY_NAMES.map((dayName, dayIndex) => (
          <div
            key={dayIndex}
            className={cn(
              'bg-white dark:bg-gray-900 rounded-xl border overflow-hidden cursor-pointer transition-all',
              scheduleType === 'routine' && selectedDay === dayIndex
                ? 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-900'
                : 'border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
            )}
            onClick={() => { setScheduleType('routine'); setSelectedDay(dayIndex); }}
          >
            <div className={cn('px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between', dayIndex === 0 || dayIndex === 6 ? 'bg-red-50 dark:bg-red-900/10' : 'bg-gray-50 dark:bg-gray-800/50')}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{dayName}</h3>
              <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">+ Klik untuk pilih</span>
            </div>
            <div className="p-4 space-y-2 min-h-[80px]">
              {byDay[dayIndex].length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-600">Belum ada tugas</p>
              ) : (
                byDay[dayIndex].map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{(s.user as unknown as User)?.name}</p>
                      {s.location && <p className="text-xs text-gray-500 dark:text-gray-400">{(s.location as Location).name}</p>}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleRemove(s); }} className="text-xs text-red-500 hover:underline">Hapus</button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Specific Dates grid */}
      {specificSchedules.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Jadwal Tanggal Spesifik</h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Karyawan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lokasi</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {specificSchedules.sort((a,b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || '')).map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{s.scheduled_date}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{(s.user as unknown as User)?.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{s.location ? (s.location as Location).name : 'Semua Lokasi'}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleRemove(s)} className="text-xs text-red-500 hover:text-red-700 font-medium">Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
