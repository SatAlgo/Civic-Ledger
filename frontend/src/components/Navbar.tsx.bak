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
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="container-civic flex items-center justify-between h-16 gap-2">
        <Link href={homeLink} className="flex items-center gap-2.5 group min-w-0 shrink">
          <div className="w-7 h-7 bg-ink relative flex-shrink-0">
            <div className="absolute inset-1 bg-signal-rust" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg leading-none tracking-tight truncate">Civic Ledger</div>
            <div className="plate hidden sm:block">No. 001 — Public Registry</div>
          </div>
        </Link>

        {user ? (
          <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Bell — only visible on tablet+; mobile users use bottom nav */}
            <Link
              href="/notifications"
              className="btn-ghost relative hidden md:inline-flex"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-signal-rust text-paper text-[10px] font-mono w-4 h-4 flex items-center justify-center rounded-full">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            {/* Name + role badge — tablet+ only */}
            <div className="hidden md:flex items-center gap-2 px-3 text-sm">
              <UserIcon size={16} />
              <span className="max-w-[140px] truncate">{user.name}</span>
              <span className="badge bg-ink text-paper">{user.role.replace('_', ' ')}</span>
            </div>
            <button
              onClick={logout}
              className="btn-ghost"
              aria-label="Log out"
            >
              <LogOut size={18} />
            </button>
          </nav>
        ) : (
          <nav className="flex items-center gap-2 shrink-0">
            <Link href="/login" className="btn-ghost text-sm">Sign in</Link>
            <Link href="/signup" className="btn-primary text-sm whitespace-nowrap">
              <span className="hidden xs:inline">Report an issue</span>
              <span className="xs:hidden">Report</span>
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
