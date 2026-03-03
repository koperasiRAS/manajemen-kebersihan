'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/useToast';
import { cn, formatDateTime } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { ToastContainer } from '@/components/ui/Toast';
import type { User } from '@/lib/types';

export default function EmployeesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { toasts, addToast, removeToast } = useToast();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPhone, setFormPhone] = useState('');

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; emp: User | null }>({ open: false, emp: null });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState<{ open: boolean; emp: User | null }>({ open: false, emp: null });
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Detail modal
  const [detailModal, setDetailModal] = useState<{ open: boolean; emp: User | null }>({ open: false, emp: null });

  const fetchEmployees = useCallback(async () => {
    try {
      const { data } = await supabase.from('users').select('*').eq('role', 'employee').order('name');
      setEmployees((data || []) as User[]);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleAdd = async () => {
    if (!formName || !formEmail || !formPassword) {
      addToast('Nama, email, dan kata sandi wajib diisi.', 'warning');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail, password: formPassword, name: formName, phone_number: formPhone || null }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      addToast('Karyawan berhasil dibuat!', 'success');
      setShowAddModal(false);
      setFormName(''); setFormEmail(''); setFormPassword(''); setFormPhone('');
      fetchEmployees();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal membuat karyawan', 'error');
    } finally { setAdding(false); }
  };

  const openEdit = (emp: User) => {
    setEditName(emp.name);
    setEditPhone(emp.phone_number || '');
    setEditModal({ open: true, emp });
  };

  const handleEdit = async () => {
    if (!editModal.emp || !editName) { addToast('Nama wajib diisi.', 'warning'); return; }
    setEditSaving(true);
    try {
      const { error } = await supabase.from('users').update({ name: editName, phone_number: editPhone || null }).eq('id', editModal.emp.id);
      if (error) throw error;
      addToast('Karyawan berhasil diperbarui!', 'success');
      setEditModal({ open: false, emp: null });
      fetchEmployees();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Gagal', 'error'); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteModal.emp) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/users/${deleteModal.emp.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      addToast(`${deleteModal.emp.name} berhasil dihapus`, 'success');
      setDeleteModal({ open: false, emp: null });
      fetchEmployees();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Gagal menghapus karyawan', 'error'); }
    finally { setDeleteLoading(false); }
  };

  if (loading) return <div className="flex justify-center min-h-[60vh]"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manajemen Karyawan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tambah dan kelola data karyawan</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Tambah Karyawan
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Telepon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{emp.phone_number || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setDetailModal({ open: true, emp })} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Detail</button>
                      <button onClick={() => openEdit(emp)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Edit</button>
                      <button onClick={() => setDeleteModal({ open: true, emp })} className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Karyawan Baru" onConfirm={handleAdd} confirmText="Buat Karyawan" loading={adding}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap *</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Budi Santoso" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="budi@perusahaan.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kata Sandi *</label>
            <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min 6 karakter" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomor Telepon</label>
            <input type="text" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+628xxx (opsional)" />
          </div>
        </div>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal isOpen={editModal.open} onClose={() => setEditModal({ open: false, emp: null })} title="Edit Karyawan" onConfirm={handleEdit} confirmText="Simpan Perubahan" loading={editSaving}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap *</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomor Telepon</label>
            <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </Modal>

      {/* Detail Employee Modal */}
      <Modal isOpen={detailModal.open} onClose={() => setDetailModal({ open: false, emp: null })} title="Detail Karyawan">
        {detailModal.emp && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold', detailModal.emp.is_active ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500')}>
                {detailModal.emp.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{detailModal.emp.name}</h3>
                <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', detailModal.emp.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500')}>
                  {detailModal.emp.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Telepon</p>
                <p className="font-medium text-gray-900 dark:text-white">{detailModal.emp.phone_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
                <p className="font-medium text-gray-900 dark:text-white capitalize">{detailModal.emp.role === 'employee' ? 'Karyawan' : 'Pemilik'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">ID</p>
                <p className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">{detailModal.emp.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Terdaftar</p>
                <p className="font-medium text-gray-900 dark:text-white">{detailModal.emp.created_at ? formatDateTime(detailModal.emp.created_at) : '—'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
      {/* Delete Employee Modal */}
      <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, emp: null })} title="Hapus Karyawan" onConfirm={handleDelete} confirmText="Ya, Hapus" confirmVariant="danger" loading={deleteLoading}>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Apakah Anda yakin ingin menghapus karyawan <strong>{deleteModal.emp?.name}</strong>? Semua data terkait akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
        </p>
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
