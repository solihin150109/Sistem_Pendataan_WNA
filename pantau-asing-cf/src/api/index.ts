
export interface Env {
  FIREBASE_API_KEY: string;
  FIREBASE_AUTH_DOMAIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_DATABASE_URL: string;
  JWT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Simple API response
    if (path === '/api/health') {
      return Response.json({ 
        success: true, 
        message: 'Server running on Cloudflare Workers',
        timestamp: new Date().toISOString()
      }, { headers: corsHeaders });
    }
    
    // Default: serve static assets
    return env.ASSETS.fetch(request);
  }
};
