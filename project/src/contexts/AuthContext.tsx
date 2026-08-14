import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { User } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'last-activity-at';
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'pointerdown'
];

const defaultUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@stocktracker.com',
    role: 'admin',
    firstName: 'System',
    lastName: 'Administrator',
    isActive: true,
    createdAt: new Date(),
    lastLogin: new Date()
  },
  {
    id: '2',
    username: 'manager',
    email: 'manager@stocktracker.com',
    role: 'manager',
    firstName: 'Store',
    lastName: 'Manager',
    isActive: true,
    createdAt: new Date()
  },
  {
    id: '3',
    username: 'staff',
    email: 'staff@stocktracker.com',
    role: 'staff',
    firstName: 'Store',
    lastName: 'Staff',
    isActive: true,
    createdAt: new Date()
  }
];

const readLastActivity = () => {
  const value = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(value) ? value : 0;
};

const writeLastActivity = (at: number) => {
  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
};

const clearSession = () => {
  window.localStorage.removeItem(LAST_ACTIVITY_KEY);
  window.localStorage.removeItem('current-user');
};

const isIdleExpired = () => {
  const lastActivity = readLastActivity();
  return !lastActivity || Date.now() - lastActivity >= IDLE_TIMEOUT_MS;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useLocalStorage<User | null>('current-user', null);
  const [users] = useLocalStorage<User[]>('system-users', defaultUsers);
  const timeoutRef = useRef<number | null>(null);

  const logout = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    clearSession();
    setUser(null);
  }, [setUser]);

  const login = async (username: string, password: string): Promise<boolean> => {
    const foundUser = users.find(u => u.username === username && u.isActive);

    if (foundUser && (password === 'password' || password === username)) {
      writeLastActivity(Date.now());
      setUser({ ...foundUser, lastLogin: new Date() });
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (!user) return;

    if (isIdleExpired()) {
      logout();
      return;
    }

    const scheduleLogout = () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      const remaining = Math.max(IDLE_TIMEOUT_MS - (Date.now() - readLastActivity()), 0);
      timeoutRef.current = window.setTimeout(() => {
        if (isIdleExpired()) logout();
        else scheduleLogout();
      }, remaining);
    };

    let lastWrite = 0;
    const markActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 1000) {
        scheduleLogout();
        return;
      }
      lastWrite = now;
      writeLastActivity(now);
      scheduleLogout();
    };

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (isIdleExpired()) logout();
      else markActivity();
    };

    scheduleLogout();
    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [logout, user]);

  const hasPermission = (action: string): boolean => {
    if (!user) return false;

    const permissions = {
      admin: ['*'],
      manager: [
        'view_dashboard', 'view_products', 'add_product', 'edit_product', 'delete_product',
        'view_orders', 'add_order', 'edit_order', 'view_purchase_orders', 'add_purchase_order',
        'edit_purchase_order', 'view_reports', 'view_movements', 'add_movement',
        'view_suppliers', 'add_supplier', 'edit_supplier', 'view_customers'
      ],
      staff: [
        'view_dashboard', 'view_products', 'add_product', 'edit_product',
        'view_orders', 'add_order', 'view_movements', 'add_movement'
      ],
      viewer: ['view_dashboard', 'view_products', 'view_orders', 'view_reports']
    };

    const userPermissions = permissions[user.role] || [];
    return userPermissions.includes('*') || userPermissions.includes(action);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
