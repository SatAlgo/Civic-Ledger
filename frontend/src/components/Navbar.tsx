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
      <div className="container-civic flex items-center justify-between h-16 gap-6">
        <Link href={homeLink} className="flex items-center gap-3 group shrink-0">
          <img 
            src="/logo.png"  // Make sure your logo is placed in the public/ folder
            alt="Civic Issue Reporter Logo" 
            className="w-11 h-11 object-contain" 
          />
          <div>
            <div className="font-display text-lg leading-none tracking-tight">Civic Ledger</div>
            <div className="plate">No. 001 — Public Registry</div>
          </div>
        </Link>

        {/* Center nav — admin roles only */}
        {user && (user.role === 'super_admin' || user.role === 'department_admin') && (
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            <NavLink href={user.role === 'super_admin' ? '/admin' : '/dept'} active={pathname === '/admin' || pathname === '/dept'}>
              {user.role === 'super_admin' ? 'Console' : 'Queue'}
            </NavLink>
            <NavLink href="/analytics" active={pathname.startsWith('/analytics')}>
              Analytics
            </NavLink>
          </nav>
        )}

        {user ? (
          <nav className="flex items-center gap-2 shrink-0">
            <Link href="/notifications" className="btn-ghost relative">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-signal-rust text-paper text-[10px] font-mono w-4 h-4 flex items-center justify-center rounded-full">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <Link
              href="/profile"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-ink/5 transition"
              title="Profile"
            >
              <UserIcon size={16} />
              <span>{user.name}</span>
              <span className="badge bg-ink text-paper ml-1">{user.role.replace('_', ' ')}</span>
            </Link>
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

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-sm font-medium relative transition ${
        active ? 'text-ink' : 'text-ink/60 hover:text-ink'
      }`}
    >
      {children}
      {active && (
        <span className="absolute -bottom-[17px] left-3 right-3 h-0.5 bg-signal-rust" />
      )}
    </Link>
  );
}
