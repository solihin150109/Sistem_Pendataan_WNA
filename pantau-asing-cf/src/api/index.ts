import * as bcrypt from 'bcryptjs';

export interface Env {
  FIREBASE_DATABASE_URL: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  JWT_SECRET: string;
  GOOGLE_MAPS_API_KEY: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

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
    const [payload] = token.split('.');
    return JSON.parse(atob(payload));
  } catch (e) {
    throw new Error('Invalid token');
  }
}

async function getUserFromRequest(request: Request, env: Env): Promise<any> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.split(' ')[1];
  if (!token) throw new Error('No token');
  return await verifyToken(token, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    console.log(`📨 ${method} ${path}`);

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ==================== HEALTH ====================
    if (path === '/api/health' && method === 'GET') {
      return Response.json({ 
        success: true, 
        message: 'Server running',
        googleMapsKey: !!env.GOOGLE_MAPS_API_KEY
      }, { headers: corsHeaders });
    }

    // ==================== AUTH ====================
    if (path === '/api/auth/login' && method === 'POST') {
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

    if (path === '/api/auth/verify' && method === 'GET') {
      try {
        const user = await getUserFromRequest(request, env);
        return Response.json({ success: true, user }, { headers: corsHeaders });
      } catch (error: any) {
        return Response.json({ success: false, message: error.message }, { status: 401, headers: corsHeaders });
      }
    }

    // ==================== PROFILE ====================
    if (path === '/api/profile/me' && method === 'GET') {
      try {
        const user = await getUserFromRequest(request, env);
        const userData = await fetchFromFirebase(env, `users/${user.username}`);
        const { password, ...profile } = userData;
        return Response.json({ success: true, data: { username: user.username, ...profile } }, { headers: corsHeaders });
      } catch (error: any) {
        return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
      }
    }

    if (path === '/api/profile/me' && method === 'PUT') {
      try {
        const user = await getUserFromRequest(request, env);
        const body = await request.json();
        await fetchFromFirebase(env, `users/${user.username}`, 'PATCH', { ...body, updatedAt: new Date().toISOString() });
        return Response.json({ success: true, message: 'Profil berhasil diperbarui' }, { headers: corsHeaders });
      } catch (error: any) {
        return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
      }
    }

    if (path === '/api/profile/me/password' && method === 'PUT') {
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

    if (path === '/api/profile/me/photo' && method === 'POST') {
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
    if (path === '/api/wna' && method === 'GET') {
      try {
        const type = url.searchParams.get('type');
        const data = await fetchFromFirebase(env, 'wna');
        let list = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        if (type) list = list.filter(item => item.type === type);
        return Response.json({ success: true, data: list, total: list.length }, { headers: corsHeaders });
      } catch (error: any) {
        return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
      }
    }

    if (path === '/api/wna/stats/dashboard' && method === 'GET') {
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

    if (path === '/api/wna' && method === 'POST') {
      try {
        const body = await request.json();
        const newData = { ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        const result = await fetchFromFirebase(env, 'wna', 'POST', newData);
        return Response.json({ success: true, message: 'Data berhasil ditambahkan', id: result.name }, { status: 201, headers: corsHeaders });
      } catch (error: any) {
        return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
      }
    }

    if (path.match(/^\/api\/wna\/[^/]+$/) && method === 'DELETE') {
      try {
        const id = path.split('/').pop();
        await fetchFromFirebase(env, `wna/${id}`, 'DELETE');
        return Response.json({ success: true, message: 'Data berhasil dihapus' }, { headers: corsHeaders });
      } catch (error: any) {
        return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
      }
    }

    if (path === '/api/wna/export/all' && method === 'GET') {
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

    if (path === '/api/wna/import/template' && method === 'GET') {
      const headers = ['namaLengkap', 'noPaspor', 'negara', 'type', 'sponsor', 'alamat', 'domisili', 'latitude', 'longitude', 'status'];
      const csv = headers.join(',') + '\n' + '"John Doe","ABC123","USA","VOA","PT ABC","Jl. Contoh","Jakarta","-6.2","106.8","ACTIVE"';
      return new Response("\uFEFF" + csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=template.csv' }
      });
    }

    if (path === '/api/wna/import' && method === 'POST') {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
          const data = {
            namaLengkap: values[0], noPaspor: values[1], negara: values[2],
            type: values[3]?.toUpperCase() || 'VOA', sponsor: values[4] || '-',
            alamat: values[5] || '', domisili: values[6] || 'Kota Jambi',
            latitude: parseFloat(values[7]) || null, longitude: parseFloat(values[8]) || null,
            status: values[9]?.toUpperCase() || 'ACTIVE',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          };
          await fetchFromFirebase(env, 'wna', 'POST', data);
          imported++;
        }
        return Response.json({ success: true, message: `Import selesai. ${imported} data berhasil diimport.`, data: { importedCount: imported } }, { headers: corsHeaders });
      } catch (error: any) {
        return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
      }
    }

    // ==================== USERS ====================
    if (path === '/api/users' && method === 'GET') {
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

    // ==================== ACTIVITY ====================
    if (path === '/api/activity/logs' && method === 'GET') {
      try {
        const logs = await fetchFromFirebase(env, 'activity_logs');
        const list = logs ? Object.keys(logs).map(key => ({ id: key, ...logs[key] })).reverse() : [];
        return Response.json({ success: true, data: list, total: list.length }, { headers: corsHeaders });
      } catch (error: any) {
        return Response.json({ success: true, data: [], total: 0 }, { headers: corsHeaders });
      }
    }

    if (path === '/api/activity/notifications' && method === 'GET') {
      return Response.json({ success: true, data: [], total: 0 }, { headers: corsHeaders });
    }

    if (path === '/api/activity/notifications/unread/count' && method === 'GET') {
      return Response.json({ success: true, unreadCount: 0 }, { headers: corsHeaders });
    }

    // ==================== REPORTS ====================
    if (path === '/api/reports/export/excel' && method === 'GET') {
      try {
        const data = await fetchFromFirebase(env, 'wna');
        const list = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        const headers = ['ID', 'Nama Lengkap', 'No Paspor', 'Negara', 'Tipe', 'Sponsor', 'Alamat', 'Domisili', 'Status'];
        const rows = [headers];
        for (const item of list) {
          rows.push([item.id, item.namaLengkap || '', item.noPaspor || '', item.negara || '', item.type || '', item.sponsor || '', item.alamat || '', item.domisili || '', item.status || 'ACTIVE']);
        }
        const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response("\uFEFF" + csv, {
          headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=laporan.csv` }
        });
      } catch (error: any) {
        return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
      }
    }

    // ==================== REGIONS ====================
    if (path === '/api/regions' && method === 'GET') {
      try {
        const regions = await fetchFromFirebase(env, 'regions');
        const list = regions ? Object.keys(regions).map(key => ({ id: key, ...regions[key] })) : [];
        return Response.json({ success: true, data: list }, { headers: corsHeaders });
      } catch (error: any) {
        return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
      }
    }

    // ==================== GOOGLE MAPS (pass through) ====================
    if (path.startsWith('/api/maps/')) {
      const mapsPath = path.replace('/api/maps', '');
      const mapsUrl = `https://maps.googleapis.com${mapsPath}?key=${env.GOOGLE_MAPS_API_KEY}&${url.searchParams.toString()}`;
      const mapsResponse = await fetch(mapsUrl);
      return new Response(mapsResponse.body, {
        headers: { 'Content-Type': mapsResponse.headers.get('Content-Type') || 'application/json' }
      });
    }

    // ==================== STATIC ASSETS (React SPA) ====================
    // Ini harus PALING AKHIR - handle semua request yang bukan API
    return env.ASSETS.fetch(request);
  }
};