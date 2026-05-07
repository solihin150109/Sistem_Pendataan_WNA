const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
      
      // Untuk export CSV, handle response blob
      if (options.method === 'GET' && endpoint.includes('/export')) {
        if (!response.ok) {
          throw new Error('Export failed');
        }
        return response.blob();
      }
      
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }
        throw new Error(data.message || 'Request failed');
      }
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async verifyToken() {
    return this.request('/auth/verify');
  }

  async logout() {
    this.clearToken();
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

  async updateWNA(id: string, data: any) {
    return this.request(`/wna/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteWNA(id: string) {
    return this.request(`/wna/${id}`, { method: 'DELETE' });
  }

  // Export - Perbaikan untuk handle blob response
  async exportAllWNA(): Promise<Blob> {
    const token = this.getToken();
    const response = await fetch(`${API_BASE}/wna/export/all`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(error.message || 'Export failed');
    }
    
    return response.blob();
  }

  // Regions
  async getRegions() {
    return this.request('/regions');
  }

  // Notifications - Perbaikan endpoint sesuai backend
  async getNotifications() {
    try {
      const result = await this.request('/activity/notifications');
      return result;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return { success: true, data: [], total: 0 };
    }
  }

  async markNotificationRead(id: string) {
    return this.request(`/activity/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead() {
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

  // Health
  async healthCheck() {
    return this.request('/health');
  }
}

export const api = new APIService();