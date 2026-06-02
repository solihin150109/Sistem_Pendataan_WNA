import { useState, useRef } from 'react';
import { 
  X, Upload, FileSpreadsheet, Download, AlertCircle, 
  CheckCircle2, Loader2, FileText, AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validExtensions.includes(fileExt)) {
        setError('Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls');
        setSelectedFile(null);
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError('Ukuran file maksimal 5MB');
        setSelectedFile(null);
        return;
      }
      
      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setError(null);
    
    try {
      console.log('Downloading template...');
      const blob = await api.downloadTemplate();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_import_wna.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('Template downloaded successfully');
    } catch (err: any) {
      console.error('Template download error:', err);
      setError(err.message || 'Gagal mendownload template. Periksa koneksi internet Anda.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Pilih file terlebih dahulu');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.importWNA(selectedFile);
      console.log('Import response:', response);
      
      setResult(response.data);
      
      if (response.data.importedCount > 0) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Gagal mengimport data. Periksa format file Anda.');
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setDownloadingTemplate(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Import Data WNA</h3>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Petunjuk */}
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-blue-800 mb-1">Petunjuk Import</h4>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>Download template terlebih dahulu untuk melihat format yang benar</li>
                  <li>Format file yang didukung: CSV, Excel (.xlsx, .xls)</li>
                  <li>Ukuran file maksimal: 5MB</li>
                  <li>Kolom wajib diisi: <strong>namaLengkap, noPaspor, negara, type, sponsor, alamat</strong></li>
                  <li>Type yang valid: VOA, ITK, ITAS, ITAP</li>
                  <li>Status yang valid: ACTIVE, EXPIRED, DEPARTED</li>
                  <li>Pastikan tidak ada nomor paspor yang duplikat</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Template Download */}
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary-blue/10 text-primary-blue">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Template Import</p>
                <p className="text-xs text-slate-400">Download template CSV untuk panduan</p>
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="px-4 py-2 text-sm font-bold text-primary-blue bg-primary-blue/10 rounded-xl hover:bg-primary-blue/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {downloadingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloadingTemplate ? 'Mengunduh...' : 'Download Template'}
            </button>
          </div>

          {/* File Upload */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">Pilih File</label>
            <div 
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
                ${selectedFile ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 hover:border-primary-blue/50 hover:bg-slate-50'}
                ${error && !selectedFile ? 'border-red-300 bg-red-50' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="h-10 w-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-medium text-emerald-700">{selectedFile.name}</p>
                  <p className="text-xs text-emerald-500">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setResult(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 text-slate-400 mx-auto" />
                  <p className="text-sm text-slate-500">
                    Klik atau drag & drop file di sini
                  </p>
                  <p className="text-xs text-slate-400">
                    CSV, XLSX, atau XLS (max 5MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && !result && (
            <div className="rounded-2xl p-4 bg-red-50 border border-red-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-4 border ${
                result.importedCount > 0 
                  ? 'bg-emerald-50 border-emerald-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.importedCount > 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 mb-2">Hasil Import:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="bg-white rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-primary-blue">{result.totalRows || 0}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Total Baris</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{result.importedCount || 0}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Berhasil</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-yellow-600">{result.duplicateCount || 0}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Duplikat</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{result.errorCount || 0}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Error</p>
                    </div>
                  </div>
                  
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-emerald-200">
                      <p className="text-xs font-semibold text-red-600 mb-2">Detail Error:</p>
                      <div className="max-h-32 overflow-y-auto space-y-1 bg-white rounded-lg p-2">
                        {result.errors.map((err: string, idx: number) => (
                          <p key={idx} className="text-xs text-red-500">• {err}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {result.duplicatePassports && result.duplicatePassports.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-emerald-200">
                      <p className="text-xs font-semibold text-yellow-600 mb-2">Nomor Paspor Duplikat:</p>
                      <div className="flex flex-wrap gap-2">
                        {result.duplicatePassports.map((passport: string, idx: number) => (
                          <span key={idx} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                            {passport}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Loading State */}
          {uploading && (
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-blue" />
              <p className="text-slate-500">Sedang mengimport data...</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
            >
              Tutup
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedFile || uploading}
              className="flex-1 py-3 rounded-xl bg-primary-blue text-white font-bold hover:bg-primary-blue/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? 'Mengimport...' : 'Import Data'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}