import { 
  Menu, LogOut, Bell, ChevronDown, User as UserIcon, 
  Clock, CheckCircle2, Info, AlertTriangle, CheckCheck, Loader2 
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
//import { motion, AnimatePresence } from 'motion/react';

interface TopbarProps {
  onToggleSidebar: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  read: boolean;
  timestamp: string;
  userName?: string;
  userId?: string;
}

interface UserProfile {
  username: string;
  name: string;
  email: string;
  role: string;
  photo?: string;
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export default function Topbar({ onToggleSidebar }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout>();

  const getTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Operational Dashboard';
    if (path.includes('/data/voa')) return 'VOA Registry';
    if (path.includes('/data/itk')) return 'ITK Database';
    if (path.includes('/data/itas')) return 'ITAS Monitoring';
    if (path.includes('/data/itap')) return 'ITAP Archives';
    if (path === '/map') return 'Pemetaan Wilayah';
    if (path === '/profile') return 'Admin Profile';
    if (path === '/users') return 'Manajemen Pengguna';
    if (path === '/reports') return 'Laporan & Statistik';
    return 'SIPAGI System';
  };

  // Fetch profile untuk mendapatkan foto
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.getProfile();
      if (response && response.success) {
        setProfile(response.data);
        setPhotoError(false);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.getNotifications();
      if (response && response.success) {
        const notifData = response.data || [];
        setNotifications(notifData);
        const unread = notifData.filter((n: Notification) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.getUnreadCount();
      if (response && response.success) {
        setUnreadCount(response.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchNotifications();
      // Polling every 30 seconds
      pollingRef.current = setInterval(() => {
        fetchUnreadCount();
      }, 30000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [user, fetchProfile, fetchNotifications, fetchUnreadCount]);

  const markAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'error': return <AlertTriangle className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 text-emerald-500';
      case 'warning': return 'bg-amber-50 text-amber-500';
      case 'error': return 'bg-red-50 text-red-500';
      default: return 'bg-blue-50 text-blue-500';
    }
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'Baru saja';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString('id-ID');
  };

  // Get avatar display - foto profil jika ada
  const getAvatarContent = () => {
    const photo = profile?.photo;
    const name = user?.name || profile?.name || 'User';
    const initial = name.charAt(0).toUpperCase();
    
    if (photo && !photoError) {
      return (
        <img 
          src={photo} 
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setPhotoError(true)}
        />
      );
    }
    
    // Fallback ke inisial jika foto tidak ada atau error
    return (
      <div className="h-full w-full rounded-xl bg-gradient-to-br from-primary-blue to-black flex items-center justify-center text-sm font-bold text-accent-gold">
        {initial}
      </div>
    );
  };

  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 md:px-10 shrink-0 z-50">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSidebar} 
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 bg-slate-50 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden lg:block h-6 w-[2px] bg-slate-200"></div>
        <h1 className="text-sm md:text-xl font-bold text-slate-900 tracking-tight">{getTitle()}</h1>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Notification */}
        <div className="relative">
          <button 
            onClick={() => { 
              setIsNotifOpen(!isNotifOpen); 
              if (!isNotifOpen) {
                fetchNotifications();
              }
            }} 
            className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all relative ${isNotifOpen ? 'bg-primary-blue text-accent-gold shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-accent-gold text-white text-[9px] font-bold flex items-center justify-center px-1 border-2 border-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </button>

          <AnimatePresence>
            {isNotifOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }} 
                  onClick={() => setIsNotifOpen(false)} 
                  className="fixed inset-0 z-40" 
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95, y: 10 }} 
                  className="absolute right-0 mt-3 w-96 rounded-[32px] bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Notifikasi</h4>
                        <p className="text-[9px] text-slate-400 mt-0.5">Aktivitas sistem</p>
                      </div>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead} 
                          disabled={markingAll} 
                          className="text-[9px] font-bold text-primary-blue hover:text-primary-blue/70 flex items-center gap-1 disabled:opacity-50"
                        >
                          {markingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                          Tandai semua
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="max-h-[420px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-xs text-slate-400">Belum ada notifikasi</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          onClick={() => !notif.read && markAsRead(notif.id)} 
                          className={`p-4 border-b border-slate-50 hover:bg-slate-50/50 transition-all cursor-pointer group ${!notif.read ? 'bg-blue-50/30' : ''}`}
                        >
                          <div className="flex gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${getNotificationColor(notif.type)}`}>
                              {getNotificationIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[11px] font-bold text-slate-900 leading-tight group-hover:text-primary-blue transition-colors">
                                  {notif.title}
                                </p>
                                {!notif.read && <div className="h-2 w-2 rounded-full bg-primary-blue shrink-0 mt-1"></div>}
                              </div>
                              <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{notif.message}</p>
                              <div className="flex items-center gap-1.5 mt-2 text-slate-400">
                                <Clock className="h-3 w-3" />
                                <span className="text-[9px] font-medium">{formatTime(notif.timestamp)}</span>
                              </div>
                              {notif.userName && (
                                <div className="mt-1 text-[8px] text-slate-400">
                                  Oleh: {notif.userName}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

        {/* User Menu */}
        <div className="relative">
          <button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} 
            className="flex items-center gap-3 p-1.5 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200 group"
          >
            <div className="h-10 w-10 rounded-xl overflow-hidden shadow-lg group-hover:scale-105 transition-transform bg-gradient-to-br from-primary-blue to-black">
              {getAvatarContent()}
            </div>
            <div className="flex flex-col items-start hidden sm:flex">
              <span className="text-[11px] font-bold text-slate-900 uppercase tracking-tight leading-none">
                {user?.name || profile?.name || 'User'}
              </span>
              <span className="text-[9px] font-bold text-accent-gold uppercase tracking-widest mt-1.5">
                {user?.role === 'Administrator' ? 'Administrator' : 'Operator'}
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isUserMenuOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }} 
                  onClick={() => setIsUserMenuOpen(false)} 
                  className="fixed inset-0 z-40" 
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95, y: 10 }} 
                  className="absolute right-0 mt-3 w-72 rounded-[32px] bg-white border border-slate-200 shadow-2xl z-50 p-3"
                >
                  <div className="flex items-center gap-4 p-4 border-b border-slate-100">
                    {/* Avatar besar di menu dropdown */}
                    <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-primary-blue to-black">
                      {profile?.photo && !photoError ? (
                        <img 
                          src={profile.photo} 
                          alt={profile.name}
                          className="h-full w-full object-cover"
                          onError={() => setPhotoError(true)}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-accent-gold">
                          {(user?.name || profile?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">{user?.name || profile?.name}</p>
                      <p className="text-[10px] font-bold text-primary-blue mt-0.5 uppercase tracking-wider">
                        {user?.role === 'Administrator' ? 'Administrator' : 'Operator'}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-1 font-mono">{user?.username}</p>
                    </div>
                  </div>
                  <div className="py-2">
                    <button 
                      onClick={() => { navigate('/profile'); setIsUserMenuOpen(false); }} 
                      className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-primary-blue transition-all uppercase tracking-widest"
                    >
                      <UserIcon className="h-4 w-4" /> Profile Saya
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }} 
                      className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[11px] font-bold text-red-500 hover:bg-red-50 transition-all uppercase tracking-widest"
                    >
                      <LogOut className="h-4 w-4" /> Logout Sesi
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
