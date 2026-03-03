'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { ToastContainer } from '@/components/ui/Toast';
import type { Location } from '@/lib/types';

export default function LocationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { toasts, addToast, removeToast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');

  // Edit modal
  const [editModal, setEditModal] = useState<{ open: boolean; loc: Location | null }>({ open: false, loc: null });
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; loc: Location | null }>({ open: false, loc: null });
  const [deleting, setDeleting] = useState(false);

  const fetchLocations = useCallback(async () => {
    try {
      const { data } = await supabase.from('locations').select('*').order('name');
      setLocations((data || []) as Location[]);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const handleAdd = async () => {
    if (!formName) { addToast('Nama lokasi wajib diisi.', 'warning'); return; }
    setAdding(true);
    try {
      const { error } = await supabase.from('locations').insert({ name: formName, description: formDesc || null });
      if (error) throw error;
      addToast('Lokasi berhasil dibuat!', 'success');
      setShowAddModal(false); setFormName(''); setFormDesc('');
      fetchLocations();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Gagal', 'error'); }
    finally { setAdding(false); }
  };

  const openEdit = (loc: Location) => {
    setEditName(loc.name);
    setEditDesc(loc.description || '');
    setEditModal({ open: true, loc });
  };

  const handleEdit = async () => {
    if (!editModal.loc || !editName) { addToast('Nama lokasi wajib diisi.', 'warning'); return; }
    setEditSaving(true);
    try {
      const { error } = await supabase.from('locations').update({ name: editName, description: editDesc || null }).eq('id', editModal.loc.id);
      if (error) throw error;
      addToast('Lokasi berhasil diperbarui!', 'success');
      setEditModal({ open: false, loc: null });
      fetchLocations();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Gagal', 'error'); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteModal.loc) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('locations').delete().eq('id', deleteModal.loc.id);
      if (error) throw error;
      addToast('Lokasi berhasil dihapus!', 'success');
      setDeleteModal({ open: false, loc: null });
      fetchLocations();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Gagal menghapus', 'error'); }
    finally { setDeleting(false); }
  };

  const toggleActive = async (loc: Location) => {
    try {
      await supabase.from('locations').update({ is_active: !loc.is_active }).eq('id', loc.id);
      addToast(`${loc.name} ${loc.is_active ? 'dinonaktifkan' : 'diaktifkan'}`, 'success');
      fetchLocations();
    } catch { addToast('Gagal memperbarui', 'error'); }
  };

  if (loading) return <div className="flex justify-center min-h-[60vh]"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lokasi</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kelola area dan lokasi kebersihan</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Tambah Lokasi
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => (
          <div key={loc.id} className={cn('bg-white dark:bg-gray-900 rounded-xl border p-5 transition-colors', loc.is_active ? 'border-gray-200 dark:border-gray-800' : 'border-gray-200 dark:border-gray-800 opacity-60')}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{loc.name}</h3>
                {loc.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{loc.description}</p>}
              </div>
              <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', loc.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500')}>
                {loc.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => openEdit(loc)} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
              <button onClick={() => toggleActive(loc)} className={cn('text-xs font-medium hover:underline', loc.is_active ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400')}>
                {loc.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button onClick={() => setDeleteModal({ open: true, loc })} className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">Hapus</button>
            </div>
          </div>
        ))}
        {locations.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada lokasi yang ditambahkan</p>
          </div>
        )}
      </div>

      {/* Add Location Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Lokasi Baru" onConfirm={handleAdd} confirmText="Buat Lokasi" loading={adding}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lokasi *</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Misal: Lantai 1, Ruang Rapat" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
            <textarea rows={2} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Deskripsi opsional" />
          </div>
        </div>
      </Modal>

      {/* Edit Location Modal */}
      <Modal isOpen={editModal.open} onClose={() => setEditModal({ open: false, loc: null })} title="Edit Lokasi" onConfirm={handleEdit} confirmText="Simpan Perubahan" loading={editSaving}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lokasi *</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
            <textarea rows={2} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      </Modal>

      {/* Delete Location Modal */}
      <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, loc: null })} title="Hapus Lokasi" onConfirm={handleDelete} confirmText="Ya, Hapus" confirmVariant="danger" loading={deleting}>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Apakah Anda yakin ingin menghapus lokasi <strong>{deleteModal.loc?.name}</strong>? Tindakan ini tidak bisa dibatalkan.
        </p>
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
