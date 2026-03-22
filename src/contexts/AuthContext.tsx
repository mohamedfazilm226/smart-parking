import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { insforge, isInsForgeConfigured } from '../lib/insforge';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapProfileRoleToUi(role: string | undefined): 'customer' | 'admin' {
  return role === 'incharger' ? 'admin' : 'customer';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserFromSession = useCallback(async () => {
    if (!isInsForgeConfigured()) {
      setUser(null);
      setToken(null);
      return;
    }

    const { data, error } = await insforge.auth.getCurrentUser();
    if (error || !data?.user) {
      setUser(null);
      setToken(null);
      return;
    }

    const sessionUser = data.user;
    setToken(null);

    const { data: prof, error: profErr } = await insforge.database
      .from('profiles')
      .select('role')
      .eq('user_id', sessionUser.id)
      .maybeSingle();

    if (profErr || !prof) {
      setUser({
        id: sessionUser.id,
        email: sessionUser.email ?? '',
        role: 'customer',
      });
      return;
    }

    setUser({
      id: sessionUser.id,
      email: sessionUser.email ?? '',
      role: mapProfileRoleToUi(prof.role as string),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadUserFromSession();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUserFromSession]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    if (isInsForgeConfigured()) {
      await insforge.auth.signOut();
    }
    setToken(null);
    setUser(null);
  };

  const refreshSession = async () => {
    await loadUserFromSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        refreshSession,
        isAuthenticated: !!user,
      }}
    >
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
