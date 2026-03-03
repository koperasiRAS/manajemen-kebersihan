'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime, cn, objectsToCSV } from '@/lib/utils';
import { STORAGE_BUCKET, SIGNED_URL_EXPIRY, MAX_RATING } from '@/lib/constants';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import type { CleaningReport, User, Location } from '@/lib/types';

export default function OwnerReportsPage() {
  const supabase = createClient();
  const { toasts, addToast, removeToast } = useToast();

  const [reports, setReports] = useState<CleaningReport[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterDate, setFilterDate] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  const [photoModal, setPhotoModal] = useState<{ open: boolean; beforeUrl: string; afterUrl: string }>({ open: false, beforeUrl: '', afterUrl: '' });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; reportId: string; note: string }>({ open: false, reportId: '', note: '' });
  const [ratingModal, setRatingModal] = useState<{ open: boolean; reportId: string; rating: number; note: string }>({ open: false, reportId: '', rating: 0, note: '' });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; reportId: string; employeeName: string }>({ open: false, reportId: '', employeeName: '' });
  const [rejecting, setRejecting] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  const fetchEmployees = useCallback(async () => {
    const [empRes, locRes] = await Promise.all([
      supabase.from('users').select('*').eq('role', 'employee').order('name'),
      supabase.from('locations').select('*').eq('is_active', true).order('name'),
    ]);
    setEmployees((empRes.data || []) as User[]);
    setLocations((locRes.data || []) as Location[]);
  }, [supabase]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('cleaning_reports')
        .select('*, user:users(id, name), location:locations(id, name)')
        .order('submitted_at', { ascending: false })
        .limit(200);

      // Date filter: use specific date if provided, otherwise filter by month/year
      if (filterDate) {
        query = query.eq('submission_date', filterDate);
      } else {
        const startDate = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`;
        const endMonth = filterMonth === 12 ? 1 : filterMonth + 1;
        const endYear = filterMonth === 12 ? filterYear + 1 : filterYear;
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
        query = query.gte('submission_date', startDate).lt('submission_date', endDate);
      }

      if (filterEmployee) query = query.eq('user_id', filterEmployee);
      if (filterStatus) query = query.eq('status', filterStatus);
      if (filterLocation) query = query.eq('location_id', filterLocation);

      const { data } = await query;
      setReports((data || []) as CleaningReport[]);
    } catch { addToast('Failed to fetch reports', 'error'); }
    finally { setLoading(false); }
  }, [supabase, filterDate, filterMonth, filterYear, filterEmployee, filterStatus, filterLocation, addToast]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchReports(); }, [fetchReports]);

  const viewPhotos = async (photoAfterPath: string, photoBeforePath: string | null) => {
    try {
      const paths = [photoAfterPath];
      if (photoBeforePath) paths.push(photoBeforePath);
      const results = await Promise.all(
        paths.map(p => supabase.storage.from(STORAGE_BUCKET).createSignedUrl(p, SIGNED_URL_EXPIRY))
      );
      const afterUrl = results[0]?.data?.signedUrl || '';
      const beforeUrl = results[1]?.data?.signedUrl || '';
      setPhotoModal({ open: true, afterUrl, beforeUrl });
    } catch { addToast('Gagal memuat foto', 'error'); }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await supabase.from('cleaning_reports').update({ status: 'rejected', rejection_note: rejectModal.note.trim() || null }).eq('id', rejectModal.reportId);
      await supabase.from('audit_log').insert({ action: 'report_reject', target_type: 'report', target_id: rejectModal.reportId, details: { note: rejectModal.note } });
      addToast('Laporan ditolak', 'success');
      setRejectModal({ open: false, reportId: '', note: '' });
      fetchReports();
    } catch { addToast('Gagal', 'error'); }
    finally { setRejecting(false); }
  };

  const handleRate = async () => {
    if (!ratingModal.rating) { addToast('Pilih rating terlebih dahulu', 'warning'); return; }
    setSavingRating(true);
    try {
      await supabase.from('cleaning_reports').update({ rating: ratingModal.rating, rating_note: ratingModal.note.trim() || null }).eq('id', ratingModal.reportId);
      await supabase.from('audit_log').insert({ action: 'report_rate', target_type: 'report', target_id: ratingModal.reportId, details: { rating: ratingModal.rating } });
      addToast('Rating tersimpan!', 'success');
      setRatingModal({ open: false, reportId: '', rating: 0, note: '' });
      fetchReports();
    } catch { addToast('Failed', 'error'); }
    finally { setSavingRating(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${deleteModal.reportId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      addToast('Laporan & foto dihapus', 'success');
      setDeleteModal({ open: false, reportId: '', employeeName: '' });
      fetchReports();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Gagal', 'error'); }
    finally { setDeleting(false); }
  };

  const handleCleanup = async () => {
    if (!confirm('This will permanently delete all reports and photos older than 6 months. Continue?')) return;
    setCleaningUp(true);
    try {
      const res = await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retention_months: 6 }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      addToast(`Pembersihan selesai: ${result.reports_deleted} laporan, ${result.photos_deleted} foto dihapus`, 'success');
      fetchReports();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Pembersihan gagal', 'error'); }
    finally { setCleaningUp(false); }
  };

  const handleExportCSV = () => {
    const csvData = reports.map((r) => ({
      Employee: (r.user as unknown as User)?.name || '—',
      Date: r.submission_date,
      Submitted_At: r.submitted_at,
      Status: r.status,
      Location: r.location ? (r.location as Location).name : '',
      Rating: r.rating || '',
      Notes: r.notes || '',
      Latitude: r.latitude || '',
      Longitude: r.longitude || '',
      Rejection_Note: r.rejection_note || '',
    }));
    const csv = objectsToCSV(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `reports-${filterDate || 'all'}.csv`; link.click();
    URL.revokeObjectURL(url);
    addToast('CSV diekspor', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Semua Laporan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Lihat, beri rating, dan kelola semua laporan kebersihan</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCleanup} disabled={cleaningUp} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
            {cleaningUp ? 'Membersihkan...' : '🗑 Bersihkan Data Lama'}
          </button>
          <button onClick={handleExportCSV} disabled={reports.length === 0} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors">
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bulan</label>
            <select value={filterMonth} onChange={(e) => { setFilterMonth(Number(e.target.value)); setFilterDate(''); }} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tahun</label>
            <select value={filterYear} onChange={(e) => { setFilterYear(Number(e.target.value)); setFilterDate(''); }} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tanggal Spesifik</label>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Karyawan</label>
            <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Semua</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Semua</option>
              <option value="valid">Valid</option>
              <option value="draft">Draft</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Lokasi</label>
            <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Semua</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          {(filterDate || filterEmployee || filterStatus || filterLocation) && (
            <button onClick={() => { setFilterDate(''); setFilterEmployee(''); setFilterStatus(''); setFilterLocation(''); }} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Hapus semua filter</button>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">{reports.length} laporan ditemukan</span>
        </div>
      </div>

      {/* Reports table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? <div className="p-8"><LoadingSpinner /></div> : reports.length === 0 ? <div className="p-12 text-center"><p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada laporan ditemukan</p></div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Karyawan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Foto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{(report.user as unknown as User)?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatDateTime(report.submitted_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {report.photo_before_url && (
                          <button onClick={() => viewPhotos(report.photo_url || '', report.photo_before_url)} className="text-orange-600 dark:text-orange-400 hover:underline text-xs">Sebelum</button>
                        )}
                        {report.photo_url ? (
                          <button onClick={() => viewPhotos(report.photo_url!, report.photo_before_url)} className="text-blue-600 dark:text-blue-400 hover:underline text-xs">{report.photo_before_url ? 'Sesudah' : 'Lihat'}</button>
                        ) : (
                          <span className="text-xs text-gray-400">Draft</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{report.location ? (report.location as Location).name : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', report.status === 'valid' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : report.status === 'draft' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300')}>{report.status === 'draft' ? 'Draft' : report.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {report.rating ? (
                        <span className="text-xs text-amber-500">{'★'.repeat(report.rating)}{'☆'.repeat(MAX_RATING - report.rating)}</span>
                      ) : (
                        <button onClick={() => setRatingModal({ open: true, reportId: report.id, rating: 0, note: '' })} className="text-xs text-purple-600 dark:text-purple-400 hover:underline">Beri Rating</button>
                      )}
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      {report.status === 'valid' && !report.rating && (
                        <button onClick={() => setRejectModal({ open: true, reportId: report.id, note: '' })} className="text-xs text-red-600 dark:text-red-400 hover:underline">Tolak</button>
                      )}
                      <button onClick={() => setDeleteModal({ open: true, reportId: report.id, employeeName: (report.user as unknown as User)?.name || '' })} className="text-xs text-gray-500 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:underline">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      <Modal isOpen={photoModal.open} onClose={() => setPhotoModal({ open: false, beforeUrl: '', afterUrl: '' })} title="Foto Laporan">
        <div className="space-y-4">
          {photoModal.beforeUrl && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">📷 Sebelum</p>
              <img src={photoModal.beforeUrl} alt="Sebelum" className="w-full rounded-lg border border-gray-200 dark:border-gray-700" />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">📷 Sesudah</p>
            <img src={photoModal.afterUrl} alt="Sesudah" className="w-full rounded-lg border border-gray-200 dark:border-gray-700" />
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={rejectModal.open} onClose={() => setRejectModal({ open: false, reportId: '', note: '' })} title="Tolak Laporan" onConfirm={handleReject} confirmText="Tolak" confirmVariant="danger" loading={rejecting}>
        <textarea rows={3} value={rejectModal.note} onChange={(e) => setRejectModal((p) => ({ ...p, note: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Alasan penolakan..." />
      </Modal>

      {/* Rating Modal */}
      <Modal isOpen={ratingModal.open} onClose={() => setRatingModal({ open: false, reportId: '', rating: 0, note: '' })} title="Beri Rating" onConfirm={handleRate} confirmText="Simpan Rating" loading={savingRating}>
        <div className="space-y-4">
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setRatingModal((p) => ({ ...p, rating: star }))} className={cn('text-3xl transition-colors', ratingModal.rating >= star ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600 hover:text-amber-300')}>
                ★
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500">{ratingModal.rating > 0 ? `${ratingModal.rating} / ${MAX_RATING}` : 'Pilih rating'}</p>
          <textarea rows={2} value={ratingModal.note} onChange={(e) => setRatingModal((p) => ({ ...p, note: e.target.value }))} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Catatan feedback (opsional)" />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, reportId: '', employeeName: '' })} title="Hapus Laporan" onConfirm={handleDelete} confirmText="Hapus Permanen" confirmVariant="danger" loading={deleting}>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Ini akan <strong>menghapus secara permanen</strong> laporan dan fotonya dari penyimpanan. Tindakan ini tidak bisa dibatalkan.
        </p>
        {deleteModal.employeeName && (
          <p className="text-sm text-gray-500 mt-2">Karyawan: <strong>{deleteModal.employeeName}</strong></p>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
