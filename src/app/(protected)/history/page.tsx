'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatDateTime, cn } from '@/lib/utils';
import { STORAGE_BUCKET, SIGNED_URL_EXPIRY } from '@/lib/constants';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import type { CleaningReport } from '@/lib/types';

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export default function HistoryPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [reports, setReports] = useState<CleaningReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoModal, setPhotoModal] = useState<{ open: boolean; beforeUrl: string; afterUrl: string }>({ open: false, beforeUrl: '', afterUrl: '' });
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  // Filters
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`;
      const endMonth = filterMonth === 12 ? 1 : filterMonth + 1;
      const endYear = filterMonth === 12 ? filterYear + 1 : filterYear;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

      const { data } = await supabase
        .from('cleaning_reports')
        .select('*')
        .eq('user_id', user.id)
        .gte('submission_date', startDate)
        .lt('submission_date', endDate)
        .neq('status', 'draft')
        .order('submitted_at', { ascending: false });

      setReports((data || []) as CleaningReport[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user, supabase, filterMonth, filterYear]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const viewPhotos = async (photoAfterPath: string | null, photoBeforePath: string | null) => {
    setLoadingPhoto(true);
    try {
      const paths: string[] = [];
      if (photoAfterPath) paths.push(photoAfterPath);
      if (photoBeforePath) paths.push(photoBeforePath);
      if (paths.length === 0) return;

      const results = await Promise.all(
        paths.map(p => supabase.storage.from(STORAGE_BUCKET).createSignedUrl(p, SIGNED_URL_EXPIRY))
      );

      const afterUrl = photoAfterPath ? (results[0]?.data?.signedUrl || '') : '';
      const beforeUrl = photoBeforePath ? (results[photoAfterPath ? 1 : 0]?.data?.signedUrl || '') : '';
      setPhotoModal({ open: true, afterUrl, beforeUrl });
    } catch {
      // ignore
    } finally {
      setLoadingPhoto(false);
    }
  };

  // Group by date
  const groupedReports: Record<string, CleaningReport[]> = {};
  reports.forEach((report) => {
    const date = report.submission_date;
    if (!groupedReports[date]) groupedReports[date] = [];
    groupedReports[date].push(report);
  });

  // Year options (current year - 1 to current year)
  const yearOptions = [now.getFullYear(), now.getFullYear() - 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Riwayat Laporan</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Riwayat laporan kebersihan Anda
        </p>
      </div>

      {/* Month/Year Filter */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bulan</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tahun</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex-1" />
          <div className="self-end">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {reports.length} laporan
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada laporan di {MONTH_NAMES[filterMonth - 1]} {filterYear}</p>
        </div>
      ) : (
        Object.entries(groupedReports).map(([date, dateReports]) => (
          <div key={date} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {formatDate(date)}
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  ({dateReports.length} laporan)
                </span>
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {dateReports.map((report) => (
                <div key={report.id} className="flex items-center gap-4 px-6 py-4">
                  {/* Photo buttons */}
                  <div className="flex gap-1 flex-shrink-0">
                    {report.photo_before_url && (
                      <button
                        onClick={() => viewPhotos(null, report.photo_before_url)}
                        className="w-12 h-12 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 flex items-center justify-center hover:ring-2 hover:ring-orange-400 transition-all cursor-pointer"
                        title="Foto Sebelum"
                      >
                        <span className="text-xs font-medium text-orange-600 dark:text-orange-400">B</span>
                      </button>
                    )}
                    {report.photo_url && (
                      <button
                        onClick={() => viewPhotos(report.photo_url, null)}
                        className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer"
                        title="Foto Sesudah"
                      >
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">A</span>
                      </button>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {report.notes || 'Tidak ada catatan'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDateTime(report.submitted_at)}
                    </p>
                    {report.rejection_note && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Ditolak: {report.rejection_note}
                      </p>
                    )}
                    {report.rating && (
                      <p className="text-xs text-amber-500 mt-1">
                        {'★'.repeat(report.rating)}{'☆'.repeat(5 - report.rating)} 
                        {report.rating_note && <span className="text-gray-400 ml-1">— {report.rating_note}</span>}
                      </p>
                    )}
                  </div>

                  <span className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0',
                    report.status === 'valid'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  )}>
                    {report.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Photo Modal */}
      <Modal
        isOpen={photoModal.open}
        onClose={() => setPhotoModal({ open: false, beforeUrl: '', afterUrl: '' })}
        title="Pratinjau Foto"
      >
        {loadingPhoto ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-4">
            {photoModal.beforeUrl && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">📷 Sebelum</p>
                <img src={photoModal.beforeUrl} alt="Sebelum" className="w-full rounded-lg border border-gray-200 dark:border-gray-700" />
              </div>
            )}
            {photoModal.afterUrl && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">📷 Sesudah</p>
                <img src={photoModal.afterUrl} alt="Sesudah" className="w-full rounded-lg border border-gray-200 dark:border-gray-700" />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
