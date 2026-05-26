'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api, setToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/lib/types';

export default function SignupPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ token: string; user: User }>('/api/auth/signup', {
        method: 'POST',
        json: form,
      });
      setToken(res.token);
      setUser(res.user);
      toast.success('Account created');
      router.push('/citizen');
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <main className="container-civic max-w-md py-20">
        <div className="plate mb-4">No. 004 / New Citizen Account</div>
        <h1 className="font-display text-4xl mb-2">Get on the record.</h1>
        <p className="text-ink/70 mb-10">Free, takes thirty seconds.</p>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="label">Full name</label>
            <input required className="input" value={form.name} onChange={update('name')} />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              value={form.email}
              onChange={update('email')}
            />
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input className="input" value={form.phone} onChange={update('phone')} />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={form.password}
              onChange={update('password')}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="rule my-8" />
        <Link href="/login" className="text-sm text-ink/70 hover:text-signal-rust">
          Already registered? Sign in →
        </Link>
      </main>
    </>
  );
}
