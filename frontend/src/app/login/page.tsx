'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api, setToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Navbar } from '@/components/Navbar';
import type { User } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      setToken(res.token);
      setUser(res.user);
      toast.success('Welcome back');
      const dest =
        res.user.role === 'super_admin'
          ? '/admin'
          : res.user.role === 'department_admin'
          ? '/dept'
          : '/citizen';
      router.push(dest);
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="container-civic max-w-md py-20">
        <div className="plate mb-4">No. 003 / Authentication</div>
        <h1 className="font-display text-4xl mb-2">Sign in</h1>
        <p className="text-ink/70 mb-10">To continue to your registry.</p>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="rule my-8" />

        <div className="flex flex-col gap-2 text-sm text-ink/70">
          <Link href="/signup" className="hover:text-signal-rust">
            New here? Create a citizen account →
          </Link>
          <Link href="/dept/register" className="hover:text-signal-rust">
            Register your department →
          </Link>
        </div>
      </main>
    </>
  );
}
