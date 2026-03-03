'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const supabase = createClient();
  const { user } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const [todayCount, setTodayCount] = useState(0);
  const [todayReports, setTodayReports] = useState<CleaningReport[]>([]);
  const [consecutiveMissed, setConsecutiveMissed] = useState(0);
  const [locations, setLocations] = useState<Location[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<CleaningSchedule | null>(null);

  const [fileBefore, setFileBefore] = useState<File | null>(null);
  const [fileAfter, setFileAfter] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [compressingBefore, setCompressingBefore] = useState(false);
  const [compressingAfter, setCompressingAfter] = useState(false);
  const [compressionInfoBefore, setCompressionInfoBefore] = useState<string | null>(null);
  const [compressionInfoAfter, setCompressionInfoAfter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const today = getTodayDate();

      // Today's reports
      const { data: reports } = await supabase
        .from('cleaning_reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('submission_date', today)
        .order('submitted_at', { ascending: false });

      setTodayReports((reports || []) as CleaningReport[]);
      setTodayCount(reports?.length || 0);

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

      // Prioritize specific date
      const sortedScheds = (scheds || []).sort((a, b) => {
        if (a.scheduled_date && !b.scheduled_date) return -1;
        if (!a.scheduled_date && b.scheduled_date) return 1;
        return 0;
      });

      setTodaySchedule((sortedScheds[0] as CleaningSchedule) || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user, supabase]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleBeforeSelect = async (selectedFile: File | null) => {
    if (!selectedFile) { setFileBefore(null); setCompressionInfoBefore(null); return; }
    setCompressingBefore(true);
    try {
      const compressed = await compressImage(selectedFile);
      const stats = getCompressionStats(selectedFile, compressed);
      setFileBefore(compressed);
      setCompressionInfoBefore(`Dikompresi: ${stats.originalSize} → ${stats.compressedSize} (${stats.reduction} berkurang)`);
    } catch { setFileBefore(selectedFile); setCompressionInfoBefore(null); }
    finally { setCompressingBefore(false); }
  };

  const handleAfterSelect = async (selectedFile: File | null) => {
    if (!selectedFile) { setFileAfter(null); setCompressionInfoAfter(null); return; }
    setCompressingAfter(true);
    try {
      const compressed = await compressImage(selectedFile);
      const stats = getCompressionStats(selectedFile, compressed);
      setFileAfter(compressed);
      setCompressionInfoAfter(`Dikompresi: ${stats.originalSize} → ${stats.compressedSize} (${stats.reduction} berkurang)`);
    } catch { setFileAfter(selectedFile); setCompressionInfoAfter(null); }
    finally { setCompressingAfter(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileAfter || !user) return;
    if (todayCount >= MAX_DAILY_REPORTS) {
      addToast('Batas laporan harian sudah tercapai.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      // Get geolocation
      const geo = await getGeolocation();

      // Upload after photo (required)
      const extAfter = fileAfter.name.split('.').pop() || 'jpg';
      const fileNameAfter = `${user.id}/${Date.now()}_after.${extAfter}`;
      const { error: uploadAfterErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileNameAfter, fileAfter, { cacheControl: '3600', upsert: false });
      if (uploadAfterErr) throw uploadAfterErr;

      // Upload before photo (optional)
      let fileNameBefore: string | null = null;
      if (fileBefore) {
        const extBefore = fileBefore.name.split('.').pop() || 'jpg';
        fileNameBefore = `${user.id}/${Date.now()}_before.${extBefore}`;
        const { error: uploadBeforeErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileNameBefore, fileBefore, { cacheControl: '3600', upsert: false });
        if (uploadBeforeErr) throw uploadBeforeErr;
      }

      // Insert report
      const { error: insertErr } = await supabase.from('cleaning_reports').insert({
        user_id: user.id,
        photo_url: fileNameAfter,
        photo_before_url: fileNameBefore,
        notes: notes.trim() || null,
        latitude: geo?.latitude || null,
        longitude: geo?.longitude || null,
        location_id: selectedLocation || null,
      });

      if (insertErr) throw insertErr;

      // Audit log
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'report_submit',
        target_type: 'report',
        details: { location_id: selectedLocation || null, has_geo: !!geo },
      });

      addToast('Laporan berhasil dikirim!', 'success');
      setFileBefore(null);
      setFileAfter(null);
      setNotes('');
      setSelectedLocation('');
      setCompressionInfoBefore(null);
      setCompressionInfoAfter(null);
      fetchDashboard();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal mengirim', 'error');
    } finally { setSubmitting(false); }
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
        {/* Submission counter */}
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

        {/* Discipline status */}
        <div className={cn('bg-white dark:bg-gray-900 rounded-xl border p-5', consecutiveMissed >= VIOLATION_THRESHOLD ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-gray-800')}>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status Disiplin</p>
          <span className={cn('text-sm font-semibold', consecutiveMissed >= VIOLATION_THRESHOLD ? 'text-red-600 dark:text-red-400' : consecutiveMissed > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400')}>
            {consecutiveMissed >= VIOLATION_THRESHOLD ? `⚠ PELANGGARAN (${consecutiveMissed} hari absen)` : consecutiveMissed > 0 ? `Peringatan: ${consecutiveMissed} hari absen` : '✓ Baik'}
          </span>
        </div>

        {/* Today's schedule */}
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

      {/* Submit form */}
      {remaining > 0 ? (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kirim Laporan Kebersihan</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📷 Foto Sebelum (opsional)</label>
              <FileUpload onFileSelect={handleBeforeSelect} disabled={submitting || compressingBefore} />
              {compressingBefore && <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 mt-1"><LoadingSpinner size="sm" /> Mengompresi...</p>}
              {compressionInfoBefore && <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ {compressionInfoBefore}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📷 Foto Sesudah (wajib) *</label>
              <FileUpload onFileSelect={handleAfterSelect} disabled={submitting || compressingAfter} />
              {compressingAfter && <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 mt-1"><LoadingSpinner size="sm" /> Mengompresi...</p>}
              {compressionInfoAfter && <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ {compressionInfoAfter}</p>}
            </div>
          </div>

          {/* Location selector */}
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
            disabled={!fileAfter || submitting || compressingBefore || compressingAfter}
            className="w-full py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <><LoadingSpinner size="sm" /> Mengirim...</> : 'Kirim Laporan'}
          </button>
        </form>
      ) : (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6 text-center">
          <p className="text-sm font-medium text-green-700 dark:text-green-300">✓ Anda sudah mengirim semua {MAX_DAILY_REPORTS} laporan hari ini!</p>
        </div>
      )}

      {/* Today's submissions */}
      {todayReports.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Laporan Hari Ini</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {todayReports.map((report) => (
              <div key={report.id} className="flex items-center gap-4 px-6 py-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">{formatTime(report.submitted_at)}</p>
                  {report.notes && <p className="text-xs text-gray-500 dark:text-gray-400">{report.notes}</p>}
                  {report.latitude && report.longitude && <p className="text-xs text-gray-400 mt-0.5">📍 {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</p>}
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
