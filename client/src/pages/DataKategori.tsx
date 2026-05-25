import { useEffect, useState } from 'react';
import { IzinTinggalType } from '../types';
import { Database, FileText, Plus, MapPin, Download, X, Loader2, CheckCircle2, AlertTriangle, Navigation, Shield } from 'lucide-react';
//import { motion } from 'framer-motion';
import { motion } from 'framer-motion';
import { api } from '../api';
import { useAuth } from '../AuthContext';

interface DataKategoriProps {
  type: IzinTinggalType;
}

interface WNA {
  id: string;
  namaLengkap: string;
  noPaspor: string;
  negara: string;
  type: string;
  sponsor: string;
  alamat: string;
  status: string;
  latitude?: number;
  longitude?: number;
}

export default function DataKategori({ type }: DataKategoriProps) {
  const { isAdmin, user } = useAuth(); // Tambahkan ini
  const [data, setData] = useState<WNA[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedWNA, setSelectedWNA] = useState<WNA | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  
  const [formData, setFormData] = useState({
    namaLengkap: '',
    noPaspor: '',
    negara: '',
    sponsor: '',
    alamat: '',
    latitude: '',
    longitude: ''
  });

  const getFullTitle = () => {
    switch(type) {
      case 'VOA': return 'Visa on Arrival';
      case 'ITK': return 'Izin Tinggal Kunjungan';
      case 'ITAS': return 'Izin Tinggal Terbatas';
      case 'ITAP': return 'Izin Tinggal Tetap';
      default: return 'Data Warganegara Asing';
    }
  };

  useEffect(() => {
    fetchData();
  }, [type]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getWNA({ type });
      if (response.success) {
        setData(response.data || []);
      } else {
        setError('Gagal memuat data');
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    // Export tetap bisa dilakukan oleh semua user
    setExporting(true);
    setError('');
    try {
      const blob = await api.exportAllWNA();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wna_${type}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage('Data berhasil diekspor');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal mengekspor data');
      setTimeout(() => setError(''), 3000);
    } finally {
      setExporting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      namaLengkap: '',
      noPaspor: '',
      negara: '',
      sponsor: '',
      alamat: '',
      latitude: '',
      longitude: ''
    });
    setError('');
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser Anda tidak mendukung geolokasi');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setGettingLocation(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setFormData(prev => ({
          ...prev,
          latitude: lat.toString(),
          longitude: lng.toString()
        }));
        
        setSuccessMessage(`Lokasi berhasil diambil: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        setTimeout(() => setSuccessMessage(''), 3000);
        setGettingLocation(false);
      },
      (error) => {
        let message = 'Gagal mengambil lokasi';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            message = 'Akses lokasi ditolak. Izinkan akses lokasi di browser Anda.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Informasi lokasi tidak tersedia';
            break;
          case error.TIMEOUT:
            message = 'Waktu pengambilan lokasi habis';
            break;
        }
        setError(message);
        setTimeout(() => setError(''), 4000);
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Cek apakah user adalah Administrator
    if (!isAdmin) {
      setError('Anda tidak memiliki izin untuk menambahkan data. Hanya Administrator yang dapat menambah data.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    if (!formData.namaLengkap.trim()) {
      setError('Nama lengkap wajib diisi');
      setSubmitting(false);
      return;
    }
    if (!formData.noPaspor.trim()) {
      setError('Nomor paspor wajib diisi');
      setSubmitting(false);
      return;
    }
    if (!formData.negara) {
      setError('Negara asal wajib diisi');
      setSubmitting(false);
      return;
    }
    if (!formData.sponsor.trim()) {
      setError('Nama sponsor wajib diisi');
      setSubmitting(false);
      return;
    }
    if (!formData.alamat.trim()) {
      setError('Alamat wajib diisi');
      setSubmitting(false);
      return;
    }
    
    try {
      const submitData = {
        namaLengkap: formData.namaLengkap.trim(),
        noPaspor: formData.noPaspor.trim(),
        negara: formData.negara,
        type: type,
        sponsor: formData.sponsor.trim(),
        alamat: formData.alamat.trim(),
        domisili: 'Kota Jambi',
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        tanggalMasuk: new Date().toISOString().split('T')[0],
        status: 'ACTIVE'
      };
      
      console.log('Submitting data:', submitData);
      
      const response = await api.createWNA(submitData);
      
      if (response.success) {
        setShowModal(false);
        resetForm();
        await fetchData();
        setSuccessMessage('Data berhasil ditambahkan');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.message || 'Gagal menambahkan data');
      }
    } catch (error: any) {
      console.error('Error creating:', error);
      setError(error.message || 'Gagal menambahkan data');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Cek apakah user adalah Administrator
    if (!isAdmin) {
      setError('Anda tidak memiliki izin untuk menghapus data. Hanya Administrator yang dapat menghapus data.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (confirm('Yakin ingin menghapus data ini?')) {
      try {
        const response = await api.deleteWNA(id);
        if (response.success) {
          await fetchData();
          setSuccessMessage('Data berhasil dihapus');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setError(response.message || 'Gagal menghapus data');
        }
      } catch (error: any) {
        setError(error.message || 'Gagal menghapus data');
      }
    }
  };

  const openLocationOnMap = (wna: WNA) => {
    setSelectedWNA(wna);
    setShowLocationModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
          <p className="text-slate-500">Memuat data...</p>
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
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary-blue/10 text-primary-blue">
              <Database className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              {getFullTitle()}
            </h2>
          </div>
          <div className="flex items-center gap-4 pl-[52px]">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-slate-200">
              <FileText className="h-3 w-3" />
              Registry Code: {type}
            </div>
            {/* Role Badge */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${isAdmin ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
              <Shield className="h-3 w-3" />
              {isAdmin ? 'Administrator (Full Access)' : 'Operator (Read Only)'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Mengekspor...' : 'Export Data'}
          </button>
          
          {/* Tombol Tambah Data - Hanya untuk Admin */}
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-primary-blue text-white rounded-2xl font-bold text-sm hover:bg-primary-blue/90 transition-all"
            >
              <Plus className="h-4 w-4" />
              Tambah Data
            </button>
          )}
          
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Entitas</p>
              <p className="text-xl font-bold text-slate-900 font-mono leading-none">{data.length}</p>
            </div>
          </div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">No. Paspor</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Negara</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Sponsor</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lokasi</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-slate-400">
                      Belum ada data.
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-800">{item.namaLengkap}</td>
                      <td className="p-4 text-sm text-slate-600 font-mono">{item.noPaspor}</td>
                      <td className="p-4 text-sm text-slate-600">{item.negara}</td>
                      <td className="p-4 text-sm text-slate-600">{item.sponsor}</td>
                      <td className="p-4">
                        {item.latitude && item.longitude ? (
                          <button
                            onClick={() => openLocationOnMap(item)}
                            className="text-primary-blue hover:text-primary-blue/70 text-xs font-medium flex items-center gap-1"
                          >
                            <MapPin className="h-3 w-3" />
                            Lihat Peta
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Tidak tersedia</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          item.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {isAdmin ? (
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            Hapus
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">Tidak ada akses</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Modal Tambah Data - Hanya muncul untuk Admin */}
      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Tambah Data WNA</h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={formData.namaLengkap}
                    onChange={(e) => setFormData({...formData, namaLengkap: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">No. Paspor *</label>
                  <input
                    type="text"
                    placeholder="Masukkan nomor paspor"
                    value={formData.noPaspor}
                    onChange={(e) => setFormData({...formData, noPaspor: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Negara Asal *</label>
                  <input
                    type="text"
                    placeholder="Masukkan negara asal"
                    value={formData.negara}
                    onChange={(e) => setFormData({...formData, negara: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Sponsor *</label>
                  <input
                    type="text"
                    placeholder="Masukkan nama sponsor/perusahaan"
                    value={formData.sponsor}
                    onChange={(e) => setFormData({...formData, sponsor: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Alamat Lengkap *</label>
                <textarea
                  placeholder="Masukkan alamat lengkap"
                  value={formData.alamat}
                  onChange={(e) => setFormData({...formData, alamat: e.target.value})}
                  className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue resize-none"
                  rows={3}
                  required
                />
              </div>
              
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 mb-1">Koordinat Lokasi (Opsional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="Latitude"
                      value={formData.latitude}
                      onChange={(e) => setFormData({...formData, latitude: e.target.value})}
                      className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue font-mono text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Longitude"
                      value={formData.longitude}
                      onChange={(e) => setFormData({...formData, longitude: e.target.value})}
                      className="w-full p-3 border rounded-xl focus:outline-none focus:border-primary-blue font-mono text-sm"
                    />
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={gettingLocation}
                  className="w-full py-3 rounded-xl bg-primary-blue/10 text-primary-blue text-sm font-bold hover:bg-primary-blue/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {gettingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4" />
                  )}
                  {gettingLocation ? 'Mengambil lokasi...' : '📍 Ambil Lokasi Saya'}
                </button>
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
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {submitting ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lihat Lokasi */}
      {showLocationModal && selectedWNA && selectedWNA.latitude && selectedWNA.longitude && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Lokasi: {selectedWNA.namaLengkap}</h3>
              <button onClick={() => setShowLocationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden">
              <iframe
                title="Location Map"
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://www.google.com/maps?q=${selectedWNA.latitude},${selectedWNA.longitude}&z=15&output=embed`}
                allowFullScreen
              />
            </div>
            <div className="mt-4">
              <p className="text-sm text-slate-600 mb-2">
                <strong>Alamat:</strong> {selectedWNA.alamat}
              </p>
              <div className="flex gap-3">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedWNA.latitude},${selectedWNA.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-2 bg-primary-blue text-white rounded-xl text-sm font-bold"
                >
                  Buka Rute di Google Maps
                </a>
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="flex-1 py-2 border border-slate-200 rounded-xl text-sm font-bold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
