import { useEffect, useState } from 'react';
import { 
  FileText, Download, Calendar, TrendingUp, Users, Globe, 
  Briefcase, ShieldCheck, BarChart3, PieChart, Activity,
  Loader2, CheckCircle2, AlertCircle, Printer
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['rgb(0, 31, 63)', 'rgb(212, 175, 55)', 'rgb(16, 185, 129)', 'rgb(245, 158, 11)'];

interface DashboardStats {
  total: number;
  byType: { VOA: number; ITK: number; ITAS: number; ITAP: number };
  byCountry: Array<{ name: string; jumlah: number }>;
  byRegion?: Record<string, number>;
}

interface ActivityLog {
  id: string;
  action: string;
  username: string;
  userName: string;
  timestamp: string;
  data?: any;
}

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      setError('Anda tidak memiliki akses ke halaman ini');
    } else {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, activitiesRes] = await Promise.all([
        api.getDashboardStats(),
        api.getActivityLogs()
      ]);
      
      if (statsRes.success) setStats(statsRes.data);
      if (activitiesRes.success) setActivities(activitiesRes.data.slice(0, 50));
    } catch (error) {
      console.error('Error fetching reports:', error);
      setError('Gagal memuat data laporan');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const blob = await api.exportExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan_sipagi_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage('Data berhasil diekspor ke Excel');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal mengekspor data');
      setTimeout(() => setError(''), 3000);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const blob = await api.exportReport();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan_sipagi_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage('Laporan PDF berhasil diekspor');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal mengekspor PDF');
      setTimeout(() => setError(''), 3000);
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <ShieldCheck className="h-16 w-16 text-red-400 mx-auto mb-4" />
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
          <p className="text-slate-500">Memuat data laporan...</p>
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'VOA', value: stats?.byType.VOA || 0 },
    { name: 'ITK', value: stats?.byType.ITK || 0 },
    { name: 'ITAS', value: stats?.byType.ITAS || 0 },
    { name: 'ITAP', value: stats?.byType.ITAP || 0 },
  ];

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
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              Laporan & Statistik
            </h2>
          </div>
          <p className="text-slate-500 pl-[52px]">
            Analisis data dan laporan lengkap sistem SIPAGI
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Export PDF
          </button>
        </div>
      </div>

      {/* Statistik Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total WNA</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.total || 0}</p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
              <Globe className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Negara Asal</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.byCountry.length || 0}</p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Izin Terbatas</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.byType.ITAS || 0}</p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Aktivitas</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{activities.length}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
          <div className="mb-6 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary-blue" />
            <h3 className="text-lg font-bold text-slate-900">Distribusi Izin Tinggal</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[0]} radius={[8, 8, 2, 2]} barSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
          <div className="mb-6 flex items-center gap-3">
            <PieChart className="h-5 w-5 text-primary-blue" />
            <h3 className="text-lg font-bold text-slate-900">Komposisi Data</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Countries */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
        <div className="mb-6 flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary-blue" />
          <h3 className="text-lg font-bold text-slate-900">Top 10 Negara Asal</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 rounded-xl">
              <tr>
                <th className="text-left p-3 text-xs font-bold text-slate-500">Rank</th>
                <th className="text-left p-3 text-xs font-bold text-slate-500">Negara</th>
                <th className="text-right p-3 text-xs font-bold text-slate-500">Jumlah</th>
                <th className="text-right p-3 text-xs font-bold text-slate-500">Persentase</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.byCountry || []).slice(0, 10).map((country, index) => {
                const percentage = ((country.jumlah / (stats?.total || 1)) * 100).toFixed(1);
                return (
                  <tr key={country.name} className="border-b border-slate-100">
                    <td className="p-3 text-sm font-bold text-slate-500">#{index + 1}</td>
                    <td className="p-3 text-sm font-medium text-slate-800">{country.name}</td>
                    <td className="p-3 text-right text-sm font-bold text-slate-800">{country.jumlah}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                          <div className="bg-primary-blue h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                        </div>
                        <span className="text-xs text-slate-500">{percentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Logs */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
        <div className="mb-6 flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary-blue" />
          <h3 className="text-lg font-bold text-slate-900">Log Aktivitas Terbaru</h3>
        </div>
        <div className="space-y-3">
          {activities.slice(0, 10).map((log) => (
            <div key={log.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
              <div className="h-8 w-8 rounded-full bg-primary-blue/10 flex items-center justify-center text-primary-blue">
                <Activity className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">
                  <span className="font-bold">{log.userName || log.username}</span> {log.action.toLowerCase().replace('_', ' ')}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(log.timestamp).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <p className="text-center text-slate-400 py-8">Belum ada aktivitas</p>
          )}
        </div>
      </div>
    </div>
  );
}
