'use client';

import { useEffect } from 'react';
import { api, getToken, clearToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // api<{ user: any }>('/api/auth/me')
    //   .then((res) => setUser(res.user))
    //   .catch(() => setUser(null))
    //   .finally(() => setLoading(false));

    api<{ user: any }>('/api/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => {
        // /me failed — token is bad or backend is unreachable.
        // Clear both so we don't leave the app in a half-authenticated state.
        clearToken();
        setUser(null);
      })
  .finally(() => setLoading(false));
  }, [setUser, setLoading]);

  return <>{children}</>;
}
