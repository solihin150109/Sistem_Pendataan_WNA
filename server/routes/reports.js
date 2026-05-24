const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');

// Middleware untuk cek admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'Administrator') {
    return res.status(403).json({ 
      success: false, 
      message: 'Akses ditolak. Hanya Administrator yang dapat mengakses.' 
    });
  }
  next();
};

// GET activity logs (sudah ada, tapi ditambahkan requireAdmin)
// Export PDF (simulasi - untuk production perlu library seperti pdfkit)
router.get('/export/pdf', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Ambil data untuk laporan
    const [wnaSnapshot, usersSnapshot, logsSnapshot] = await Promise.all([
      db.ref('wna').once('value'),
      db.ref('users').once('value'),
      db.ref('activity_logs').orderByChild('timestamp').limitToLast(100).once('value')
    ]);
    
    const wnaData = wnaSnapshot.val() || {};
    const usersData = usersSnapshot.val() || {};
    const logsData = logsSnapshot.val() || {};
    
    const totalWNA = Object.keys(wnaData).length;
    const totalUsers = Object.keys(usersData).length;
    
    // Hitung statistik per tipe
    let voa = 0, itk = 0, itas = 0, itap = 0;
    Object.values(wnaData).forEach(item => {
      switch(item.type) {
        case 'VOA': voa++; break;
        case 'ITK': itk++; break;
        case 'ITAS': itas++; break;
        case 'ITAP': itap++; break;
      }
    });
    
    // Buat HTML sederhana untuk PDF (production sebaiknya gunakan pdfkit atau puppeteer)
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Laporan SIPAGI</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #001f3f; border-bottom: 2px solid #d4af37; padding-bottom: 10px; }
          .header { text-align: center; margin-bottom: 30px; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
          .stat-card { background: #f5f5f5; padding: 15px; border-radius: 10px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #001f3f; }
          .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #001f3f; color: white; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SIPAGI - Laporan Sistem</h1>
          <p>Ditjen Imigrasi Kemenkumham RI</p>
          <p>Tanggal: ${new Date().toLocaleDateString('id-ID')}</p>
        </div>
        
        <div class="stats">
          <div class="stat-card"><div class="stat-value">${totalWNA}</div><div class="stat-label">Total WNA</div></div>
          <div class="stat-card"><div class="stat-value">${voa}</div><div class="stat-label">VOA</div></div>
          <div class="stat-card"><div class="stat-value">${itk}</div><div class="stat-label">ITK</div></div>
          <div class="stat-card"><div class="stat-value">${itas}</div><div class="stat-label">ITAS</div></div>
          <div class="stat-card"><div class="stat-value">${itap}</div><div class="stat-label">ITAP</div></div>
          <div class="stat-card"><div class="stat-value">${totalUsers}</div><div class="stat-label">Total Pengguna</div></div>
        </div>
        
        <h3>10 Aktivitas Terbaru</h3>
        <table>
          <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th></tr></thead>
          <tbody>
            ${Object.values(logsData).slice(0, 10).map(log => `
              <tr>
                <td>${new Date(log.timestamp).toLocaleString('id-ID')}</td>
                <td>${log.userName || log.username}</td>
                <td>${log.action}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Laporan ini digenerate secara otomatis oleh sistem SIPAGI</p>
        </div>
      </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename=laporan_sipagi_${new Date().toISOString().split('T')[0]}.html`);
    res.send(html);
  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export Excel (CSV format for simplicity)
router.get('/export/excel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const wnaSnapshot = await db.ref('wna').once('value');
    const wnaData = wnaSnapshot.val() || {};
    
    const headers = ['ID', 'Nama Lengkap', 'No Paspor', 'Negara', 'Tipe Izin', 'Sponsor', 'Alamat', 'Domisili', 'Latitude', 'Longitude', 'Status', 'Tanggal Dibuat'];
    
    const rows = [headers];
    
    Object.keys(wnaData).forEach(key => {
      const item = wnaData[key];
      rows.push([
        key,
        item.namaLengkap || '',
        item.noPaspor || '',
        item.negara || '',
        item.type || '',
        item.sponsor || '',
        item.alamat || '',
        item.domisili || '',
        item.latitude || '',
        item.longitude || '',
        item.status || '',
        item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : ''
      ]);
    });
    
    const csvContent = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=data_wna_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csvContent); // Add BOM for UTF-8
  } catch (error) {
    console.error('Export Excel error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;