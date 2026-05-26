'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { CATEGORY_LABELS, type Category } from '@/lib/types';
import { CheckCircle2 } from 'lucide-react';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export default function DeptRegisterPage() {
  const [form, setForm] = useState({
    deptName: '',
    deptCode: '',
    description: '',
    adminName: '',
    adminEmail: '',
    password: '',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleCategory = (c: Category) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (categories.length === 0) {
      toast.error('Pick at least one category your department handles');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/department/register', {
        method: 'POST',
        json: { ...form, categories },
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  if (submitted) {
    return (
      <>
        <main className="container-civic max-w-lg py-24 text-center">
          <CheckCircle2 size={64} className="mx-auto text-signal-moss mb-6" />
          <div className="plate mb-2">Request received</div>
          <h1 className="font-display text-4xl mb-4">
            Your application is under review.
          </h1>
          <p className="text-ink/70 leading-relaxed mb-10">
            A super-administrator will review your department registration and approve it shortly.
            You'll be notified by email once your account is active.
          </p>
          <Link href="/" className="btn-secondary">
            Back to home
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="container-civic max-w-2xl py-16">
        <div className="plate mb-4">No. 005 / Department Registration</div>
        <h1 className="font-display text-4xl mb-2">Join the registry.</h1>
        <p className="text-ink/70 mb-10">
          Self-register your department. After review by the platform administrator, you'll receive
          citizen reports routed to you automatically.
        </p>

        <form onSubmit={submit} className="space-y-6">
          <section>
            <div className="plate mb-3">Department</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Department name</label>
                <input
                  required
                  className="input"
                  value={form.deptName}
                  onChange={update('deptName')}
                  placeholder="Public Works Department"
                />
              </div>
              <div>
                <label className="label">Short code</label>
                <input
                  required
                  className="input uppercase font-mono"
                  value={form.deptCode}
                  onChange={update('deptCode')}
                  placeholder="PWD"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Description</label>
              <textarea
                className="input min-h-[80px]"
                value={form.description}
                onChange={update('description')}
                placeholder="What does this department handle?"
              />
            </div>
          </section>

          <section>
            <div className="plate mb-3">Categories handled</div>
            <p className="text-sm text-ink/60 mb-3">Select all that apply.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className={`px-3 py-2 text-sm border transition-colors text-left ${
                    categories.includes(c)
                      ? 'bg-ink text-paper border-ink'
                      : 'border-ink/20 hover:border-ink'
                  }`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="plate mb-3">Admin account</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Your name</label>
                <input
                  required
                  className="input"
                  value={form.adminName}
                  onChange={update('adminName')}
                />
              </div>
              <div>
                <label className="label">Work email</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={form.adminEmail}
                  onChange={update('adminEmail')}
                />
              </div>
            </div>
            <div className="mt-4">
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
          </section>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Submitting…' : 'Submit for approval'}
          </button>
        </form>
      </main>
    </>
  );
}
