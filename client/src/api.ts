// api.ts - UPDATE dengan dynamic API URL untuk Vercel

// Deteksi environment untuk menentukan API URL
const getApiBaseUrl = () => {
  // Deteksi apakah sedang di Vercel (production)
  const isVercel = window.location.hostname.includes('vercel.app');
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  console.log('🌐 Environment detection:', {
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    isVercel,
    isLocalhost
  });
  
  if (isVercel) {
    // Di Vercel, gunakan relative path (otomatis menggunakan HTTPS)
    // Pastikan backend sudah di-deploy di Vercel juga atau menggunakan API routes
    return '/api';
  }
  
  if (isLocalhost) {
    // Local development dengan backend Express di port 5000
    return 'http://localhost:5000/api';
  }
  
  // Fallback untuk environment lain (misal preview deployment)
  // Gunakan hostname yang sama dengan frontend
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:5000/api`;
};

const API_BASE = getApiBaseUrl();

console.log('🔧 API Base URL:', API_BASE);
console.log('📍 Current origin:', window.location.origin);
console.log('📍 Current hostname:', window.location.hostname);
console.log('📍 Current protocol:', window.location.protocol);

class APIService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
    console.log('✅ Token saved');
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
    console.log('🗑️ Token cleared');
  }

  private buildUrl(endpoint: string): string {
    // Jika API_BASE sudah merupakan relative path (dimulai dengan '/')
    if (API_BASE.startsWith('/')) {
      return `${window.location.origin}${API_BASE}${endpoint}`;
    }
    // Jika absolute URL
    return `${API_BASE}${endpoint}`;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const url = this.buildUrl(endpoint);
    console.log(`📡 Request: ${options.method || 'GET'} ${url}`);
    
    try {
      const response = await fetch(url, { 
        ...options, 
        headers,
        mode: 'cors',
        credentials: 'include'
      });
      console.log(`📡 Response status: ${response.status}`);
      
      // Handle blob responses (exports)
      if (endpoint.includes('/export')) {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Export failed');
        }
        return response.blob();
      }
      
      const data = await response.json();
      console.log(`📡 Response data:`, data);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }
        const errorMessage = data.message || data.errors?.[0]?.msg || 'Request failed';
        const error = new Error(errorMessage);
        (error as any).response = data;
        throw error;
      }
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // ==================== AUTH ====================
  async login(username: string, password: string) {
    console.log(`🔐 Login attempt: ${username}`);
    console.log(`📡 Posting to: ${this.buildUrl('/auth/login')}`);
    
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    if (data.token) {
      this.setToken(data.token);
      console.log('🔐 Login successful, token saved');
    }
    return data;
  }

  async verifyToken() {
    console.log('🔐 Verifying token...');
    return this.request('/auth/verify');
  }

  async logout() {
    this.clearToken();
  }

  // ==================== PROFILE ====================
  async getProfile() {
    console.log('👤 Fetching profile...');
    return this.request('/profile/me');
  }

  async updateProfile(data: any) {
    console.log('👤 Updating profile...');
    return this.request('/profile/me', { method: 'PUT', body: JSON.stringify(data) });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    console.log('🔐 Changing password...');
    return this.request('/profile/me/password', { 
      method: 'PUT', 
      body: JSON.stringify({ currentPassword, newPassword }) 
    });
  }

  async uploadPhoto(photoBase64: string) {
    console.log('📸 Uploading photo...');
    return this.request('/profile/me/photo', { 
      method: 'POST', 
      body: JSON.stringify({ photo: photoBase64 }) 
    });
  }

  // ==================== WNA ====================
  async getWNA(filters?: { type?: string; negara?: string; status?: string }) {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.negara) params.append('negara', filters.negara);
    if (filters?.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    const endpoint = `/wna${queryString ? `?${queryString}` : ''}`;
    console.log(`📋 Fetching WNA: ${endpoint}`);
    return this.request(endpoint);
  }

  async getDashboardStats() {
    console.log('📊 Fetching dashboard stats...');
    return this.request('/wna/stats/dashboard');
  }

  async createWNA(data: any) {
    console.log('➕ Creating WNA:', data.namaLengkap);
    return this.request('/wna', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateWNA(id: string, data: any) {
    console.log(`✏️ Updating WNA: ${id}`);
    return this.request(`/wna/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteWNA(id: string) {
    console.log(`🗑️ Deleting WNA: ${id}`);
    return this.request(`/wna/${id}`, { method: 'DELETE' });
  }

  async exportAllWNA(): Promise<Blob> {
    const token = this.getToken();
    const url = this.buildUrl('/wna/export/all');
    console.log(`📥 Exporting to: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      mode: 'cors'
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(error.message || 'Export failed');
    }
    
    return response.blob();
  }

  // ==================== USERS MANAGEMENT ====================
  async getUsers() {
    console.log('👥 Fetching users...');
    return this.request('/users');
  }

  async getUser(username: string) {
    console.log(`👥 Fetching user: ${username}`);
    return this.request(`/users/${username}`);
  }

  async createUser(userData: any) {
    console.log('👥 Creating user:', userData.username);
    return this.request('/users', { method: 'POST', body: JSON.stringify(userData) });
  }

  async updateUser(username: string, userData: any) {
    console.log(`👥 Updating user: ${username}`);
    return this.request(`/users/${username}`, { method: 'PUT', body: JSON.stringify(userData) });
  }

  async deleteUser(username: string) {
    console.log(`👥 Deleting user: ${username}`);
    return this.request(`/users/${username}`, { method: 'DELETE' });
  }

  async toggleUserStatus(username: string, isActive: boolean) {
    console.log(`👥 Toggling user status: ${username} -> ${isActive}`);
    return this.request(`/users/${username}/status`, { 
      method: 'PUT', 
      body: JSON.stringify({ isActive }) 
    });
  }

  // ==================== ACTIVITY LOGS ====================
  async getActivityLogs(limit: number = 100) {
    console.log('📋 Fetching activity logs...');
    return this.request(`/activity/logs?limit=${limit}`);
  }

  // ==================== NOTIFICATIONS ====================
  async getNotifications() {
    try {
      console.log('🔔 Fetching notifications...');
      const result = await this.request('/activity/notifications');
      return result;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return { success: true, data: [], total: 0 };
    }
  }

  async markNotificationRead(id: string) {
    console.log(`🔔 Marking notification ${id} as read`);
    return this.request(`/activity/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead() {
    console.log('🔔 Marking all notifications as read');
    return this.request('/activity/notifications/read-all', { method: 'PUT' });
  }

  async getUnreadCount() {
    try {
      const result = await this.request('/activity/notifications/unread/count');
      return result;
    } catch (error) {
      return { success: true, unreadCount: 0 };
    }
  }

  // ==================== REPORTS ====================
  async exportReport(): Promise<Blob> {
    const token = this.getToken();
    const url = this.buildUrl('/reports/export/pdf');
    console.log(`📥 Exporting PDF report to: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      mode: 'cors'
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(error.message || 'Export failed');
    }
    
    return response.blob();
  }

  async exportExcel(): Promise<Blob> {
    const token = this.getToken();
    const url = this.buildUrl('/reports/export/excel');
    console.log(`📥 Exporting Excel report to: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      mode: 'cors'
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(error.message || 'Export failed');
    }
    
    return response.blob();
  }

  // ==================== HEALTH ====================
  async healthCheck() {
    console.log('🏥 Health check...');
    return this.request('/health');
  }
}

export const api = new APIService();