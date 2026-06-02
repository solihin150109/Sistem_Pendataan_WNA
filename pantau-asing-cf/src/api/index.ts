export interface Env {
  JWT_SECRET?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    console.log(`📨 ${method} ${path}`);

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === '/api/health' && method === 'GET') {
      return Response.json({
        success: true,
        message: 'Server running',
        timestamp: new Date().toISOString()
      }, { headers: corsHeaders });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      try {
        const text = await request.text();
        console.log('Raw body:', text);
        
        const body = JSON.parse(text);
        console.log('Parsed body:', body);

        const { username, password } = body;

        if (username === 'admin' && password === 'admin123') {
          console.log('✅ Login success');
          return Response.json({
            success: true,
            token: 'mock-token-12345',
            user: { name: 'Administrator', role: 'Administrator', username: 'admin', email: '' }
          }, { headers: corsHeaders });
        }

        return Response.json({
          success: false,
          message: 'Username atau password salah'
        }, { status: 401, headers: corsHeaders });
      } catch (error: any) {
        console.error('Login error:', error);
        return Response.json({
          success: false,
          message: error.message
        }, { status: 500, headers: corsHeaders });
      }
    }

    if (path === '/api/auth/verify' && method === 'GET') {
      return Response.json({
        success: true,
        user: { username: 'admin', name: 'Administrator', role: 'Administrator' }
      }, { headers: corsHeaders });
    }

    return env.ASSETS.fetch(request);
  }
};