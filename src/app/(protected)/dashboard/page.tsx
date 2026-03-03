'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getTodayDate, formatTime, cn, getGeolocation, getTodayDayOfWeek } from '@/lib/utils';
import { MAX_DAILY_REPORTS, VIOLATION_THRESHOLD, STORAGE_BUCKET, DAY_NAMES } from '@/lib/constants';
import { compressImage, getCompressionStats } from '@/lib/compress';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FileUpload } from '@/components/ui/FileUpload';
import { ToastContainer } from '@/components/ui/Toast';
import type { CleaningReport, Location, CleaningSchedule } from '@/lib/types';

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const [todayCount, setTodayCount] = useState(0);
  const [todayReports, setTodayReports] = useState<CleaningReport[]>([]);
  const [draftReport, setDraftReport] = useState<CleaningReport | null>(null);
  const [consecutiveMissed, setConsecutiveMissed] = useState(0);
  const [locations, setLocations] = useState<Location[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<CleaningSchedule | null>(null);

  // Step 1: Before photo
  const [fileBefore, setFileBefore] = useState<File | null>(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingBefore, setSubmittingBefore] = useState(false);
  const [compressingBefore, setCompressingBefore] = useState(false);

  // Step 2: After photo
  const [fileAfter, setFileAfter] = useState<File | null>(null);
  const [submittingAfter, setSubmittingAfter] = useState(false);
  const [compressingAfter, setCompressingAfter] = useState(false);

  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const today = getTodayDate();

      // Today's completed reports (valid/rejected only, not drafts)
      const { data: reports } = await supabase
        .from('cleaning_reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('submission_date', today)
        .neq('status', 'draft')
        .order('submitted_at', { ascending: false });

      setTodayReports((reports || []) as CleaningReport[]);
      setTodayCount(reports?.length || 0);

      // Check for active draft
      const { data: drafts } = await supabase
        .from('cleaning_reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1);

      setDraftReport(drafts && drafts.length > 0 ? (drafts[0] as CleaningReport) : null);

      // Latest discipline
      const { data: disc } = await supabase
        .from('discipline_log')
        .select('consecutive_missed')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      setConsecutiveMissed(disc?.consecutive_missed || 0);

      // Locations
      const { data: locs } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setLocations((locs || []) as Location[]);

      // Today's schedule
      const dow = getTodayDayOfWeek();
      const { data: scheds } = await supabase
        .from('cleaning_schedules')
        .select('*, location:locations(id, name)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .or(`scheduled_date.eq.${today},day_of_week.eq.${dow}`);

      const sortedScheds = (scheds || []).sort((a, b) => {
        if (a.scheduled_date && !b.scheduled_date) return -1;
        if (!a.scheduled_date && b.scheduled_date) return 1;
        return 0;
      });

      setTodaySchedule((sortedScheds[0] as CleaningSchedule) || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user, supabase]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Step 1: Upload before photo → create draft
  const handleBeforeCompress = async (selectedFile: File | null) => {
    if (!selectedFile) { setFileBefore(null); return; }
    setCompressingBefore(true);
    try {
      const compressed = await compressImage(selectedFile);
      setFileBefore(compressed);
    } catch { setFileBefore(selectedFile); }
    finally { setCompressingBefore(false); }
  };

  const handleStartTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileBefore || !user) return;

    setSubmittingBefore(true);
    try {
      const geo = await getGeolocation();

      // Upload before photo
      const ext = fileBefore.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}_before.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, fileBefore, { cacheControl: '3600', upsert: false });
      if (uploadErr) throw uploadErr;

      // Create draft report
      const { error: insertErr } = await supabase.from('cleaning_reports').insert({
        user_id: user.id,
        photo_before_url: fileName,
        photo_url: null,
        status: 'draft',
        notes: notes.trim() || null,
        latitude: geo?.latitude || null,
        longitude: geo?.longitude || null,
        location_id: selectedLocation || null,
      });
      if (insertErr) throw insertErr;

      addToast('Foto sebelum tersimpan! Sekarang bersihkan area, lalu foto sesudah.', 'success');
      setFileBefore(null);
      setNotes('');
      setSelectedLocation('');
      fetchDashboard();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan', 'error');
    } finally { setSubmittingBefore(false); }
  };

  // Step 2: Upload after photo → complete draft
  const handleAfterCompress = async (selectedFile: File | null) => {
    if (!selectedFile) { setFileAfter(null); return; }
    setCompressingAfter(true);
    try {
      const compressed = await compressImage(selectedFile);
      setFileAfter(compressed);
    } catch { setFileAfter(selectedFile); }
    finally { setCompressingAfter(false); }
  };

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileAfter || !user || !draftReport) return;

    setSubmittingAfter(true);
    try {
      // Upload after photo to storage
      const ext = fileAfter.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}_after.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, fileAfter, { cacheControl: '3600', upsert: false });
      if (uploadErr) throw uploadErr;

      // Complete draft via server-side API (bypasses RLS)
      const res = await fetch('/api/reports/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: draftReport.id,
          photo_url: fileName,
          user_id: user.id,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal menyelesaikan laporan');

      addToast('Laporan selesai! 🎉', 'success');
      setFileAfter(null);
      setDraftReport(null);
      fetchDashboard();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menyelesaikan', 'error');
    } finally { setSubmittingAfter(false); }
  };

  // Cancel draft
  const handleCancelDraft = async () => {
    if (!draftReport) return;
    try {
      // Delete before photo from storage
      if (draftReport.photo_before_url) {
        await supabase.storage.from(STORAGE_BUCKET).remove([draftReport.photo_before_url]);
      }
      await supabase.from('cleaning_reports').delete().eq('id', draftReport.id);
      addToast('Draft dibatalkan', 'info');
      fetchDashboard();
    } catch { addToast('Gagal membatalkan draft', 'error'); }
  };

  if (loading) return <div className="flex justify-center min-h-[60vh]"><LoadingSpinner size="lg" /></div>;

  const remaining = MAX_DAILY_REPORTS - todayCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kirim laporan kebersihan harian Anda</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Laporan Hari Ini</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{todayCount}</span>
            <span className="text-lg text-gray-400">/ {MAX_DAILY_REPORTS}</span>
          </div>
          <p className={cn('text-xs mt-2', remaining > 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
            {remaining > 0 ? `Sisa ${remaining} laporan` : 'Batas tercapai'}
          </p>
        </div>

        <div className={cn('bg-white dark:bg-gray-900 rounded-xl border p-5', consecutiveMissed >= VIOLATION_THRESHOLD ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-gray-800')}>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status Disiplin</p>
          <span className={cn('text-sm font-semibold', consecutiveMissed >= VIOLATION_THRESHOLD ? 'text-red-600 dark:text-red-400' : consecutiveMissed > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400')}>
            {consecutiveMissed >= VIOLATION_THRESHOLD ? `⚠ PELANGGARAN (${consecutiveMissed} hari absen)` : consecutiveMissed > 0 ? `Peringatan: ${consecutiveMissed} hari absen` : '✓ Baik'}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Jadwal Hari Ini</p>
          {todaySchedule ? (
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {todaySchedule.scheduled_date
                  ? `Spesifik: ${todaySchedule.scheduled_date}`
                  : DAY_NAMES[getTodayDayOfWeek()]}
              </p>
              {todaySchedule.location && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">📍 {(todaySchedule.location as Location).name}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-600">Belum ada jadwal</p>
          )}
        </div>
      </div>

      {/* Active Draft — Step 2 (complete the task) */}
      {draftReport && (
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border-2 border-amber-300 dark:border-amber-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                <span className="text-lg">🧹</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-amber-800 dark:text-amber-200">Tugas Sedang Berjalan</h2>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Dimulai {formatTime(draftReport.created_at)} — Foto sebelum sudah tersimpan
                </p>
              </div>
            </div>
            <button onClick={handleCancelDraft} className="text-xs text-red-500 hover:underline">Batalkan</button>
          </div>

          <form onSubmit={handleCompleteTask} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">📷 Foto Sesudah (wajib) — Ambil foto setelah bersih-bersih</label>
              <FileUpload onFileSelect={handleAfterCompress} disabled={submittingAfter || compressingAfter} />
              {compressingAfter && <p className="text-xs text-blue-600 flex items-center gap-2 mt-1"><LoadingSpinner size="sm" /> Mengompresi...</p>}
            </div>

            <button
              type="submit"
              disabled={!fileAfter || submittingAfter || compressingAfter}
              className="w-full py-3 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submittingAfter ? <><LoadingSpinner size="sm" /> Menyelesaikan...</> : '✅ Selesaikan Tugas'}
            </button>
          </form>
        </div>
      )}

      {/* Step 1: Start new task (only if no active draft and remaining > 0) */}
      {!draftReport && remaining > 0 && (
        <form onSubmit={handleStartTask} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">📷 Mulai Tugas Baru</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ambil foto sebelum bersih-bersih, lalu foto sesudah setelah selesai.</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Foto Sebelum (wajib) *</label>
            <FileUpload onFileSelect={handleBeforeCompress} disabled={submittingBefore || compressingBefore} />
            {compressingBefore && <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 mt-1"><LoadingSpinner size="sm" /> Mengompresi...</p>}
          </div>

          {locations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lokasi</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pilih lokasi (opsional)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan (opsional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Catatan tambahan..."
            />
          </div>

          <button
            type="submit"
            disabled={!fileBefore || submittingBefore || compressingBefore}
            className="w-full py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submittingBefore ? <><LoadingSpinner size="sm" /> Menyimpan...</> : '🚀 Mulai Tugas'}
          </button>
        </form>
      )}

      {!draftReport && remaining <= 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6 text-center">
          <p className="text-sm font-medium text-green-700 dark:text-green-300">✓ Anda sudah mengirim semua {MAX_DAILY_REPORTS} laporan hari ini!</p>
        </div>
      )}

      {/* Today's completed submissions */}
      {todayReports.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Laporan Selesai Hari Ini</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {todayReports.map((report) => (
              <div key={report.id} className="flex items-center gap-4 px-6 py-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">{formatTime(report.submitted_at)}</p>
                  {report.notes && <p className="text-xs text-gray-500 dark:text-gray-400">{report.notes}</p>}
                  <div className="flex gap-2 mt-1">
                    {report.photo_before_url && <span className="text-xs text-orange-500">📷 Sebelum</span>}
                    {report.photo_url && <span className="text-xs text-blue-500">📷 Sesudah</span>}
                  </div>
                </div>
                <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', report.status === 'valid' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300')}>
                  {report.status}
                </span>
                {report.rating && (
                  <span className="text-xs text-amber-500">{'★'.repeat(report.rating)}{'☆'.repeat(5 - report.rating)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
