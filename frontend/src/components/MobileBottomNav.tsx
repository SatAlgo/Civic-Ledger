'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, MapPin, Bell, Plus, Building2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

/**
 * Bottom tab bar shown only on small screens for authenticated users.
 * Items adapt to the user's role.
 *
 * Hidden via `md:hidden`. The top Navbar takes over on tablet and up.
 *
 * NOTE: Pages should add `pb-20 md:pb-0` to their main content so the
 * bottom nav doesn't cover the last bit of scrollable content.
 */
export function MobileBottomNav() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    api<{ count: number }>('/api/notifications/unread-count')
      .then((res) => setUnread(res.count))
      .catch(() => {});
  }, [user, pathname]);

  if (!user) return null;

  // Tabs vary by role
  const tabs =
    user.role === 'citizen'
      ? [
          { href: '/citizen', icon: Home, label: 'Home' },
          { href: '/citizen/report', icon: Plus, label: 'Report', primary: true },
          { href: '/map', icon: MapPin, label: 'Map' },
          { href: '/notifications', icon: Bell, label: 'Alerts', badge: unread },
        ]
      : user.role === 'department_admin'
        ? [
            { href: '/dept', icon: Home, label: 'Queue' },
            { href: '/map', icon: MapPin, label: 'Map' },
            { href: '/notifications', icon: Bell, label: 'Alerts', badge: unread },
          ]
        : [
            { href: '/admin', icon: ShieldCheck, label: 'Admin' },
            { href: '/map', icon: MapPin, label: 'Map' },
            { href: '/notifications', icon: Bell, label: 'Alerts', badge: unread },
          ];

  const isActive = (href: string) => {
    if (href === '/citizen') return pathname === '/citizen';
    if (href === '/dept') return pathname === '/dept';
    if (href === '/admin') return pathname.startsWith('/admin');
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-paper/95 backdrop-blur-md border-t border-ink/15"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4 items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 relative ${
                'primary' in tab && tab.primary ? 'text-signal-rust' : active ? 'text-ink' : 'text-ink/55'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {'badge' in tab && tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 bg-signal-rust text-paper text-[10px] font-mono min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center leading-none">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] font-medium tracking-wide ${active ? 'opacity-100' : 'opacity-70'}`}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-signal-rust" />
              )}
            </Link>
          );
        })}
        {/* If only 3 tabs (non-citizen), fill the 4th cell with an empty placeholder */}
        {tabs.length < 4 && <div />}
      </div>
    </nav>
  );
}
