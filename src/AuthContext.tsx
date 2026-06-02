import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { api } from './api';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  user: { name: string; role: string; username: string; email?: string } | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ name: string; role: string; username: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔍 Checking authentication...');
      const token = api.getToken();
      console.log('🔍 Token exists:', !!token);
      
      if (token) {
        try {
          const response = await api.verifyToken();
          console.log('🔍 Verify response:', response);
          if (response.success && response.user) {
            setUser(response.user);
            setIsAuthenticated(true);
            console.log('🔍 User authenticated:', response.user.username, 'Role:', response.user.role);
          } else {
            console.log('🔍 Token invalid, clearing...');
            api.clearToken();
          }
        } catch (error) {
          console.error('🔍 Auth check error:', error);
          api.clearToken();
        }
      }
      setLoading(false);
      console.log('🔍 Auth loading complete, authenticated:', isAuthenticated);
    };
    
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    console.log('🔐 Login function called with:', username);
    try {
      const response = await api.login(username, password);
      console.log('🔐 Login response:', response);
      if (response.success) {
        setUser(response.user);
        setIsAuthenticated(true);
        console.log('🔐 Login successful for:', response.user.username, 'Role:', response.user.role);
        return true;
      }
      console.log('🔐 Login failed:', response.message);
      return false;
    } catch (error) {
      console.error('🔐 Login error:', error);
      return false;
    }
  };

  const logout = () => {
    console.log('🚪 Logging out...');
    api.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  const isAdmin = user?.role === 'Administrator';

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
