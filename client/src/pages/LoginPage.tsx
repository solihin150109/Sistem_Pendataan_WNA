import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
//import { motion } from 'motion/react';
import { motion } from 'framer-motion';

// Logo Dirjen Imigrasi untuk Login Page
const LogoImigrasiFull = ({ className }: { className?: string }) => (
  <img 
    src="/logo.png" 
    alt="Logo Direktorat Jenderal Imigrasi"
    className={className}
  />
);

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 Form submitted with username:', username);
    setLoading(true);
    setError('');
    
    const success = await login(username, password);
    console.log('📝 Login result:', success);
    
    if (success) {
      console.log('📝 Navigating to dashboard...');
      navigate('/');
    } else {
      setError('Kredensial tidak valid. Sila periksa kembali.');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6 relative overflow-hidden">
      {/* Abstract background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary-blue/30 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px]"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl z-10"
      >
        <div className="flex flex-col md:flex-row bg-white rounded-[40px] overflow-hidden shadow-2xl border border-white/10">
          {/* Left Side - Branding dengan Logo Imigrasi */}
          <div className="hidden md:flex md:w-2/5 bg-primary-blue p-10 flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent"></div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="h-28 w-28 mb-6 flex items-center justify-center">
                <LogoImigrasiFull className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tighter uppercase leading-tight">
                PANTAU ASING
              </h1>
              <p className="text-[9px] font-bold text-white/70 uppercase tracking-[0.15em] mt-2 leading-relaxed">
                Pemetaan dan Analisis<br/>Terpadu Orang Asing
              </p>
            </div>
            <div className="relative z-10 text-center">
              <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.2em] leading-relaxed">
                Kantor Imigrasi Kelas I TPI Jambi<br/>
                Direktorat Jenderal Imigrasi
              </p>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="flex-1 p-8 md:p-14">
             <div className="mb-10 text-center md:text-left">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Selamat Datang</h2>
                <p className="text-sm text-slate-500 mt-2">Sistem Informasi Pengawasan Orang Asing</p>
             </div>

             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Username</label>
                   <div className="relative">
                      <UserIcon className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input 
                        required
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full h-12 px-12 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-primary-blue focus:ring-4 focus:ring-primary-blue/5 transition-all text-sm font-medium"
                        placeholder="Masukkan username"
                      />
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Password</label>
                   <div className="relative">
                      <Lock className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input 
                        required
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-12 px-12 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-primary-blue focus:ring-4 focus:ring-primary-blue/5 transition-all text-sm font-medium"
                        placeholder="Masukkan password"
                      />
                   </div>
                </div>

                {error && (
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold"
                   >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                   </motion.div>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-primary-blue text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary-blue/20 hover:shadow-primary-blue/40 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3"
                >
                   {loading ? (
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        Masuk Ke Sistem
                      </>
                   )}
                </button>
             </form>

             <div className="mt-12 text-center">
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
                  DIREKTORAT JENDERAL IMIGRASI - KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN INDONESIA
                </p>
                <p className="text-[9px] text-slate-400 mt-2 font-mono">© 2026 • All Rights Reserved</p>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
