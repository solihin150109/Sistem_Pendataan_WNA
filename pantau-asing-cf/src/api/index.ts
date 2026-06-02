// src/api/index.ts - Full API untuk Cloudflare Worker

export interface Env {
  FIREBASE_DATABASE_URL: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  JWT_SECRET: string;
}

// ==================== HELPER FUNCTIONS ====================

async function fetchFromFirebase(env: Env, path: string, method: string = 'GET', body?: any): Promise<any> {
  const url = `${env.FIREBASE_DATABASE_URL}/${path}.json`;
  console.log(`📡 Firebase ${method}: ${url}`);
  
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(`📡 Firebase response:`, data);
  return data;
}

import * as bcrypt from 'bcryptjs';

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

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
    const [payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    return decodedPayload;
  } catch (e) {
    throw new Error('Invalid token');
  }
}

async function getUserFromRequest(request: Request, env: Env): Promise<any> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split(' ')[1];
  if (!token) throw new Error('No token provided');
  return await verifyToken(token, env);
}

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// ==================== AUTH ROUTES ====================

async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const { username, password } = await request.json();
    console.log(`🔐 Login attempt: ${username}`);
    
    // Ambil user dari Firebase
    const users = await fetchFromFirebase(env, 'users');
    console.log(`📋 Users from Firebase:`, users);
    
    let userData = null;
    let userId = null;
    
    for (const [id, data] of Object.entries(users || {})) {
      if (id === username || (data as any).username === username) {
        userData = data;
        userId = id;
        break;
      }
    }
    
    if (!userData) {
      console.log(`❌ User not found: ${username}`);
      return Response.json({ success: false, message: 'Username atau password salah' }, { status: 401, headers: corsHeaders });
    }
    
    console.log(`✅ User found:`, { name: userData.name, role: userData.role });
    
    const isValid = await comparePassword(password, userData.password);
    if (!isValid) {
      console.log(`❌ Invalid password for: ${username}`);
      return Response.json({ success: false, message: 'Username atau password salah' }, { status: 401, headers: corsHeaders });
    }
    
    const token = await generateToken({ username, name: userData.name, role: userData.role }, env);
    
    console.log(`✅ Login successful: ${username}`);
    
    return Response.json({
      success: true,
      token,
      user: { name: userData.name, role: userData.role, username, email: userData.email || '' }
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('❌ Login error:', error);
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

// ==================== PROFILE ROUTES ====================

async function handleGetProfile(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    const userData = await fetchFromFirebase(env, `users/${user.username}`);
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
    const isValid = await comparePassword(currentPassword, userData.password);
    
    if (!isValid) {
      return Response.json({ success: false, message: 'Password saat ini salah' }, { status: 401, headers: corsHeaders });
    }
    
    const hashedPassword = await hashPassword(newPassword);
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

// ==================== WNA ROUTES ====================

async function handleGetWNA(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const negara = url.searchParams.get('negara');
    const status = url.searchParams.get('status');
    
    const data = await fetchFromFirebase(env, 'wna');
    let list = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    
    if (type) list = list.filter(item => item.type === type);
    if (negara) list = list.filter(item => item.negara === negara);
    if (status) list = list.filter(item => item.status === status);
    
    return Response.json({ success: true, data: list, total: list.length }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleGetWNAById(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    const data = await fetchFromFirebase(env, `wna/${id}`);
    
    if (!data) {
      return Response.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404, headers: corsHeaders });
    }
    
    return Response.json({ success: true, data: { id, ...data } }, { headers: corsHeaders });
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
    
    const byCountry = Object.entries(negaraMap)
      .map(([name, jumlah]) => ({ name, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 10);
    
    return Response.json({ 
      success: true, 
      data: { total, byType: { VOA: voa, ITK: itk, ITAS: itas, ITAP: itap }, byCountry } 
    }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleCreateWNA(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const newData = {
      ...body,
      status: body.status || 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const result = await fetchFromFirebase(env, 'wna', 'POST', newData);
    return Response.json({ success: true, message: 'Data berhasil ditambahkan', id: result.name }, { status: 201, headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleUpdateWNA(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    const body = await request.json();
    
    await fetchFromFirebase(env, `wna/${id}`, 'PATCH', { ...body, updatedAt: new Date().toISOString() });
    return Response.json({ success: true, message: 'Data berhasil diupdate' }, { headers: corsHeaders });
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
      rows.push([
        item.id, item.namaLengkap || '', item.noPaspor || '', item.negara || '',
        item.type || '', item.sponsor || '', item.alamat || '', item.domisili || '',
        item.status || 'ACTIVE'
      ]);
    }
    
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const date = new Date().toISOString().split('T')[0];
    
    return new Response("\uFEFF" + csv, {
      headers: { 
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=wna_export_${date}.csv`
      }
    });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ==================== IMPORT ROUTES ====================

async function handleDownloadTemplate(): Promise<Response> {
  const headers = ['namaLengkap', 'noPaspor', 'negara', 'type', 'sponsor', 'alamat', 'domisili', 'latitude', 'longitude', 'status'];
  const csvContent = headers.join(',') + '\n' +
    '"John Doe","ABC123456","United States","VOA","PT Contoh","Jl. Contoh No. 123","Kota Jambi","-1.65","103.2","ACTIVE"\n' +
    '"Jane Smith","XYZ789012","United Kingdom","ITAS","CV Lain","Jl. Test No. 456","Kota Jambi","-1.65","103.2","ACTIVE"';
  
  return new Response("\uFEFF" + csvContent, {
    headers: { 
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=template_import_wna.csv'
    }
  });
}

async function handleImportWNA(request: Request, env: Env): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    
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
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      if (values.length < 5) {
        errors.push(`Baris ${i + 1}: Data tidak lengkap`);
        continue;
      }
      
      const paspor = values[1];
      if (existingPassports.has(paspor)) {
        duplicates.push(paspor);
        continue;
      }
      
      const data = {
        namaLengkap: values[0],
        noPaspor: paspor,
        negara: values[2],
        type: values[3].toUpperCase(),
        sponsor: values[4] || '-',
        alamat: values[5] || '',
        domisili: values[6] || 'Kota Jambi',
        latitude: parseFloat(values[7]) || null,
        longitude: parseFloat(values[8]) || null,
        status: values[9]?.toUpperCase() || 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await fetchFromFirebase(env, 'wna', 'POST', data);
      importedCount++;
      existingPassports.add(paspor);
    }
    
    return Response.json({ 
      success: true, 
      message: `Import selesai. ${importedCount} data berhasil diimport.`,
      data: { importedCount, duplicateCount: duplicates.length, errorCount: errors.length, errors: errors.slice(0, 10), duplicates: duplicates.slice(0, 10) }
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Import error:', error);
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ==================== USERS ROUTES ====================

async function handleGetUsers(env: Env): Promise<Response> {
  try {
    const users = await fetchFromFirebase(env, 'users');
    const userList = users ? Object.keys(users).map(key => {
      const { password, ...rest } = users[key];
      return { id: key, username: key, ...rest };
    }) : [];
    return Response.json({ success: true, data: userList }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

async function handleCreateUser(request: Request, env: Env): Promise<Response> {
  try {
    const { username, name, email, role, password, nip, jabatan, unitKerja, noTelepon, alamat } = await request.json();
    
    // Check if user exists
    const existing = await fetchFromFirebase(env, `users/${username}`);
    if (existing) {
      return Response.json({ success: false, message: 'Username sudah digunakan' }, { status: 409, headers: corsHeaders });
    }
    
    const hashedPassword = await hashPassword(password);
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
    const username = url.pathname.split('/')[1];
    const { isActive } = await request.json();
    
    await fetchFromFirebase(env, `users/${username}`, 'PATCH', { isActive, updatedAt: new Date().toISOString() });
    return Response.json({ success: true, message: `Status user ${isActive ? 'diaktifkan' : 'dinonaktifkan'}` }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ==================== ACTIVITY LOGS ====================

async function handleGetActivityLogs(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    const logs = await fetchFromFirebase(env, 'activity_logs');
    let logList = logs ? Object.keys(logs).map(key => ({ id: key, ...logs[key] })) : [];
    logList = logList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
    
    return Response.json({ success: true, data: logList, total: logList.length }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: true, data: [], total: 0 }, { headers: corsHeaders });
  }
}

async function handleGetNotifications(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    const notifications = await fetchFromFirebase(env, `user_notifications/${user.username}`);
    let notifList = notifications ? Object.keys(notifications).map(key => ({ id: key, ...notifications[key] })) : [];
    notifList = notifList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
    
    return Response.json({ success: true, data: notifList, total: notifList.length }, { headers: corsHeaders });
  } catch (error: any) {
    return Response.json({ success: true, data: [], total: 0 }, { headers: corsHeaders });
  }
}

async function handleMarkNotificationRead(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getUserFromRequest(request, env);
    const url = new URL(request.url);
    const id = url.pathname.split('/')[3];
    
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
    const date = new Date().toISOString().split('T')[0];
    
    return new Response("\uFEFF" + csv, {
      headers: { 
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=laporan_wna_${date}.csv`
      }
    });
  } catch (error: any) {
    return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
  }
}

// ==================== REGIONS ====================

async function handleGetRegions(env: Env): Promise<Response> {
  try {
    const regions = await fetchFromFirebase(env, 'regions');
    const regionList = regions ? Object.keys(regions).map(key => ({ id: key, ...regions[key] })) : [];
    return Response.json({ success: true, data: regionList }, { headers: corsHeaders });
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
    
    console.log(`📨 ${method} ${path}`);
    
    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check
    if (path === '/api/health' && method === 'GET') {
      return Response.json({ 
        success: true, 
        message: 'Server running on Cloudflare Workers',
        timestamp: new Date().toISOString(),
        env: {
          databaseURL: !!env.FIREBASE_DATABASE_URL,
          projectId: !!env.FIREBASE_PROJECT_ID
        }
      }, { headers: corsHeaders });
    }
    
    // ==================== AUTH ROUTES ====================
    if (path === '/api/auth/login' && method === 'POST') {
      return handleLogin(request, env);
    }
    if (path === '/api/auth/verify' && method === 'GET') {
      return handleVerify(request, env);
    }
    
    // ==================== PROFILE ROUTES ====================
    if (path === '/api/profile/me' && method === 'GET') {
      return handleGetProfile(request, env);
    }
    if (path === '/api/profile/me' && method === 'PUT') {
      return handleUpdateProfile(request, env);
    }
    if (path === '/api/profile/me/password' && method === 'PUT') {
      return handleChangePassword(request, env);
    }
    if (path === '/api/profile/me/photo' && method === 'POST') {
      return handleUploadPhoto(request, env);
    }
    
    // ==================== WNA ROUTES ====================
    if (path === '/api/wna' && method === 'GET') {
      return handleGetWNA(request, env);
    }
    if (path === '/api/wna/stats/dashboard' && method === 'GET') {
      return handleDashboardStats(env);
    }
    if (path === '/api/wna' && method === 'POST') {
      return handleCreateWNA(request, env);
    }
    if (path === '/api/wna/export/all' && method === 'GET') {
      return handleExportAllWNA(env);
    }
    if (path === '/api/wna/import/template' && method === 'GET') {
      return handleDownloadTemplate();
    }
    if (path === '/api/wna/import' && method === 'POST') {
      return handleImportWNA(request, env);
    }
    if (path.match(/^\/api\/wna\/[^/]+$/) && method === 'GET') {
      return handleGetWNAById(request, env);
    }
    if (path.match(/^\/api\/wna\/[^/]+$/) && method === 'PUT') {
      return handleUpdateWNA(request, env);
    }
    if (path.match(/^\/api\/wna\/[^/]+$/) && method === 'DELETE') {
      return handleDeleteWNA(request, env);
    }
    
    // ==================== USERS ROUTES ====================
    if (path === '/api/users' && method === 'GET') {
      return handleGetUsers(env);
    }
    if (path === '/api/users' && method === 'POST') {
      return handleCreateUser(request, env);
    }
    if (path.match(/^\/api\/users\/[^/]+\/status$/) && method === 'PUT') {
      return handleToggleUserStatus(request, env);
    }
    if (path.match(/^\/api\/users\/[^/]+$/) && method === 'PUT') {
      return handleUpdateUser(request, env);
    }
    if (path.match(/^\/api\/users\/[^/]+$/) && method === 'DELETE') {
      return handleDeleteUser(request, env);
    }
    
    // ==================== ACTIVITY ROUTES ====================
    if (path === '/api/activity/logs' && method === 'GET') {
      return handleGetActivityLogs(request, env);
    }
    if (path === '/api/activity/notifications' && method === 'GET') {
      return handleGetNotifications(request, env);
    }
    if (path.match(/^\/api\/activity\/notifications\/[^/]+\/read$/) && method === 'PUT') {
      return handleMarkNotificationRead(request, env);
    }
    if (path === '/api/activity/notifications/unread/count' && method === 'GET') {
      return handleGetUnreadCount(request, env);
    }
    
    // ==================== REPORTS ====================
    if (path === '/api/reports/export/excel' && method === 'GET') {
      return handleExportExcel(env);
    }
    
    // ==================== REGIONS ====================
    if (path === '/api/regions' && method === 'GET') {
      return handleGetRegions(env);
    }
    
    // ==================== STATIC ASSETS ====================
    return env.ASSETS.fetch(request);
  }
};