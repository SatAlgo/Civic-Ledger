'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import type { Role } from '@/lib/types';

export function RoleGuard({
  allowed,
  children,
}: {
  allowed: Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!allowed.includes(user.role)) {
      router.replace('/');
    }
  }, [user, loading, allowed, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="plate animate-pulse-soft">Loading…</span>
      </div>
    );
  }

  if (!allowed.includes(user.role)) return null;

  return <>{children}</>;
}