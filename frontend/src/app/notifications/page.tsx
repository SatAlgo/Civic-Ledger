'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, Inbox } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const load = () => {
    setBusy(true);
    api<{ notifications: Notification[] }>('/api/notifications')
      .then((res) => setNotifications(res.notifications ?? []))
      .catch(() => toast.error('Could not load notifications'))
      .finally(() => setBusy(false));
  };

  const markAllRead = async () => {
    try {
      await api('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <main className="container-civic py-20 text-center plate animate-pulse">
          Loading…
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="container-civic max-w-3xl py-12">
        <div className="plate mb-2">Notifications</div>
        <div className="flex items-end justify-between mb-10">
          <h1 className="font-display text-5xl">
            {notifications.filter((n) => !n.read).length} unread
          </h1>
          {notifications.some((n) => !n.read) && (
            <button onClick={markAllRead} className="btn-ghost">
              <Check size={14} /> Mark all read
            </button>
          )}
        </div>

        {busy ? (
          <p className="text-center plate py-16 animate-pulse">Loading…</p>
        ) : notifications.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-ink/15">
            <Inbox size={48} className="mx-auto text-ink/40 mb-6" />
            <h2 className="font-display text-2xl mb-2">All caught up.</h2>
            <p className="text-ink/60">No notifications yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li
                key={n._id}
                className={`card flex items-start gap-4 ${
                  n.read ? 'opacity-60' : ''
                }`}
              >
                <Bell
                  size={18}
                  className={n.read ? 'text-ink/40' : 'text-signal-rust mt-0.5'}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">{n.message}</p>
                  <p className="text-xs font-mono text-ink/50 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {n.issue && (
                  <Link
                    href={
                      user.role === 'citizen'
                        ? `/citizen/issues/${n.issue}`
                        : user.role === 'department_admin'
                        ? `/dept/issues/${n.issue}`
                        : '/admin'
                    }
                    className="text-xs font-mono text-signal-rust hover:underline"
                  >
                    Open →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
