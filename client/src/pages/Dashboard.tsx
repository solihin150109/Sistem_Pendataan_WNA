import { useEffect, useState } from 'react';
import { 
  Users, Globe, Briefcase, ShieldCheck, TrendingUp, MapPin, ArrowUpRight, Navigation, Shield
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const COLORS = ['rgb(0, 31, 63)', 'rgb(212, 175, 55)', 'rgb(16, 185, 129)', 'rgb(245, 158, 11)'];

interface DashboardStats {
  total: number;
  byType: { VOA: number; ITK: number; ITAS: number; ITAP: number };
  byCountry: Array<{ name: string; jumlah: number }>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth(); // Tambahkan ini
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.getDashboardStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-slate-500">Memuat data dashboard...</p>
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'VoA', value: stats?.byType.VOA || 0 },
    { name: 'ITK', value: stats?.byType.ITK || 0 },
    { name: 'ITAS', value: stats?.byType.ITAS || 0 },
    { name: 'ITAP', value: stats?.byType.ITAP || 0 },
  ];

  const statsCards = [
    { name: 'Total WNA Terdata', value: stats?.total || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'VoA Active', value: stats?.byType.VOA || 0, icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: 'Izin Terbatas', value: stats?.byType.ITAS || 0, icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50' },
    { name: 'Izin Tetap', value: stats?.byType.ITAP || 0, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner with Role Info */}
      <div className="bg-gradient-to-r from-primary-blue/10 to-primary-blue/5 rounded-3xl p-6 border border-primary-blue/20">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Selamat Datang, {user?.name || user?.username}
            </h1>
            <p className="text-slate-500 mt-1">
              {isAdmin 
                ? 'Anda memiliki akses penuh untuk mengelola data WNA' 
                : 'Anda memiliki akses hanya baca untuk melihat data WNA'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.name} 
            className="group relative flex flex-col rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-2xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{stat.name}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {stat.value.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Jiwa</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
          <div className="mb-8 flex items-center justify-between border-b border-slate-50 pb-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1.5 bg-primary-blue rounded-full"></div>
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Tren Distribusi Izin Tinggal</h3>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Real-time</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" fill={COLORS[0]} radius={[8, 8, 2, 2]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-200 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Komposisi Izin</h3>
            <p className="text-xs text-slate-400 mt-1">Berdasarkan kategori utama</p>
          </div>
          <div className="flex-1 min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={10} dataKey="value" stroke="none">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Countries */}
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Ranking Negara Asal</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100 px-3 py-1 rounded-full">Real-time</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(stats?.byCountry || []).slice(0, 5).map((country, index) => (
            <div key={country.name} className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-5 border border-slate-200/50 hover:bg-white hover:border-primary-blue/30 hover:shadow-lg transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300">0{index + 1}</span>
                <Users className="h-4 w-4 text-slate-300 group-hover:text-primary-blue transition-colors" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Negara</p>
                <p className="text-sm font-bold text-slate-900 group-hover:text-primary-blue transition-colors">{country.name}</p>
              </div>
              <div className="flex items-baseline gap-1 pt-2 border-t border-slate-200">
                <span className="text-xl font-bold text-slate-900 font-mono">{country.jumlah}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Personil</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}