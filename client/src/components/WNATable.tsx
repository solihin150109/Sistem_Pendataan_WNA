import { Search, Plus, Download, Edit2, Trash2, X, Check, MoreVertical, Eye, FileSpreadsheet, MapPin, Navigation, Layers, Satellite, Map as MapIcon2 } from 'lucide-react';
import { WNA, IzinTinggalType } from '../types';
import React, { useState, useEffect, useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet icon issue
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to update map center
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, 15);
  return null;
}

interface WNATableProps {
  data: WNA[];
  type: IzinTinggalType;
}

export default function WNATable({ data: initialData, type }: WNATableProps) {
  const [data, setData] = useState<WNA[]>(initialData);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    namaLengkap: '',
    negara: '',
    noPaspor: '',
    berlakuHingga: '',
    sponsor: '',
    alamat: '',
    jk: 'L' as 'L' | 'P',
    latitude: -1.6101,
    longitude: 103.6131
  });
  
  const [editingItem, setEditingItem] = useState<WNA | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-1.6101, 103.6131]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const markerRef = useRef<L.Marker>(null);

  const filteredData = data.filter(item => 
    item.type === type && 
    (item.namaLengkap.toLowerCase().includes(searchTerm.toLowerCase()) || 
     item.negara.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.noPaspor.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.sponsor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.alamat?.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a,b) => a.namaLengkap.localeCompare(b.namaLengkap));

  const handleAddData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationConfirmed) {
        alert('Sila konfirmasi titik lokasi pada peta terlebih dahulu.');
        return;
    }

    if (editingItem) {
      setData(data.map(item => item.id === editingItem.id ? { ...item, ...formData, type } : item));
      setEditingItem(null);
    } else {
      const newData: WNA = {
        ...formData,
        id: Math.random().toString(36).substr(2, 9),
        type,
        domisili: 'Kota Jambi'
      };
      setData([...data, newData]);
    }
    setIsAddModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      namaLengkap: '',
      negara: '',
      noPaspor: '',
      berlakuHingga: '',
      sponsor: '',
      alamat: '',
      jk: 'L',
      latitude: -1.6101,
      longitude: 103.6131
    });
    setMapCenter([-1.6101, 103.6131]);
    setLocationConfirmed(false);
  };

  const handleEdit = (item: WNA) => {
    setEditingItem(item);
    setFormData({
      namaLengkap: item.namaLengkap,
      negara: item.negara,
      noPaspor: item.noPaspor,
      berlakuHingga: item.berlakuHingga,
      sponsor: item.sponsor || '',
      alamat: item.alamat || '',
      jk: item.jk,
      latitude: item.latitude || -1.6101,
      longitude: item.longitude || 103.6131
    });
    setMapCenter([item.latitude || -1.6101, item.longitude || 103.6131]);
    setLocationConfirmed(true);
    setIsAddModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Apakah anda yakin ingin menghapus data ini?')) {
      setData(data.filter(item => item.id !== id));
    }
  };

   const searchLocation = async () => {
    if (!formData.alamat) {
        alert('Sila masukkan alamat rumah atau perusahaan terlebih dahulu.');
        return;
    }
    setIsSearchingLocation(true);
    try {
        const searchStrategies = [
          `${formData.alamat}, Kota Jambi, Indonesia`,
          `${formData.alamat}, Jambi, Indonesia`,
          `${formData.alamat}`,
          `${formData.alamat.split(',')[0]}, Jambi`
        ];

        let found = false;
        
        for (const query of searchStrategies) {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=3&countrycodes=id`,
            {
              headers: {
                'Accept': 'application/json',
                'Accept-Language': 'id-ID,id;q=0.9',
                'User-Agent': 'SI-WNA-Imigrasi-Jambi/1.0'
              }
            }
          );

          if (!response.ok) continue;

          const results = await response.json();
          const bestResult = results.find((r: any) => 
            r.display_name.toLowerCase().includes('jambi') || 
            r.address?.state?.toLowerCase().includes('jambi') ||
            r.address?.city?.toLowerCase().includes('jambi')
          ) || results[0];

          if (bestResult) {
            const { lat, lon } = bestResult;
            const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
            setMapCenter(newPos);
            setFormData(prev => ({ ...prev, latitude: newPos[0], longitude: newPos[1] }));
            setLocationConfirmed(false);
            found = true;
            break;
          }
        }

        if (!found) {
          alert('Pencarian Otomatis Gagal: Alamat tidak ditemukan. Sila tentukan lokasi secara manual pada peta.');
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        alert('Gangguan Koneksi: Gagal terhubung ke layanan peta.');
    } finally {
        setIsSearchingLocation(false);
    }
  };

  const handleMarkerDragEnd = () => {
    const marker = markerRef.current;
    if (marker) {
      const { lat, lng } = marker.getLatLng();
      setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
      setLocationConfirmed(false);
    }
  };

  const columns = [
    { key: 'namaLengkap', label: 'Personel' },
    { key: 'jk', label: 'JK' },
    { key: 'negara', label: 'Kebangsaan' },
    { key: 'noPaspor', label: 'No. Paspor' },
    { key: 'berlakuHingga', label: 'Expired' },
    { key: 'sponsor', label: 'Sponsor' },
    { key: 'alamat', label: 'Alamat' }
  ];

  const exportToCSV = () => {
    const headers = columns.map(c => c.label).join(',');
    const rows = filteredData.map(item => 
      columns.map(c => (item as any)[c.key] || '-').join(',')
    ).join('\n');
    
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Registry_${type}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative group flex-1 max-w-md">
          <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-blue transition-colors" />
          <input
            type="text"
            placeholder="Cari dalam database..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-12 text-sm font-bold outline-none transition-all focus:border-primary-blue focus:ring-4 focus:ring-primary-blue/5 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={exportToCSV} className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all uppercase tracking-widest">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex h-12 items-center gap-3 rounded-2xl bg-slate-900 px-8 text-xs font-bold text-white shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 uppercase tracking-widest">
            <Plus className="h-4 w-4" />
            Entry Baru
          </button>
        </div>
      </div>

      <div className="rounded-[32px] bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">Pos</th>
                {columns.map(col => (
                  <th key={col.key} className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 whitespace-nowrap">{col.label}</th>
                ))}
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 text-right">Opsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.length > 0 ? (
                filteredData.map((item, idx) => (
                  <tr key={item.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-8 py-5 text-[10px] font-mono font-bold text-slate-300">{(idx + 1).toString().padStart(2, '0')}</td>
                    {columns.map(col => (
                      <td key={col.key} className="px-6 py-5 text-xs text-slate-600 whitespace-nowrap">
                        {col.key === 'namaLengkap' ? (
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-400 group-hover:bg-primary-blue group-hover:text-amber-400 transition-colors border border-slate-200/50">
                              {item.namaLengkap.substring(0, 2)}
                            </div>
                            <div>
                               <p className="font-bold text-slate-900 leading-none mb-1">{item.namaLengkap}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.noPaspor}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-600">{(item as any)[col.key] || '-'}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-8 py-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(item)} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-amber-600 transition-all"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 transition-all"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={columns.length + 2} className="px-8 py-40 text-center text-slate-400 uppercase text-[10px] font-bold">Data Tidak Ditemukan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" />
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }}
               className="relative w-full max-w-6xl rounded-[40px] bg-white p-8 md:p-12 shadow-2xl border border-white/20"
            >
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                <div>
                   <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Entry Database WNA</h3>
                   <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Modul Entry • {type}</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center"><X className="h-6 w-6" /></button>
              </div>

              <form onSubmit={handleAddData} className="max-h-[75vh] overflow-y-auto pr-4 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                   <div className="space-y-6">
                      <div className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 mb-2"><span className="text-[10px] font-bold text-primary-blue uppercase tracking-widest">Bagian 1: Identitas</span></div>
                      <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Lengkap</label><input required className="w-full h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-sm font-bold" value={formData.namaLengkap} onChange={(e) => setFormData({...formData, namaLengkap: e.target.value})} /></div>
                         <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kebangsaan</label><input required className="w-full h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-sm font-bold" value={formData.negara} onChange={(e) => setFormData({...formData, negara: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Paspor</label><input required className="w-full h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-sm font-bold font-mono" value={formData.noPaspor} onChange={(e) => setFormData({...formData, noPaspor: e.target.value})} /></div>
                         <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gender</label><select className="w-full h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-sm font-bold bg-white" value={formData.jk} onChange={(e) => setFormData({...formData, jk: e.target.value as 'L' | 'P'})}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Berlaku Hingga</label><input required type="date" className="w-full h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-sm font-bold" value={formData.berlakuHingga} onChange={(e) => setFormData({...formData, berlakuHingga: e.target.value})} /></div>
                         <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sponsor</label><input required className="w-full h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-sm font-bold" value={formData.sponsor} onChange={(e) => setFormData({...formData, sponsor: e.target.value})} /></div>
                      </div>
                      <div className="pt-8 flex gap-4 hidden lg:flex">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 h-14 rounded-2xl border border-slate-200 font-bold text-slate-400 text-[10px] uppercase">Batal</button>
                        <button type="submit" disabled={!locationConfirmed} className="flex-[2] h-14 rounded-2xl bg-primary-blue font-bold text-accent-gold uppercase text-[10px] disabled:opacity-50">Simpan Data</button>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <div className="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 mb-2 flex items-center justify-between">
                         <span className="text-[10px] font-bold text-primary-blue uppercase tracking-widest">Bagian 2: GIS & Peta</span>
                         <div className={cn("h-2 w-2 rounded-full", locationConfirmed ? "bg-emerald-500" : "bg-amber-500 animate-pulse")}></div>
                      </div>
                      <div className="space-y-4">
                         <div className="flex gap-2">
                            <input required className="flex-1 h-12 px-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-sm font-bold" placeholder="Ketik Alamat..." value={formData.alamat} onChange={(e) => setFormData({...formData, alamat: e.target.value})} />
                            <button type="button" onClick={searchLocation} disabled={isSearchingLocation} className="h-12 w-12 rounded-2xl bg-slate-100 text-primary-blue flex items-center justify-center border border-slate-200">{isSearchingLocation ? <div className="h-4 w-4 border-2 border-t-primary-blue rounded-full animate-spin"></div> : <Search className="h-5 w-5" />}</button>
                         </div>
                         <div className="h-[300px] w-full rounded-3xl overflow-hidden border border-slate-200 relative z-0">
                            <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                               <ChangeView center={mapCenter} />
                               <LayersControl position="topright">
                                  <LayersControl.BaseLayer checked name="OpenStreetMap"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
                                  <LayersControl.BaseLayer name="Satellite"><TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" /></LayersControl.BaseLayer>
                               </LayersControl>
                               <Marker draggable={true} position={[formData.latitude, formData.longitude]} ref={markerRef} eventHandlers={{ dragend: handleMarkerDragEnd }} />
                            </MapContainer>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-[9px] font-bold text-slate-400 uppercase pl-1">Latitude</label><input type="number" step="0.000001" className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-slate-100 font-mono text-[11px] font-bold" value={formData.latitude} onChange={(e) => { const v = parseFloat(e.target.value); setFormData({...formData, latitude: v}); setMapCenter([v, formData.longitude]); setLocationConfirmed(false); }} /></div>
                            <div><label className="text-[9px] font-bold text-slate-400 uppercase pl-1">Longitude</label><input type="number" step="0.000001" className="w-full h-10 px-4 rounded-xl bg-slate-50 border border-slate-100 font-mono text-[11px] font-bold" value={formData.longitude} onChange={(e) => { const v = parseFloat(e.target.value); setFormData({...formData, longitude: v}); setMapCenter([formData.latitude, v]); setLocationConfirmed(false); }} /></div>
                         </div>
                         {!locationConfirmed ? (
                           <button type="button" onClick={() => setLocationConfirmed(true)} className="w-full h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-bold uppercase">Verifikasi Titik Lokasi</button>
                         ) : (
                           <div className="w-full h-12 rounded-2xl bg-emerald-500 text-white text-[10px] font-bold uppercase flex items-center justify-center gap-2">Terverifikasi</div>
                         )}
                      </div>
                   </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
