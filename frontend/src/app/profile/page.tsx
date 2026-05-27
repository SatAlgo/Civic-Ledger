'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User as UserIcon, Mail, Phone, Shield, Building2, Loader2, KeyRound, Save } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useAuthStore } from '@/store/auth';
import { api, setToken } from '@/lib/api';
import type { User } from '@/lib/types';

interface MineStats {
  total: number;
  byStatus: Record<string, number>;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, setUser } = useAuthStore();

  // Redirect to login if not authenticated (once auth has hydrated)
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <main className="container-civic py-32 text-center">
          <Loader2 size={32} className="animate-spin mx-auto text-ink/40" />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="container-civic max-w-3xl py-12">
        <div className="plate mb-2">Your Profile</div>
        <h1 className="font-display text-5xl mb-2">
          {user.name.split(' ')[0]}.
        </h1>
        <p className="text-ink/70 mb-12">
          Manage your account and password. Signed in as{' '}
          <span className="font-mono text-ink">{user.role.replace('_', ' ')}</span>.
        </p>

        <div className="space-y-12">
          <AccountSection user={user} onUpdated={setUser} />
          <PasswordSection />
          {user.role === 'citizen' && <CitizenStats />}
          {user.role === 'department_admin' && <DeptInfo user={user} />}
        </div>
      </main>
    </>
  );
}

/* ------------------- Account (name, phone, view email) ------------------- */

function AccountSection({
  user,
  onUpdated,
}: {
  user: User;
  onUpdated: (u: User) => void;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [saving, setSaving] = useState(false);

  const dirty = name !== user.name || (phone ?? '') !== (user.phone ?? '');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await api<{ user: User }>('/api/auth/me', {
        method: 'PATCH',
        json: { name: name.trim(), phone: phone.trim() || null },
      });
      onUpdated(res.user);
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <SectionHeading num="01" title="Account" />
      <form onSubmit={save} className="card space-y-5">
        <Field icon={<UserIcon size={14} />} label="Name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={100}
            required
          />
        </Field>

        <Field icon={<Mail size={14} />} label="Email" hint="Email is the login identifier and cannot be changed.">
          <input className="input opacity-60 cursor-not-allowed" value={user.email} disabled />
        </Field>

        <Field icon={<Phone size={14} />} label="Phone">
          <input
            className="input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
            maxLength={30}
          />
        </Field>

        <div className="flex items-center justify-between pt-2 border-t border-ink/10">
          <div className="plate">
            {dirty ? 'You have unsaved changes' : 'No pending changes'}
          </div>
          <button
            type="submit"
            disabled={!dirty || saving}
            className="btn-primary"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ------------------- Change password ------------------- */

function PasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const valid =
    current.length >= 1 && next.length >= 6 && next === confirm && next !== current;

  const reasons = (): string | null => {
    if (current.length < 1) return null; // not started
    if (next.length < 6) return 'New password must be at least 6 characters';
    if (next === current) return 'New password must differ from current';
    if (next !== confirm) return 'New password and confirmation do not match';
    return null;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      const res = await api<{ ok: true; token: string }>('/api/auth/change-password', {
        method: 'POST',
        json: { currentPassword: current, newPassword: next },
      });
      // Rotate the stored token so any future check sees the fresh one
      setToken(res.token);
      toast.success('Password changed');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not change password');
    } finally {
      setSaving(false);
    }
  };

  const reason = reasons();

  return (
    <section>
      <SectionHeading num="02" title="Security" />
      <form onSubmit={save} className="card space-y-5">
        <Field icon={<KeyRound size={14} />} label="Current password">
          <input
            className="input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>

        <Field icon={<KeyRound size={14} />} label="New password" hint="At least 6 characters.">
          <input
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>

        <Field icon={<KeyRound size={14} />} label="Confirm new password">
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>

        <div className="flex items-center justify-between pt-2 border-t border-ink/10 gap-4">
          <div className={`plate ${reason ? 'text-signal-rust opacity-100' : ''}`}>
            {reason ?? 'Pick a strong, unique password.'}
          </div>
          <button
            type="submit"
            disabled={!valid || saving}
            className="btn-primary"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
            {saving ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ------------------- Citizen stats ------------------- */

function CitizenStats() {
  const [stats, setStats] = useState<MineStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<MineStats>('/api/issues/mine/stats')
      .then(setStats)
      .catch(() => setStats({ total: 0, byStatus: {} }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section>
        <SectionHeading num="03" title="Your contributions" />
        <div className="card text-center text-ink/50 py-8">
          <Loader2 size={20} className="animate-spin mx-auto" />
        </div>
      </section>
    );
  }

  if (!stats) return null;

  const open = stats.total - (stats.byStatus.resolved ?? 0) - (stats.byStatus.rejected ?? 0);

  return (
    <section>
      <SectionHeading num="03" title="Your contributions" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ink/10 border border-ink/10">
        <Tile label="Total reports" value={stats.total} />
        <Tile label="Open" value={open} />
        <Tile label="Resolved" value={stats.byStatus.resolved ?? 0} accent="moss" />
        <Tile label="In progress" value={stats.byStatus.in_progress ?? 0} accent="rust" />
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'rust' | 'moss';
}) {
  const color =
    accent === 'rust' ? 'text-signal-rust' : accent === 'moss' ? 'text-signal-moss' : '';
  return (
    <div className="bg-paper px-6 py-5">
      <div className="plate mb-1">{label}</div>
      <div className={`font-display text-3xl ${color}`}>{value}</div>
    </div>
  );
}

/* ------------------- Department info (read-only for dept admins) ------------------- */

function DeptInfo({ user }: { user: User }) {
  if (!user.department) return null;

  return (
    <section>
      <SectionHeading num="03" title="Department" />
      <div className="card">
        <div className="flex items-start gap-3 mb-3">
          <Building2 size={16} className="text-ink/50 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm">
              You're a department admin. Your queue is at{' '}
              <a href="/dept" className="font-mono text-signal-rust hover:underline">
                /dept
              </a>
              .
            </p>
            <p className="text-xs text-ink/60 leading-relaxed mt-2">
              Department details — name, code, categories handled — are managed
              by the platform super-administrator. If anything needs to change,
              please contact them.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------- Tiny presentational helpers ------------------- */

function SectionHeading({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <span className="font-mono text-sm text-signal-rust">{num}</span>
      <h2 className="font-display text-2xl">{title}</h2>
    </div>
  );
}

function Field({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <span className="text-ink/50">{icon}</span>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink/50 mt-1.5">{hint}</p>}
    </div>
  );
}
