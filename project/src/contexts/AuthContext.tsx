import React, { createContext, useContext, useState, useEffect } from 'react';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useLocalStorage<User | null>('current-user', null);
  const [users] = useLocalStorage<User[]>('system-users', defaultUsers);

  const login = async (username: string, password: string): Promise<boolean> => {
    // Simple authentication - in production, this would be handled by a backend
    const foundUser = users.find(u => u.username === username && u.isActive);
    
    if (foundUser && (password === 'password' || password === username)) {
      const updatedUser = { ...foundUser, lastLogin: new Date() };
      setUser(updatedUser);
      return true;
    }
    
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  const hasPermission = (action: string): boolean => {
    if (!user) return false;

    const permissions = {
      admin: ['*'], // All permissions
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