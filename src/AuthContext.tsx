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
      
      if (token) {
        try {
          const response = await api.verifyToken();
          if (response.success && response.user) {
            setUser(response.user);
            setIsAuthenticated(true);
            console.log('🔍 User authenticated:', response.user.username);
          } else {
            api.clearToken();
          }
        } catch (error) {
          console.error('🔍 Auth check error:', error);
          api.clearToken();
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);
      if (response.success && response.token) {
        api.setToken(response.token);
        setUser(response.user);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
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