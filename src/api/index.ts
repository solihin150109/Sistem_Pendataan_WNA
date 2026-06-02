// src/api/index.ts - Full Express-style API untuk Cloudflare Worker

export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_DATABASE_URL: string;
  JWT_SECRET: string;
}

// ==================== HELPER FUNCTIONS ====================

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

// Hash password sederhana
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
}

// Generate JWT
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

// Verify JWT
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

// Get user from Authorization header
async function getUserFromRequest(request: Request, env: Env): Promise<any> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split(' ')[1];
  if (!token) throw new Error('No token');
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
    
    // Ambil user dari Firebase
    const users = await fetchFromFirebase(env, 'users');
    let userData = null;
    
    for (const [id, data] of Object.entries(users || {})) {
      if (id === username || (data as any).username === username) {
        userData = data;
        break;
      }
    }
    
    if (!userData) {
      return Response.json({ success: false, message: 'Username atau password salah' }, { status: 401, headers: corsHeaders });
    }
    
    const isValid = await comparePassword(password, userData.password);
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

// ==================== WNA ROUTES ====================

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
    
    const byCountry = Object.entries(negaraMap)
      .map(([name, jumlah]) => ({ name, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 10);
    
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

// ==================== IMPORT ROUTES ====================

async function handleDownloadTemplate(): Promise<Response> {
  const headers = ['namaLengkap', 'noPaspor', 'negara', 'type', 'sponsor', 'alamat', 'domisili', 'latitude', 'longitude', 'status'];
  const csvContent = headers.join(',') + '\n' +
    '"John Doe","ABC123456","United States","VOA","PT Contoh","Jl. Contoh No. 123","Kota Jambi","-1.65","103.2","ACTIVE"\n' +
    '"Jane Smith","XYZ789012","United Kingdom","ITAS","CV Lain","Jl. Test No. 456","Kota Jambi","-1.65","103.2","ACTIVE"';
  
  return new Response("\uFEFF" + csvContent, {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=template_import_wna.csv' }
  });
}

async function handleImportWNA(request: Request, env: Env): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    
    let importedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      if (values.length < 5) continue;
      
      const data = {
        namaLengkap: values[0],
        noPaspor: values[1],
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
    }
    
    return Response.json({ success: true, message: `Import selesai. ${importedCount} data berhasil diimport.`, data: { importedCount } }, { headers: corsHeaders });
  } catch (error: any) {
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

// ==================== MAIN WORKER ====================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check
    if (path === '/api/health' && method === 'GET') {
      return Response.json({ success: true, message: 'Server running', timestamp: new Date().toISOString() }, { headers: corsHeaders });
    }
    
    // Auth routes
    if (path === '/api/auth/login' && method === 'POST') {
      return handleLogin(request, env);
    }
    if (path === '/api/auth/verify' && method === 'GET') {
      return handleVerify(request, env);
    }
    
    // Profile routes
    if (path === '/api/profile/me' && method === 'GET') {
      return handleGetProfile(request, env);
    }
    if (path === '/api/profile/me' && method === 'PUT') {
      return handleUpdateProfile(request, env);
    }
    
    // WNA routes
    if (path === '/api/wna' && method === 'GET') {
      return handleGetWNA(request, env);
    }
    if (path === '/api/wna/stats/dashboard' && method === 'GET') {
      return handleDashboardStats(env);
    }
    if (path === '/api/wna' && method === 'POST') {
      return handleCreateWNA(request, env);
    }
    if (path.match(/^\/api\/wna\/[^/]+$/) && method === 'DELETE') {
      return handleDeleteWNA(request, env);
    }
    
    // Export all
    if (path === '/api/wna/export/all' && method === 'GET') {
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
    }
    
    // Import routes
    if (path === '/api/wna/import/template' && method === 'GET') {
      return handleDownloadTemplate();
    }
    if (path === '/api/wna/import' && method === 'POST') {
      return handleImportWNA(request, env);
    }
    
    // Users routes
    if (path === '/api/users' && method === 'GET') {
      return handleGetUsers(env);
    }
    
    // Activity logs
    if (path === '/api/activity/logs' && method === 'GET') {
      const logs = await fetchFromFirebase(env, 'activity_logs');
      const logList = logs ? Object.keys(logs).map(key => ({ id: key, ...logs[key] })).reverse() : [];
      return Response.json({ success: true, data: logList, total: logList.length }, { headers: corsHeaders });
    }
    
    // Notifications
    if (path === '/api/activity/notifications' && method === 'GET') {
      return Response.json({ success: true, data: [], total: 0 }, { headers: corsHeaders });
    }
    if (path === '/api/activity/notifications/unread/count' && method === 'GET') {
      return Response.json({ success: true, unreadCount: 0 }, { headers: corsHeaders });
    }
    
    // Reports
    if (path === '/api/reports/export/excel' && method === 'GET') {
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
    }
    
    // Regions
    if (path === '/api/regions' && method === 'GET') {
      const regions = await fetchFromFirebase(env, 'regions');
      const regionList = regions ? Object.keys(regions).map(key => ({ id: key, ...regions[key] })) : [];
      return Response.json({ success: true, data: regionList }, { headers: corsHeaders });
    }
    
    // Static assets (React SPA)
    return env.ASSETS.fetch(request);
  }
};