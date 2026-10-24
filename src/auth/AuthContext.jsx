import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth as authApi } from '../api/endpoints.js';
import { getSession, setSession, clearSession } from './session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setState] = useState(getSession);
  const queryClient = useQueryClient();

  // session.js fires 'pb:session' whenever tokens change (login, refresh, logout, expiry).
  useEffect(() => {
    const onChange = (e) => setState(e.detail);
    window.addEventListener('pb:session', onChange);
    return () => window.removeEventListener('pb:session', onChange);
  }, []);

  async function login(email, password) {
    const data = await authApi.login({ email, password });
    queryClient.clear();
    return setSession(data).customer;
  }

  async function register(fullName, email, password) {
    await authApi.register({ fullName, email, password });
    return login(email, password);
  }

  async function logout() {
    const refreshToken = getSession()?.refreshToken;
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      /* the session ends locally either way */
    }
    clearSession();
    queryClient.clear();
  }

  const value = { session, user: session?.customer ?? null, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// Where each role lands after logging in.
export function homeFor(role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'PARTNER') return '/partner';
  return '/';
}
