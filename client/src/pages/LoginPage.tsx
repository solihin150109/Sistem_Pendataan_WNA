import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User as UserIcon, AlertCircle, Compass } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Simulate slight delay for professional feel
    setTimeout(async () => {
      const success = await login(username, password);
      if (success) {
        navigate('/');
      } else {
        setError('Kredensial tidak valid. Sila periksa kembali.');
      }
      setLoading(false);
    }, 800);
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
          {/* Left Side - Branding */}
          <div className="hidden md:flex md:w-2/5 bg-primary-blue p-12 flex-col justify-between relative overflow-hidden">
             <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent"></div>
             <div className="relative z-10">
                <Compass className="h-12 w-12 text-white mb-6" />
                <h1 className="text-3xl font-extrabold text-white tracking-tighter leading-tight uppercase">SI-WNA<br/>Monitor</h1>
             </div>
             <div className="relative z-10">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] leading-relaxed">
                   Kantor Imigrasi Kelas I<br/>TPI Jambi
                </p>
             </div>
          </div>

          {/* Right Side - Form */}
          <div className="flex-1 p-8 md:p-14">
             <div className="mb-10">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Otentikasi Sistem</h2>
                <p className="text-sm text-slate-500 mt-2">Sila masukkan kredensial administrator anda.</p>
             </div>

             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Identitas Pengguna</label>
                   <div className="relative">
                      <UserIcon className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input 
                        required
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full h-12 px-12 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-primary-blue focus:ring-4 focus:ring-primary-blue/5 transition-all text-sm font-medium"
                        placeholder="admin"
                      />
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Kata Sandi</label>
                   <div className="relative">
                      <Lock className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input 
                        required
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-12 px-12 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-primary-blue focus:ring-4 focus:ring-primary-blue/5 transition-all text-sm font-medium"
                        placeholder="••••••••"
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
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">© 2024 Imigrasi Jambi • Secure Access Only</p>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
