'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { clearToken } from '@/lib/api';
import { Bell, LogOut, User as UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    api<{ count: number }>('/api/notifications/unread-count')
      .then((res) => setUnread(res.count))
      .catch(() => {});
  }, [user, pathname]);

  const logout = () => {
    clearToken();
    setUser(null);
    router.push('/');
  };

  const homeLink = !user
    ? '/'
    : user.role === 'super_admin'
    ? '/admin'
    : user.role === 'department_admin'
    ? '/dept'
    : '/citizen';

  return (
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="container-civic flex items-center justify-between h-16">
        <Link href={homeLink} className="flex items-center gap-3 group">
          <div className="w-7 h-7 bg-ink relative">
            <div className="absolute inset-1 bg-signal-rust" />
          </div>
          <div>
            <div className="font-display text-lg leading-none tracking-tight">Civic Ledger</div>
            <div className="plate">No. 001 — Public Registry</div>
          </div>
        </Link>

        {user ? (
          <nav className="flex items-center gap-2">
            <Link href="/notifications" className="btn-ghost relative">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-signal-rust text-paper text-[10px] font-mono w-4 h-4 flex items-center justify-center rounded-full">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <div className="hidden md:flex items-center gap-2 px-3 text-sm">
              <UserIcon size={16} />
              <span>{user.name}</span>
              <span className="badge bg-ink text-paper ml-1">{user.role.replace('_', ' ')}</span>
            </div>
            <button onClick={logout} className="btn-ghost" aria-label="Log out">
              <LogOut size={18} />
            </button>
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost">Sign in</Link>
            <Link href="/signup" className="btn-primary">Report an issue</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
