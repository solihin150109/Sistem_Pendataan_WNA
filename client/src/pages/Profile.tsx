import { motion } from 'motion/react';
import { 
    User, Mail, Shield, ShieldCheck, MapPin, Calendar, Edit2, Camera, 
    X, Save, Lock, Phone, Home, Building, Upload, AlertCircle, CheckCircle2,
    Loader2
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { useState, useEffect, useRef } from 'react';
import { ChevronRight, LogOut } from 'lucide-react';

interface UserProfile {
    username: string;
    name: string;
    email: string;
    role: string;
    nip?: string;
    jabatan?: string;
    unitKerja?: string;
    noTelepon?: string;
    alamat?: string;
    photo?: string;
    createdAt?: string;
    updatedAt?: string;
}

export default function Profile() {
    const { user, logout } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    // Form data
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        nip: '',
        jabatan: '',
        unitKerja: '',
        noTelepon: '',
        alamat: ''
    });
    
    // Password form
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const response = await api.getProfile();
            if (response.success) {
                setProfile(response.data);
                setFormData({
                    name: response.data.name || '',
                    email: response.data.email || '',
                    nip: response.data.nip || '',
                    jabatan: response.data.jabatan || '',
                    unitKerja: response.data.unitKerja || '',
                    noTelepon: response.data.noTelepon || '',
                    alamat: response.data.alamat || ''
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            showMessage('error', 'Gagal memuat profil');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleUpdateProfile = async () => {
        setSaving(true);
        try {
            const response = await api.updateProfile(formData);
            if (response.success) {
                setProfile(prev => prev ? { ...prev, ...formData } : null);
                setEditing(false);
                showMessage('success', 'Profil berhasil diperbarui');
            } else {
                showMessage('error', response.message || 'Gagal memperbarui profil');
            }
        } catch (error: any) {
            showMessage('error', error.message || 'Gagal memperbarui profil');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showMessage('error', 'Password baru tidak cocok');
            return;
        }
        
        if (passwordData.newPassword.length < 6) {
            showMessage('error', 'Password minimal 6 karakter');
            return;
        }

        setSaving(true);
        try {
            const response = await api.changePassword(passwordData.currentPassword, passwordData.newPassword);
            if (response.success) {
                setChangingPassword(false);
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                showMessage('success', 'Password berhasil diubah');
            } else {
                showMessage('error', response.message || 'Gagal mengubah password');
            }
        } catch (error: any) {
            showMessage('error', error.message || 'Gagal mengubah password');
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validasi tipe file
        if (!file.type.startsWith('image/')) {
            showMessage('error', 'Hanya file gambar yang diperbolehkan');
            return;
        }

        // Validasi ukuran (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showMessage('error', 'Ukuran gambar maksimal 2MB');
            return;
        }

        setUploadingPhoto(true);
        
        try {
            // Konversi ke base64
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = reader.result as string;
                const response = await api.uploadPhoto(base64String);
                if (response.success) {
                    setProfile(prev => prev ? { ...prev, photo: response.photo } : null);
                    showMessage('success', 'Foto profil berhasil diperbarui');
                } else {
                    showMessage('error', response.message || 'Gagal mengupload foto');
                }
                setUploadingPhoto(false);
            };
            reader.onerror = () => {
                showMessage('error', 'Gagal membaca file');
                setUploadingPhoto(false);
            };
            reader.readAsDataURL(file);
        } catch (error: any) {
            showMessage('error', error.message || 'Gagal mengupload foto');
            setUploadingPhoto(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary-blue mx-auto mb-4" />
                    <p className="text-slate-500">Memuat profil...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Message Notification */}
            {message && (
                <div className={`fixed top-24 right-4 z-50 animate-in slide-in-from-right-5 duration-300`}>
                    <div className={`${message.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2`}>
                        {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                        <span className="text-sm font-medium">{message.text}</span>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary-blue/10 text-primary-blue">
                    <User className="h-6 w-6" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                    Profil Pengguna
                </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-200 overflow-hidden relative group">
                        <div className="absolute top-0 left-0 w-full h-32 bg-primary-blue"></div>
                        <div className="relative pt-12 flex flex-col items-center text-center">
                            <div className="relative">
                                <div className="h-32 w-32 rounded-[32px] bg-white p-1.5 shadow-xl">
                                    {profile?.photo ? (
                                        <img 
                                            src={profile.photo} 
                                            alt={profile.name}
                                            className="h-full w-full rounded-[28px] object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full rounded-[28px] bg-gradient-to-br from-primary-blue to-black flex items-center justify-center text-5xl font-bold text-accent-gold">
                                            {profile?.name?.charAt(0) || user?.name?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingPhoto}
                                    className="absolute bottom-2 right-2 p-2.5 rounded-xl bg-white text-primary-blue shadow-lg border border-slate-100 hover:scale-110 transition-all disabled:opacity-50"
                                >
                                    {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                    className="hidden"
                                />
                            </div>
                            <div className="mt-6 space-y-2">
                                <h3 className="text-xl font-bold text-slate-900">{profile?.name || user?.name}</h3>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold uppercase tracking-widest">
                                    <ShieldCheck className="h-3 w-3" />
                                    {profile?.role || user?.role}
                                </div>
                            </div>
                            <div className="mt-8 pt-8 border-t border-slate-100 w-full grid grid-cols-2 gap-4">
                                <div className="text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Username</p>
                                    <p className="text-sm font-bold text-slate-900">{profile?.username || user?.username}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bergabung</p>
                                    <p className="text-sm font-bold text-slate-900">
                                        {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('id-ID') : '-'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security Card */}
                    <div className="bg-slate-900 rounded-[40px] p-8 text-white">
                        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Keamanan Akun
                        </h4>
                        <div className="space-y-4">
                            <button
                                onClick={() => setChangingPassword(!changingPassword)}
                                className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-primary-blue/20 flex items-center justify-center text-primary-blue">
                                        <Lock className="h-4 w-4" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] font-bold uppercase tracking-tight">Ganti Password</div>
                                        <div className="text-[8px] text-slate-400 mt-0.5">Perbarui kata sandi Anda</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                            </button>
                            
                            <button
                                onClick={logout}
                                className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
                                        <LogOut className="h-4 w-4" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] font-bold uppercase tracking-tight text-red-400">Logout</div>
                                        <div className="text-[8px] text-slate-400 mt-0.5">Keluar dari sistem</div>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Details Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Informasi Dasar</h3>
                            {!editing ? (
                                <button 
                                    onClick={() => setEditing(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-primary-blue hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest"
                                >
                                    <Edit2 className="h-3 w-3" />
                                    Ubah Profil
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            setEditing(false);
                                            fetchProfile();
                                        }}
                                        className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold"
                                    >
                                        Batal
                                    </button>
                                    <button 
                                        onClick={handleUpdateProfile}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-blue text-white hover:bg-primary-blue/90 text-xs font-bold disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                        {saving ? 'Menyimpan...' : 'Simpan'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">Nama Lengkap</label>
                                {editing ? (
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary-blue focus:outline-none text-sm"
                                    />
                                ) : (
                                    <div className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700">
                                        {profile?.name || user?.name}
                                    </div>
                                )}
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">Email</label>
                                {editing ? (
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary-blue focus:outline-none text-sm"
                                    />
                                ) : (
                                    <div className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700">
                                        {profile?.email || user?.email || '-'}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">NIP</label>
                                {editing ? (
                                    <input
                                        type="text"
                                        value={formData.nip}
                                        onChange={(e) => setFormData({...formData, nip: e.target.value})}
                                        className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary-blue focus:outline-none text-sm font-mono"
                                    />
                                ) : (
                                    <div className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700 font-mono">
                                        {profile?.nip || '-'}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">No. Telepon</label>
                                {editing ? (
                                    <input
                                        type="tel"
                                        value={formData.noTelepon}
                                        onChange={(e) => setFormData({...formData, noTelepon: e.target.value})}
                                        className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary-blue focus:outline-none text-sm"
                                    />
                                ) : (
                                    <div className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700">
                                        {profile?.noTelepon || '-'}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">Jabatan</label>
                                {editing ? (
                                    <input
                                        type="text"
                                        value={formData.jabatan}
                                        onChange={(e) => setFormData({...formData, jabatan: e.target.value})}
                                        className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary-blue focus:outline-none text-sm"
                                    />
                                ) : (
                                    <div className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700">
                                        {profile?.jabatan || '-'}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">Unit Kerja</label>
                                {editing ? (
                                    <input
                                        type="text"
                                        value={formData.unitKerja}
                                        onChange={(e) => setFormData({...formData, unitKerja: e.target.value})}
                                        className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary-blue focus:outline-none text-sm"
                                    />
                                ) : (
                                    <div className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700">
                                        {profile?.unitKerja || '-'}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">Alamat</label>
                                {editing ? (
                                    <textarea
                                        value={formData.alamat}
                                        onChange={(e) => setFormData({...formData, alamat: e.target.value})}
                                        rows={3}
                                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary-blue focus:outline-none text-sm resize-none"
                                    />
                                ) : (
                                    <div className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm text-slate-700">
                                        {profile?.alamat || '-'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Change Password Modal */}
            {changingPassword && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Ganti Password</h3>
                            <button onClick={() => setChangingPassword(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Password Saat Ini</label>
                                <input
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                                    placeholder="Masukkan password saat ini"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Password Baru</label>
                                <input
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                                    placeholder="Minimal 6 karakter"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Konfirmasi Password Baru</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                                    placeholder="Ketik ulang password baru"
                                />
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setChangingPassword(false)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleChangePassword}
                                    disabled={saving}
                                    className="flex-1 py-3 rounded-xl bg-primary-blue text-white font-bold hover:bg-primary-blue/90 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {saving ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}