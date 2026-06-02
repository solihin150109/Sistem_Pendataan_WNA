// api.ts - Full version untuk Cloudflare Workers

const getApiBaseUrl = () => {
  const isCloudflare = window.location.hostname.includes('workers.dev');
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isCloudflare) {
    return '';
  }
  
  if (isLocalhost) {
    return 'http://localhost:8787';
  }
  
  return '';
};

const API_BASE_URL = getApiBaseUrl();

class APIService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
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
  }

  private getApiUrl(endpoint: string): string {
    if (API_BASE_URL) {
      return `${API_BASE_URL}/api${endpoint}`;
    }
    return `/api${endpoint}`;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers = new Headers(options.headers);
    
    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const url = this.getApiUrl(endpoint);
    
    try {
      const response = await fetch(url, { 
        ...options, 
        headers,
        credentials: 'include'
      });
      
      if (endpoint.includes('/export')) {
        if (!response.ok) {
          throw new Error('Export failed');
        }
        return response.blob();
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
        }
        throw new Error(data.message || 'Request failed');
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  // Auth
  async login(username: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  async verifyToken() {
    return this.request('/auth/verify');
  }

  // Profile
  async getProfile() {
    return this.request('/profile/me');
  }

  async updateProfile(data: any) {
    return this.request('/profile/me', { method: 'PUT', body: JSON.stringify(data) });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/profile/me/password', { 
      method: 'PUT', 
      body: JSON.stringify({ currentPassword, newPassword }) 
    });
  }

  async uploadPhoto(photoBase64: string) {
    return this.request('/profile/me/photo', { 
      method: 'POST', 
      body: JSON.stringify({ photo: photoBase64 }) 
    });
  }

  // WNA
  async getWNA(filters?: { type?: string; negara?: string; status?: string }) {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.negara) params.append('negara', filters.negara);
    if (filters?.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    return this.request(`/wna${queryString ? `?${queryString}` : ''}`);
  }

  async getDashboardStats() {
    return this.request('/wna/stats/dashboard');
  }

  async createWNA(data: any) {
    return this.request('/wna', { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteWNA(id: string) {
    return this.request(`/wna/${id}`, { method: 'DELETE' });
  }

  async exportAllWNA(): Promise<Blob> {
    const token = this.getToken();
    const url = this.getApiUrl('/wna/export/all');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    return response.blob();
  }

  // Import
  async importWNA(file: File): Promise<any> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(this.getApiUrl('/wna/import'), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Import failed');
    return data;
  }

  async downloadTemplate(): Promise<Blob> {
    const token = this.getToken();
    const response = await fetch(this.getApiUrl('/wna/import/template'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Download failed');
    return response.blob();
  }

  // Users
  async getUsers() {
    return this.request('/users');
  }

  async createUser(userData: any) {
    return this.request('/users', { method: 'POST', body: JSON.stringify(userData) });
  }

  async updateUser(username: string, userData: any) {
    return this.request(`/users/${username}`, { method: 'PUT', body: JSON.stringify(userData) });
  }

  async deleteUser(username: string) {
    return this.request(`/users/${username}`, { method: 'DELETE' });
  }

  async toggleUserStatus(username: string, isActive: boolean) {
    return this.request(`/users/${username}/status`, { 
      method: 'PUT', 
      body: JSON.stringify({ isActive }) 
    });
  }

  // Activity
  async getActivityLogs(limit: number = 100) {
    return this.request(`/activity/logs?limit=${limit}`);
  }

  async getNotifications() {
    try {
      return await this.request('/activity/notifications');
    } catch {
      return { success: true, data: [], total: 0 };
    }
  }

  async markNotificationRead(id: string) {
    return this.request(`/activity/notifications/${id}/read`, { method: 'PUT' });
  }

  async getUnreadCount() {
    try {
      return await this.request('/activity/notifications/unread/count');
    } catch {
      return { success: true, unreadCount: 0 };
    }
  }

  // Reports
  async exportExcel(): Promise<Blob> {
    const token = this.getToken();
    const response = await fetch(this.getApiUrl('/reports/export/excel'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  }

  // Regions
  async getRegions() {
    return this.request('/regions');
  }

  // Health
  async healthCheck() {
    return this.request('/health');
  }
}

export const api = new APIService();