import { motion } from 'motion/react';
import { User, Mail, Shield, ShieldCheck, MapPin, Calendar, Edit2, Camera } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                  <div className="h-full w-full rounded-[28px] bg-gradient-to-br from-primary-blue to-black flex items-center justify-center text-4xl font-bold text-accent-gold">
                    {user?.name.charAt(0)}
                  </div>
                </div>
                <button className="absolute bottom-2 right-2 p-2.5 rounded-xl bg-white text-primary-blue shadow-lg border border-slate-100 hover:scale-110 transition-transform">
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-6 space-y-2">
                <h3 className="text-xl font-bold text-slate-900">{user?.name}</h3>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold uppercase tracking-widest">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Admin
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-slate-100 w-full grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  <p className="text-sm font-bold text-slate-900">Aktif</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Akses</p>
                  <p className="text-sm font-bold text-slate-900">Total</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[40px] p-8 text-white">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Keamanan Sesi
            </h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-tight">Two-Factor</div>
                </div>
                <span className="text-[9px] font-bold text-emerald-500">ENABLED</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-primary-blue/20 flex items-center justify-center text-primary-blue">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-tight">Last Login</div>
                </div>
                <span className="text-[9px] font-bold text-slate-400">TODAY, 08:00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Informasi Dasar</h3>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-primary-blue hover:text-accent-gold transition-all text-[10px] font-bold uppercase tracking-widest">
                <Edit2 className="h-3 w-3" />
                Ubah Profil
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <div className="w-full h-14 px-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700">
                    {user?.name}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">Email Instansi</label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <div className="w-full h-14 px-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700">
                    {user?.email}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">NIP / ID Petugas</label>
                <div className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700 font-mono">
                  198204192005011002
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">Jabatan</label>
                <div className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700">
                  Kepala Sub Seksi Izin Tinggal
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-1">Unit Kerja</label>
                <div className="relative">
                  <MapPin className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <div className="w-full h-14 px-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center text-sm font-bold text-slate-700">
                    Kantor Imigrasi Kelas I TPI Jambi
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 p-6 rounded-3xl bg-amber-50 border border-amber-100 flex items-start gap-4">
              <div className="p-2 rounded-xl bg-amber-500 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-amber-900 uppercase tracking-tight">Otentikasi Berhasil</h5>
                <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                  Akun Anda telah terhubung dengan sistem pusat Direktorat Jenderal Imigrasi. Semua aktivitas monitoring dan registrasi akan dicatat secara otomatis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
