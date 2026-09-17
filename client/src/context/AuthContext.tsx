import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isDev: boolean;
  isAdmin: boolean;
  isSales: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updated: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('octagram_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('octagram_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.auth.getMe();
      if (res.user) {
        setUser(res.user);
        localStorage.setItem('octagram_user', JSON.stringify(res.user));
      }
    } catch (e) {
      console.warn('Session verification failed, logging out...');
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await api.auth.login(credentials);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('octagram_token', res.token);
    localStorage.setItem('octagram_user', JSON.stringify(res.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('octagram_token');
    localStorage.removeItem('octagram_user');
  };

  const updateUser = (updated: Partial<User>) => {
    if (user) {
      const newUser = { ...user, ...updated };
      setUser(newUser);
      localStorage.setItem('octagram_user', JSON.stringify(newUser));
    }
  };

  const isDev = user?.role === 'DEV';
  const isAdmin = user?.role === 'ADMIN' || isDev;
  const isSales = user?.role === 'SALES';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isDev,
        isAdmin,
        isSales,
        login,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
