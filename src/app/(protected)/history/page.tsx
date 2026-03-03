'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatDateTime, cn } from '@/lib/utils';
import { STORAGE_BUCKET, SIGNED_URL_EXPIRY } from '@/lib/constants';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import type { CleaningReport } from '@/lib/types';

export default function HistoryPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [reports, setReports] = useState<CleaningReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoModal, setPhotoModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' });
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('cleaning_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(50);

      setReports((data || []) as CleaningReport[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const viewPhoto = async (photoPath: string) => {
    setLoadingPhoto(true);
    try {
      const { data } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(photoPath, SIGNED_URL_EXPIRY);

      if (data?.signedUrl) {
        setPhotoModal({ open: true, url: data.signedUrl });
      }
    } catch {
      // ignore
    } finally {
      setLoadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Group by date
  const groupedReports: Record<string, CleaningReport[]> = {};
  reports.forEach((report) => {
    const date = report.submission_date;
    if (!groupedReports[date]) groupedReports[date] = [];
    groupedReports[date].push(report);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Riwayat Laporan</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Riwayat laporan kebersihan Anda
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada laporan</p>
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
                  {/* Photo thumbnail */}
                  <button
                    onClick={() => report.photo_url && viewPhoto(report.photo_url)}
                    className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
                  >
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </button>

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
                  </div>

                  <span className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full',
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
        onClose={() => setPhotoModal({ open: false, url: '' })}
        title="Pratinjau Foto"
      >
        {loadingPhoto ? (
          <LoadingSpinner />
        ) : (
          <img
            src={photoModal.url}
            alt="Cleaning report photo"
            className="w-full rounded-lg"
          />
        )}
      </Modal>
    </div>
  );
}
