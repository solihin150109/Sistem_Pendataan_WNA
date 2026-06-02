// src/api/index.ts - Full Worker untuk Cloudflare

import * as bcrypt from 'bcryptjs';

export interface Env {
  FIREBASE_DATABASE_URL: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  JWT_SECRET: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Firebase helper
async function fetchFromFirebase(env: Env, path: string, method: string = 'GET', body?: any): Promise<any> {
  const url = `${env.FIREBASE_DATABASE_URL}/${path}.json`;
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  const response = await fetch(url, options);
  return response.json();
}

// JWT functions
async function generateToken(user: any, env: Env): Promise<string> {
  const payload = {
    username: user.username,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 86400
  };
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload) + env.JWT_SECRET);
  const signature = await crypto.subtle.digest('SHA-256', data);
  return btoa(JSON.stringify(payload)) + '.' + btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifyToken(token: string, env: Env): Promise<any> {
  try {
    const [payloadBase64] = token.split('.');
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    return payload;
  } catch (error: any) {
    throw new Error('Invalid token');
  }
}

async function getUserFromRequest(request: Request, env: Env): Promise<any> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) throw new Error('No Authorization header');
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new Error('Invalid Authorization header format');
  }
  
  return await verifyToken(parts[1], env);
}

// ==================== AUTH ====================
async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const { username, password } = await request.json();
    
    const users = await fetchFromFirebase(env, 'users');
    let userData = null;
    
    for (const [id, data] of Object.entries(users || {})) {
      if (id === username) {
        userData = data;
        break;
      }
    }
    
    if (!userData) {
      return Response.json({ success: false, message: 'Username atau password salah' }, { status: 401, headers: corsHeaders });
    }
    
    const isValid = await bcrypt.compare(password, userData.password);
    if (!isValid) {
      return Response.json({ success: false, message: 'Username atau password salah' }, { status: 401, headers: corsHeaders });
    }
    
    const token = await generateToken({ username, name: userData.name, role: userData.role }, env);
    
    return Response.json({
      success: true,
      token,
      user: { name: userData.name, role: userData.role, username, email: userData.email || '' }
    }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleVerify(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    return Response.json({ success: true, user }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 401, headers: corsHeaders });
  }
}

