import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '@/lib/query-client';
import { queryClient } from '@/lib/query-client';

interface User {
  id: number;
  email: string;
  name: string;
  banned: boolean;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, name: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem('tt_token'),
          AsyncStorage.getItem('tt_user'),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function signIn(email: string, password: string) {
    const data = await apiRequest<{ user: User; token: string }>(
      '/api/auth/signin',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    await Promise.all([
      AsyncStorage.setItem('tt_token', data.token),
      AsyncStorage.setItem('tt_user', JSON.stringify(data.user)),
    ]);
    setToken(data.token);
    setUser(data.user);
  }

  async function signUp(email: string, name: string, password: string) {
    const data = await apiRequest<{ user: User; token: string }>(
      '/api/auth/signup',
      { method: 'POST', body: JSON.stringify({ email, name, password }) },
    );
    await Promise.all([
      AsyncStorage.setItem('tt_token', data.token),
      AsyncStorage.setItem('tt_user', JSON.stringify(data.user)),
    ]);
    setToken(data.token);
    setUser(data.user);
  }

  async function signOut() {
    await Promise.all([
      AsyncStorage.removeItem('tt_token'),
      AsyncStorage.removeItem('tt_user'),
    ]);
    setToken(null);
    setUser(null);
    queryClient.clear();
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
