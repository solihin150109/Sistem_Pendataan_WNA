// src/api/index.ts
export interface Env {
  FIREBASE_API_KEY: string;
  FIREBASE_AUTH_DOMAIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_DATABASE_URL: string;
  JWT_SECRET: string;
}

// Helper untuk verifikasi token
async function verifyToken(token: string, env: Env): Promise<any> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error('Invalid token');
  return data.users?.[0];
}

// Get WNA list
async function getWNA(env: Env, type?: string) {
  let url = `${env.FIREBASE_DATABASE_URL}/wna.json`;
  const response = await fetch(url);
  const data = await response.json();
  
  let list = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
  if (type) list = list.filter(item => item.type === type);
  
  return list;
}

// Create WNA
async function createWNA(env: Env, data: any, userId: string) {
  const url = `${env.FIREBASE_DATABASE_URL}/wna.json`;
  const newData = {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newData)
  });
  const result = await response.json();
  return { id: result.name, ...newData };
}

// Delete WNA
async function deleteWNA(env: Env, id: string) {
  const url = `${env.FIREBASE_DATABASE_URL}/wna/${id}.json`;
  const response = await fetch(url, { method: 'DELETE' });
  return response.ok;
}

// Login
async function login(email: string, password: string, env: Env) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Login failed');
  
  const userSnapshot = await fetch(`${env.FIREBASE_DATABASE_URL}/users/${data.localId}.json`);
  const userData = await userSnapshot.json();
  
  return {
    token: data.idToken,
    user: {
      id: data.localId,
      email: data.email,
      name: userData?.name || data.email,
      role: userData?.role || 'Operator'
    }
  };
}

// Import file
async function importWNA(env: Env, file: File, userId: string) {
  const text = await file.text();
  const rows = text.split('\n').slice(1);
  
  let importedCount = 0;
  for (const row of rows) {
    if (!row.trim()) continue;
    const cols = row.split(',');
    const data = {
      namaLengkap: cols[0]?.replace(/"/g, ''),
      noPaspor: cols[1]?.replace(/"/g, ''),
      negara: cols[2]?.replace(/"/g, ''),
      type: cols[3]?.replace(/"/g, ''),
      sponsor: cols[4]?.replace(/"/g, ''),
      alamat: cols[5]?.replace(/"/g, ''),
      domisili: cols[6]?.replace(/"/g, '') || 'Kota Jambi',
      latitude: parseFloat(cols[7]) || null,
      longitude: parseFloat(cols[8]) || null,
      status: cols[9]?.replace(/"/g, '') || 'ACTIVE',
      createdAt: new Date().toISOString(),
      createdBy: userId
    };
    
    await fetch(`${env.FIREBASE_DATABASE_URL}/wna.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    importedCount++;
  }
  
  return { importedCount };
}

// MAIN WORKER
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // API Routes
      if (path === '/api/auth/login' && method === 'POST') {
        const { email, password } = await request.json();
        const result = await login(email, password, env);
        return Response.json({ success: true, ...result }, { headers: corsHeaders });
      }
      
      if (path === '/api/wna' && method === 'GET') {
        const type = url.searchParams.get('type') || undefined;
        const data = await getWNA(env, type);
        return Response.json({ success: true, data, total: data.length }, { headers: corsHeaders });
      }
      
      if (path === '/api/wna/stats/dashboard' && method === 'GET') {
        const data = await getWNA(env);
        const total = data.length;
        const byType = {
          VOA: data.filter(d => d.type === 'VOA').length,
          ITK: data.filter(d => d.type === 'ITK').length,
          ITAS: data.filter(d => d.type === 'ITAS').length,
          ITAP: data.filter(d => d.type === 'ITAP').length
        };
        return Response.json({ success: true, data: { total, byType } }, { headers: corsHeaders });
      }
      
      if (path === '/api/wna' && method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];
        const user = await verifyToken(token, env);
        const body = await request.json();
        const result = await createWNA(env, body, user.localId);
        return Response.json({ success: true, message: 'Data added', id: result.id }, { status: 201, headers: corsHeaders });
      }
      
      if (path.startsWith('/api/wna/') && method === 'DELETE') {
        const id = path.split('/').pop();
        await deleteWNA(env, id!);
        return Response.json({ success: true, message: 'Data deleted' }, { headers: corsHeaders });
      }
      
      if (path === '/api/wna/import/template' && method === 'GET') {
        const csvContent = 'namaLengkap,noPaspor,negara,type,sponsor,alamat,domisili,latitude,longitude,status\n"John Doe","ABC123","USA","VOA","PT ABC","Jl. Contoh","Kota Jambi","-1.65","103.2","ACTIVE"';
        return new Response("\uFEFF" + csvContent, {
          headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=template.csv', ...corsHeaders }
        });
      }
      
      if (path === '/api/wna/import' && method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];
        const user = await verifyToken(token, env);
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const result = await importWNA(env, file, user.localId);
        return Response.json({ success: true, data: result }, { headers: corsHeaders });
      }
      
      if (path === '/api/health') {
        return Response.json({ success: true, message: 'Server running', timestamp: new Date().toISOString() }, { headers: corsHeaders });
      }
      
      // Static assets (React SPA)
      return env.ASSETS.fetch(request);
      
    } catch (error: any) {
      return Response.json({ success: false, message: error.message }, { status: 500, headers: corsHeaders });
    }
  }
};