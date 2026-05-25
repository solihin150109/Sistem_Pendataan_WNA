import { useEffect, useState } from 'react';
import { 
  Users, UserPlus, Edit2, Trash2, Shield, ShieldCheck, 
  X, Save, Loader2, CheckCircle2, AlertCircle, Key, Mail,
  Phone, MapPin, Briefcase, Calendar, Lock, UserCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';
import { useAuth } from '../AuthContext';

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  nip?: string;
  jabatan?: string;
  unitKerja?: string;
  noTelepon?: string;
  alamat?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export default function UsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    role: 'Operator',
    password: '',
    confirmPassword: '',
    nip: '',
    jabatan: '',
    unitKerja: '',
    noTelepon: '',
    alamat: ''
  });

  useEffect(() => {
    if (!isAdmin) {
      setError('Anda tidak memiliki akses ke halaman ini');
      setTimeout(() => setError(''), 3000);
    } else {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.getUsers();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message || 'Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      name: '',
      email: '',
      role: 'Operator',
      password: '',
      confirmPassword: '',
      nip: '',
      jabatan: '',
      unitKerja: '',
      noTelepon: '',
      alamat: ''
    });
    setEditingUser(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (!formData.username.trim()) {
      setError('Username wajib diisi');
      setSubmitting(false);
      return;
    }
    if (!formData.name.trim()) {
      setError('Nama lengkap wajib diisi');
      setSubmitting(false);
      return;
    }
    if (!formData.email.trim()) {
      setError('Email wajib diisi');
      setSubmitting(false);
      return;
    }
    if (!editingUser && !formData.password) {
      setError('Password wajib diisi untuk pengguna baru');
      setSubmitting(false);
      return;
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok');
      setSubmitting(false);
      return;
    }
    if (formData.password && formData.password.length < 6) {
      setError('Password minimal 6 karakter');
      setSubmitting(false);
      return;
    }

    try {
      let response;
      if (editingUser) {
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          nip: formData.nip,
          jabatan: formData.jabatan,
          unitKerja: formData.unitKerja,
          noTelepon: formData.noTelepon,
          alamat: formData.alamat
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        response = await api.updateUser(editingUser.username, updateData);
      } else {
        response = await api.createUser({
          username: formData.username,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password,
          nip: formData.nip,
          jabatan: formData.jabatan,
          unitKerja: formData.unitKerja,
          noTelepon: formData.noTelepon,
          alamat: formData.alamat
        });
      }

      if (response.success) {
        setShowModal(false);
        resetForm();
        fetchUsers();
        setSuccessMessage(editingUser ? 'Pengguna berhasil diperbarui' : 'Pengguna baru berhasil ditambahkan');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.message || 'Gagal menyimpan data');
      }
    } catch (error: any) {
      setError(error.message || 'Gagal menyimpan data');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (user.username === currentUser?.username) {
      setError('Anda tidak dapat menghapus akun sendiri');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (confirm(`Yakin ingin menghapus pengguna "${user.name}"?`)) {
      try {
        const response = await api.deleteUser(user.username);
        if (response.success) {
          fetchUsers();
          setSuccessMessage('Pengguna berhasil dihapus');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setError(response.message || 'Gagal menghapus pengguna');
        }
      } catch (error: any) {
        setError(error.message || 'Gagal menghapus pengguna');
      }
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const response = await api.toggleUserStatus(user.username, !user.isActive);
      if (response.success) {
        fetchUsers();
        setSuccessMessage(`Status pengguna ${!user.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.message || 'Gagal mengubah status');
      }
    } catch (error: any) {
      setError(error.message || 'Gagal mengubah status');
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      confirmPassword: '',
      nip: user.nip || '',
      jabatan: user.jabatan || '',
      unitKerja: user.unitKerja || '',
      noTelepon: user.noTelepon || '',
      alamat: user.alamat || ''
    });
    setShowModal(true);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Akses Ditolak</h2>
          <p className="text-slate-500">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-blue mx-auto mb-4" />
          <p className="text-slate-500">Memuat data pengguna...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {successMessage && (
        <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-right-5 duration-300">
          <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-right-5 duration-300">
          <div className="bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary-blue/10 text-primary-blue">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              Manajemen Pengguna
            </h2>
          </div>
          <p className="text-slate-500 pl-[52px]">
            Kelola akun pengguna sistem SIPAGI
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-5 py-3 bg-primary-blue text-white rounded-2xl font-bold text-sm hover:bg-primary-blue/90 transition-all"
        >
          <UserPlus className="h-4 w-4" />
          Tambah Pengguna
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Username</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Unit Kerja</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-slate-400">
                      Belum ada data pengguna
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id || user.username} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm font-mono font-medium text-slate-800">{user.username}</td>
                      <td className="p-4 text-sm font-medium text-slate-800">{user.name}</td>
                      <td className="p-4 text-sm text-slate-600">{user.email}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                          user.role === 'Administrator' 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {user.role === 'Administrator' ? <Shield className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-600">{user.unitKerja || '-'}</td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`px-2 py-1 rounded-full text-xs font-bold transition-all ${
                            user.isActive 
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {user.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 rounded-lg text-primary-blue hover:bg-primary-blue/10 transition-all"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {user.username !== currentUser?.username && (
                            <button
                              onClick={() => handleDelete(user)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all"
                              title="Hapus"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Modal Tambah/Edit Pengguna */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {editingUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Username *</label>
                  <input
                    type="text"
                    placeholder="Masukkan username"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                    disabled={!!editingUser}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Email *</label>
                  <input
                    type="email"
                    placeholder="Masukkan email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue bg-white"
                  >
                    <option value="Operator">Operator (Read Only)</option>
                    <option value="Administrator">Administrator (Full Access)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {editingUser ? 'Password Baru (opsional)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    placeholder={editingUser ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {editingUser ? 'Konfirmasi Password Baru' : 'Konfirmasi Password *'}
                  </label>
                  <input
                    type="password"
                    placeholder="Ketik ulang password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">NIP</label>
                  <input
                    type="text"
                    placeholder="Nomor Induk Pegawai"
                    value={formData.nip}
                    onChange={(e) => setFormData({...formData, nip: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Jabatan</label>
                  <input
                    type="text"
                    placeholder="Jabatan"
                    value={formData.jabatan}
                    onChange={(e) => setFormData({...formData, jabatan: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Unit Kerja</label>
                  <input
                    type="text"
                    placeholder="Unit Kerja"
                    value={formData.unitKerja}
                    onChange={(e) => setFormData({...formData, unitKerja: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">No. Telepon</label>
                  <input
                    type="tel"
                    placeholder="Nomor telepon"
                    value={formData.noTelepon}
                    onChange={(e) => setFormData({...formData, noTelepon: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Alamat</label>
                  <textarea
                    placeholder="Alamat lengkap"
                    value={formData.alamat}
                    onChange={(e) => setFormData({...formData, alamat: e.target.value})}
                    rows={3}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue resize-none"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-primary-blue text-white font-bold hover:bg-primary-blue/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
