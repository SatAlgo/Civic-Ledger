'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { clearToken } from '@/lib/api';
import { Bell, LogOut, User as UserIcon, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ count: number }>('/api/notifications/unread-count')
      .then((res) => setUnread(res.count))
      .catch(() => {});
  }, [user, pathname]);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  const isAdmin = user?.role === 'super_admin' || user?.role === 'department_admin';

  return (
    <>
      <header className="border-b border-ink/10 bg-paper/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container-civic flex items-center justify-between h-16 gap-6">
          {/* Logo */}
          <Link href={homeLink} className="flex items-center gap-3 group shrink-0">
            <div className="w-7 h-7 bg-ink relative">
              <div className="absolute inset-1 bg-signal-rust" />
            </div>
            <div>
              <div className="font-display text-lg leading-none tracking-tight">Civic Ledger</div>
              <div className="plate">No. 001 — Public Registry</div>
            </div>
          </Link>

          {/* Desktop center nav */}
          {user && (
            <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
              {/* <NavLink href="/citizen" active={pathname.startsWith('/citizen')}>Dashboard</NavLink> */}
              <NavLink href="/forum" active={pathname.startsWith('/forum')}>Forum</NavLink>
              <NavLink href="/map" active={pathname === '/map'}>Map</NavLink>
              {isAdmin && (
                <>
                  <NavLink
                    href={user.role === 'super_admin' ? '/admin' : '/dept'}
                    active={pathname === '/admin' || pathname === '/dept'}
                  >
                    {user.role === 'super_admin' ? 'Console' : 'Queue'}
                  </NavLink>
                  <NavLink href="/analytics" active={pathname.startsWith('/analytics')}>
                    Analytics
                  </NavLink>
                </>
              )}
            </nav>
          )}

          {/* Desktop right actions */}
          {user ? (
            <nav className="hidden md:flex items-center gap-2 shrink-0">
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
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-ink/5 transition"
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
            <nav className="hidden md:flex items-center gap-2">
              <Link href="/forum" className="btn-ghost">Forum</Link>
              <Link href="/login" className="btn-ghost">Sign in</Link>
              <Link href="/signup" className="btn-primary">Report an issue</Link>
            </nav>
          )}

          {/* Mobile right: notifications + hamburger */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            {user && (
              <Link href="/notifications" className="btn-ghost relative">
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-signal-rust text-paper text-[10px] font-mono w-4 h-4 flex items-center justify-center rounded-full">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
            )}
            <button
              className="btn-ghost"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 z-30 bg-paper border-b border-ink/10 shadow-lg">
          <nav className="container-civic py-4 flex flex-col gap-1">
            {user ? (
              <>
                {/* User identity */}
                <div className="flex items-center gap-2 px-3 py-2 mb-2 border-b border-ink/10">
                  <UserIcon size={16} className="text-ink/60" />
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="badge bg-ink text-paper ml-auto">{user.role.replace('_', ' ')}</span>
                </div>

                <MobileNavLink href="/citizen" active={pathname.startsWith('/citizen')}>Dashboard</MobileNavLink>
                <MobileNavLink href="/forum" active={pathname.startsWith('/forum')}>Forum</MobileNavLink>
                <MobileNavLink href="/map" active={pathname === '/map'}>Map</MobileNavLink>

                {isAdmin && (
                  <>
                    <MobileNavLink
                      href={user.role === 'super_admin' ? '/admin' : '/dept'}
                      active={pathname === '/admin' || pathname === '/dept'}
                    >
                      {user.role === 'super_admin' ? 'Console' : 'Queue'}
                    </MobileNavLink>
                    <MobileNavLink href="/analytics" active={pathname.startsWith('/analytics')}>
                      Analytics
                    </MobileNavLink>
                  </>
                )}

                <MobileNavLink href="/profile" active={pathname === '/profile'}>Profile</MobileNavLink>

                <div className="mt-2 pt-2 border-t border-ink/10">
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-ink/70 hover:text-ink hover:bg-ink/5 transition rounded"
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </div>
              </>
            ) : (
              <>
                <MobileNavLink href="/forum" active={pathname.startsWith('/forum')}>Forum</MobileNavLink>
                <MobileNavLink href="/login" active={pathname === '/login'}>Sign in</MobileNavLink>
                <div className="mt-2 px-3">
                  <Link href="/signup" className="btn-primary w-full text-center block">
                    Report an issue
                  </Link>
                </div>
              </>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
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

function MobileNavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded transition ${
        active
          ? 'text-ink bg-ink/5 border-l-2 border-signal-rust pl-[10px]'
          : 'text-ink/70 hover:text-ink hover:bg-ink/5'
      }`}
    >
      {children}
    </Link>
  );
}