// ==================== PROFILE ====================
async function handleGetProfile(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    const userData = await fetchFromFirebase(env, `users/${user.username}`);
    
    if (!userData) {
      return Response.json({ success: false, message: 'User not found' }, { status: 404, headers: corsHeaders });
    }
    
    const { password, ...profile } = userData;
    return Response.json({ success: true, data: { username: user.username, ...profile } }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleUpdateProfile(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    const body = await request.json();
    await fetchFromFirebase(env, `users/${user.username}`, 'PATCH', { ...body, updatedAt: new Date().toISOString() });
    return Response.json({ success: true, message: 'Profil berhasil diperbarui' }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleChangePassword(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    const { currentPassword, newPassword } = await request.json();
    const userData = await fetchFromFirebase(env, `users/${user.username}`);
    
    const isValid = await bcrypt.compare(currentPassword, userData.password);
    if (!isValid) {
      return Response.json({ success: false, message: 'Password saat ini salah' }, { status: 401, headers: corsHeaders });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await fetchFromFirebase(env, `users/${user.username}`, 'PATCH', { password: hashedPassword });
    return Response.json({ success: true, message: 'Password berhasil diubah' }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleUploadPhoto(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    const { photo } = await request.json();
    await fetchFromFirebase(env, `users/${user.username}`, 'PATCH', { photo, photoUpdatedAt: new Date().toISOString() });
    return Response.json({ success: true, message: 'Foto berhasil diupload', photo }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ==================== WNA ====================
async function handleGetWNA(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const data = await fetchFromFirebase(env, 'wna');
    let list = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    if (type) list = list.filter(item => item.type === type);
    return Response.json({ success: true, data: list, total: list.length }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleDashboardStats(env: Env): Promise<Response> {
  try {
    const data = await fetchFromFirebase(env, 'wna');
    let total = 0, voa = 0, itk = 0, itas = 0, itap = 0;
    const negaraMap: Record<string, number> = {};
    
    if (data) {
      Object.values(data).forEach((item: any) => {
        total++;
        switch(item.type) {
          case 'VOA': voa++; break;
          case 'ITK': itk++; break;
          case 'ITAS': itas++; break;
          case 'ITAP': itap++; break;
        }
        if (item.negara) negaraMap[item.negara] = (negaraMap[item.negara] || 0) + 1;
      });
    }
    
    const byCountry = Object.entries(negaraMap).map(([name, jumlah]) => ({ name, jumlah })).slice(0, 10);
    return Response.json({ success: true, data: { total, byType: { VOA: voa, ITK: itk, ITAS: itas, ITAP: itap }, byCountry } }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleCreateWNA(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const newData = {
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const result = await fetchFromFirebase(env, 'wna', 'POST', newData);
    return Response.json({ success: true, message: 'Data berhasil ditambahkan', id: result.name }, { status: 201, headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleDeleteWNA(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    await fetchFromFirebase(env, `wna/${id}`, 'DELETE');
    return Response.json({ success: true, message: 'Data berhasil dihapus' }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleExportAllWNA(env: Env): Promise<Response> {
  try {
    const data = await fetchFromFirebase(env, 'wna');
    const list = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    const headers = ['ID', 'Nama Lengkap', 'No Paspor', 'Negara', 'Tipe Izin', 'Sponsor', 'Alamat', 'Domisili', 'Status'];
    const rows = [headers];
    for (const item of list) {
      rows.push([item.id, item.namaLengkap || '', item.noPaspor || '', item.negara || '', item.type || '', item.sponsor || '', item.alamat || '', item.domisili || '', item.status || 'ACTIVE']);
    }
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    return new Response("\uFEFF" + csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=wna_export.csv` }
    });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ==================== IMPORT ====================
async function handleDownloadTemplate(): Promise<Response> {
  const headers = ['namaLengkap', 'noPaspor', 'negara', 'type', 'sponsor', 'alamat', 'domisili', 'latitude', 'longitude', 'status'];
  const csv = headers.join(',') + '\n' +
    '"John Doe","ABC123456","United States","VOA","PT Contoh","Jl. Contoh No. 123","Kota Jambi","-1.65","103.2","ACTIVE"\n' +
    '"Jane Smith","XYZ789012","United Kingdom","ITAS","CV Lain","Jl. Test No. 456","Kota Jambi","-1.65","103.2","ACTIVE"';
  
  return new Response("\uFEFF" + csv, {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=template_import_wna.csv' }
  });
}

// src/api/index.ts - Update handleImportWNA

async function handleImportWNA(request: Request, env: Env): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const text = await file.text();
    
    // Normalize line endings and remove BOM
    let cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/);
    
    if (lines.length < 2) {
      return Response.json({ success: false, message: 'File kosong' }, { status: 400, headers: corsHeaders });
    }
    
    // Parse headers (case insensitive)
    const headerLine = lines[0];
    const rawHeaders = headerLine.split(',').map(h => h.replace(/["']/g, '').trim().toLowerCase());
    
    // Map headers to standard field names
    const headerMap: Record<string, string> = {
      'namalengkap': 'namaLengkap',
      'nama_lengkap': 'namaLengkap',
      'nama': 'namaLengkap',
      'nopaspor': 'noPaspor',
      'no_paspor': 'noPaspor',
      'paspor': 'noPaspor',
      'negara': 'negara',
      'type': 'type',
      'tipe': 'type',
      'sponsor': 'sponsor',
      'alamat': 'alamat',
      'domisili': 'domisili',
      'latitude': 'latitude',
      'lat': 'latitude',
      'longitude': 'longitude',
      'lng': 'longitude',
      'long': 'longitude',
      'status': 'status'
    };
    
    const headers = rawHeaders.map(h => headerMap[h] || h);
    console.log('📋 Headers:', headers);
    
    let importedCount = 0;
    const errors: string[] = [];
    const duplicates: string[] = [];
    
    // Get existing passports
    const existingData = await fetchFromFirebase(env, 'wna');
    const existingPassports = new Set();
    if (existingData) {
      Object.values(existingData).forEach((item: any) => {
        if (item.noPaspor) existingPassports.add(item.noPaspor);
      });
    }
    
    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV line (handle quoted values)
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          if (inQuotes && line[j + 1] === '"') {
            current += '"';
            j++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      // Clean values
      const cleanValues = values.map(v => v.replace(/^["']|["']$/g, '').trim());
      
      // Build row object
      const row: Record<string, string> = {};
      for (let idx = 0; idx < headers.length && idx < cleanValues.length; idx++) {
        row[headers[idx]] = cleanValues[idx];
      }
      
      const rowNum = i + 1;
      
      // Extract required fields
      const namaLengkap = row.namaLengkap || '';
      const noPaspor = row.noPaspor || '';
      const negara = row.negara || '';
      let type = (row.type || 'VOA').toUpperCase();
      const sponsor = row.sponsor || '-';
      const alamat = row.alamat || '';
      const domisili = row.domisili || 'Kota Jambi';
      
      // Parse coordinates
      let latitude: number | null = null;
      let longitude: number | null = null;
      
      const latStr = row.latitude?.toString() || '';
      const lngStr = row.longitude?.toString() || '';
      
      if (latStr && latStr !== '-') {
        const parsed = parseFloat(latStr);
        if (!isNaN(parsed) && parsed >= -90 && parsed <= 90) {
          latitude = parsed;
        } else {
          errors.push(`Baris ${rowNum}: Latitude tidak valid (${latStr})`);
        }
      }
      
      if (lngStr && lngStr !== '-') {
        const parsed = parseFloat(lngStr);
        if (!isNaN(parsed) && parsed >= -180 && parsed <= 180) {
          longitude = parsed;
        } else {
          errors.push(`Baris ${rowNum}: Longitude tidak valid (${lngStr})`);
        }
      }
      
      // Validate type
      if (!['VOA', 'ITK', 'ITAS', 'ITAP'].includes(type)) {
        type = 'VOA';
      }
      
      // Validate status
      let status = (row.status || 'ACTIVE').toUpperCase();
      if (!['ACTIVE', 'EXPIRED', 'DEPARTED'].includes(status)) {
        status = 'ACTIVE';
      }
      
      // Validate required fields
      if (!namaLengkap) {
        errors.push(`Baris ${rowNum}: Nama lengkap wajib diisi`);
        continue;
      }
      if (!noPaspor) {
        errors.push(`Baris ${rowNum}: Nomor paspor wajib diisi`);
        continue;
      }
      if (!negara) {
        errors.push(`Baris ${rowNum}: Negara asal wajib diisi`);
        continue;
      }
      if (!alamat) {
        errors.push(`Baris ${rowNum}: Alamat wajib diisi`);
        continue;
      }
      
      // Check duplicate
      if (existingPassports.has(noPaspor)) {
        duplicates.push(noPaspor);
        continue;
      }
      
      const now = new Date().toISOString();
      const data = {
        namaLengkap,
        noPaspor,
        negara,
        type,
        sponsor,
        alamat,
        domisili,
        latitude,
        longitude,
        status,
        createdAt: now,
        updatedAt: now,
        imported: true
      };
      
      await fetchFromFirebase(env, 'wna', 'POST', data);
      importedCount++;
      existingPassports.add(noPaspor);
      console.log(`✅ Imported: ${namaLengkap} (${noPaspor})`);
    }
    
    return Response.json({
      success: true,
      message: `Import selesai. ${importedCount} data berhasil diimport.`,
      data: {
        importedCount,
        duplicateCount: duplicates.length,
        errorCount: errors.length,
        errors: errors.slice(0, 20),
        duplicates: duplicates.slice(0, 20)
      }
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Import error:', error);
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ==================== USERS ====================
async function handleGetUsers(env: Env): Promise<Response> {
  try {
    const users = await fetchFromFirebase(env, 'users');
    const list = users ? Object.keys(users).map(key => {
      const { password, ...rest } = users[key];
      return { id: key, username: key, ...rest };
    }) : [];
    return Response.json({ success: true, data: list }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleCreateUser(request: Request, env: Env): Promise<Response> {
  try {
    const { username, name, email, role, password, nip, jabatan, unitKerja, noTelepon, alamat } = await request.json();
    
    const existing = await fetchFromFirebase(env, `users/${username}`);
    if (existing) {
      return Response.json({ success: false, message: 'Username sudah digunakan' }, { status: 409, headers: corsHeaders });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = {
      name, email, role, password: hashedPassword,
      nip: nip || '', jabatan: jabatan || '', unitKerja: unitKerja || '',
      noTelepon: noTelepon || '', alamat: alamat || '',
      isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    
    await fetchFromFirebase(env, `users/${username}`, 'PUT', userData);
    return Response.json({ success: true, message: 'User berhasil ditambahkan' }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleUpdateUser(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const username = url.pathname.split('/').pop();
    const { name, email, role, nip, jabatan, unitKerja, noTelepon, alamat, isActive } = await request.json();
    
    const updateData: any = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (nip !== undefined) updateData.nip = nip;
    if (jabatan !== undefined) updateData.jabatan = jabatan;
    if (unitKerja !== undefined) updateData.unitKerja = unitKerja;
    if (noTelepon !== undefined) updateData.noTelepon = noTelepon;
    if (alamat !== undefined) updateData.alamat = alamat;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    await fetchFromFirebase(env, `users/${username}`, 'PATCH', updateData);
    return Response.json({ success: true, message: 'User berhasil diperbarui' }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleDeleteUser(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const username = url.pathname.split('/').pop();
    await fetchFromFirebase(env, `users/${username}`, 'DELETE');
    return Response.json({ success: true, message: 'User berhasil dihapus' }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleToggleUserStatus(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const username = parts[2];
    const { isActive } = await request.json();
    
    await fetchFromFirebase(env, `users/${username}`, 'PATCH', { isActive, updatedAt: new Date().toISOString() });
    return Response.json({ success: true, message: `Status user ${isActive ? 'diaktifkan' : 'dinonaktifkan'}` }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ==================== ACTIVITY ====================
async function handleGetActivityLogs(env: Env): Promise<Response> {
  try {
    const logs = await fetchFromFirebase(env, 'activity_logs');
    const list = logs ? Object.keys(logs).map(key => ({ id: key, ...logs[key] })).reverse() : [];
    return Response.json({ success: true, data: list, total: list.length }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: true, data: [], total: 0 }, { headers: corsHeaders });
  }
}

async function handleGetNotifications(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    const notifications = await fetchFromFirebase(env, `user_notifications/${user.username}`);
    const list = notifications ? Object.keys(notifications).map(key => ({ id: key, ...notifications[key] })).reverse() : [];
    return Response.json({ success: true, data: list, total: list.length }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: true, data: [], total: 0 }, { headers: corsHeaders });
  }
}

async function handleMarkNotificationRead(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const id = parts[3];
    await fetchFromFirebase(env, `user_notifications/${user.username}/${id}`, 'PATCH', { read: true, readAt: new Date().toISOString() });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleGetUnreadCount(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    const notifications = await fetchFromFirebase(env, `user_notifications/${user.username}`);
    let unreadCount = 0;
    if (notifications) {
      unreadCount = Object.values(notifications).filter((n: any) => !n.read).length;
    }
    return Response.json({ success: true, unreadCount }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: true, unreadCount: 0 }, { headers: corsHeaders });
  }
}

// ==================== REPORTS ====================
async function handleExportExcel(env: Env): Promise<Response> {
  try {
    const data = await fetchFromFirebase(env, 'wna');
    const list = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    const headers = ['ID', 'Nama Lengkap', 'No Paspor', 'Negara', 'Tipe Izin', 'Sponsor', 'Alamat', 'Domisili', 'Status'];
    const rows = [headers];
    for (const item of list) {
      rows.push([item.id, item.namaLengkap || '', item.noPaspor || '', item.negara || '', item.type || '', item.sponsor || '', item.alamat || '', item.domisili || '', item.status || 'ACTIVE']);
    }
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    return new Response("\uFEFF" + csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=laporan_wna.csv` }
    });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ==================== REGIONS ====================
async function handleGetRegions(env: Env): Promise<Response> {
  try {
    const regions = await fetchFromFirebase(env, 'regions');
    const list = regions ? Object.keys(regions).map(key => ({ id: key, ...regions[key] })) : [];
    return Response.json({ success: true, data: list }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ==================== MAIN WORKER ====================
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health
    if (path === '/api/health' && method === 'GET') {
      return Response.json({ success: true, message: 'Server running' }, { headers: corsHeaders });
    }

    // Auth
    if (path === '/api/auth/login' && method === 'POST') return handleLogin(request, env);
    if (path === '/api/auth/verify' && method === 'GET') return handleVerify(request, env);

    // Profile
    if (path === '/api/profile/me' && method === 'GET') return handleGetProfile(request, env);
    if (path === '/api/profile/me' && method === 'PUT') return handleUpdateProfile(request, env);
    if (path === '/api/profile/me/password' && method === 'PUT') return handleChangePassword(request, env);
    if (path === '/api/profile/me/photo' && method === 'POST') return handleUploadPhoto(request, env);

    // WNA
    if (path === '/api/wna' && method === 'GET') return handleGetWNA(request, env);
    if (path === '/api/wna/stats/dashboard' && method === 'GET') return handleDashboardStats(env);
    if (path === '/api/wna' && method === 'POST') return handleCreateWNA(request, env);
    if (path.match(/^\/api\/wna\/[^/]+$/) && method === 'DELETE') return handleDeleteWNA(request, env);
    if (path === '/api/wna/export/all' && method === 'GET') return handleExportAllWNA(env);
    if (path === '/api/wna/import/template' && method === 'GET') return handleDownloadTemplate();
    if (path === '/api/wna/import' && method === 'POST') return handleImportWNA(request, env);

    // Users
    if (path === '/api/users' && method === 'GET') return handleGetUsers(env);
    if (path === '/api/users' && method === 'POST') return handleCreateUser(request, env);
    if (path.match(/^\/api\/users\/[^/]+$/) && method === 'PUT') return handleUpdateUser(request, env);
    if (path.match(/^\/api\/users\/[^/]+$/) && method === 'DELETE') return handleDeleteUser(request, env);
    if (path.match(/^\/api\/users\/[^/]+\/status$/) && method === 'PUT') return handleToggleUserStatus(request, env);

    // Activity
    if (path === '/api/activity/logs' && method === 'GET') return handleGetActivityLogs(env);
    if (path === '/api/activity/notifications' && method === 'GET') return handleGetNotifications(request, env);
    if (path.match(/^\/api\/activity\/notifications\/[^/]+\/read$/) && method === 'PUT') return handleMarkNotificationRead(request, env);
    if (path === '/api/activity/notifications/unread/count' && method === 'GET') return handleGetUnreadCount(request, env);

    // Reports
    if (path === '/api/reports/export/excel' && method === 'GET') return handleExportExcel(env);

    // Regions
    if (path === '/api/regions' && method === 'GET') return handleGetRegions(env);

    // Static assets
    return env.ASSETS.fetch(request);
  }
};