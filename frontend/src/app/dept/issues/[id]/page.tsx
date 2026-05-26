'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, MapPin, Calendar, User, Loader2, AlertTriangle } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { Issue, IssueStatus } from '@/lib/types';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/types';

const IssuesMap = dynamic(() => import('@/components/IssuesMap'), { ssr: false });

const NEXT_STATUSES: IssueStatus[] = ['assigned', 'in_progress', 'resolved', 'rejected'];

export default function DeptIssueDetail() {
  return (
    <RoleGuard allowed={['department_admin', 'super_admin']}>
      <Detail />
    </RoleGuard>
  );
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canAct = user?.role === 'department_admin';
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState('');

  const load = () => {
    api<{ issue: Issue }>(`/api/issues/${id}`)
      .then((res) => setIssue(res.issue))
      .catch(() => toast.error('Could not load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateStatus = async (status: IssueStatus) => {
    if (!issue) return;
    setUpdating(true);
    try {
      await api(`/api/dept/issues/${issue._id}/status`, {
        method: 'PATCH',
        json: { status, note: note || undefined },
      });
      setNote('');
      toast.success(`Status → ${STATUS_LABELS[status]}`);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const reroute = async () => {
    if (!issue) return;
    if (!confirm('Send this issue back to the super-admin for re-routing?')) return;
    setUpdating(true);
    try {
      await api(`/api/dept/issues/${issue._id}/reroute`, {
        method: 'POST',
        json: { note: note || undefined },
      });
      toast.success('Sent back to super-admin');
      router.push('/dept');
    } catch (e: any) {
      toast.error(e?.message ?? 'Reroute failed');
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !issue) {
    return (
      <main className="container-civic py-32 text-center">
        <Loader2 size={32} className="animate-spin mx-auto text-ink/40" />
      </main>
    );
  }

  const [lng, lat] = issue.location.coordinates;
  const reporter =
    typeof issue.reportedBy === 'object' ? issue.reportedBy.name : 'Citizen';

  return (
    <main className="container-civic max-w-6xl py-12">
      <Link
        href={canAct ? '/dept' : '/analytics'}
        className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-signal-rust mb-8"
      >
        <ArrowLeft size={14} /> {canAct ? 'Queue' : 'Analytics'}
      </Link>

      <div className="mb-10">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="plate">{CATEGORY_LABELS[issue.category]}</span>
          <span className="w-1 h-1 rounded-full bg-ink/30" />
          <StatusBadge status={issue.status} />
        </div>
        <h1 className="font-display text-4xl md:text-5xl leading-tight">{issue.title}</h1>
      </div>

      <div className="grid lg:grid-cols-5 gap-10">
        {/* MAIN */}
        <div className="lg:col-span-3 space-y-10">
          <section>
            <div className="plate mb-3">Description</div>
            <p className="text-base leading-relaxed text-ink/80 whitespace-pre-wrap">
              {issue.description}
            </p>
          </section>

          {issue.photos.length > 0 && (
            <section>
              <div className="plate mb-3">Evidence</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {issue.photos.map((src, i) => (
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={i}
                    className="aspect-square block bg-paper-warm overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </a>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="plate mb-4">Timeline</div>
            <ol className="relative border-l-2 border-ink/15 ml-2 space-y-6">
              {(issue.statusHistory ?? [])
                .slice()
                .reverse()
                .map((s, i) => (
                  <li key={i} className="pl-6 relative">
                    <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-signal-rust" />
                    <div className="font-medium">{STATUS_LABELS[s.status] ?? s.status}</div>
                    {s.note && <p className="text-sm text-ink/70 mt-0.5">{s.note}</p>}
                    <p className="text-xs font-mono text-ink/50 mt-1">
                      {formatDistanceToNow(new Date(s.at), { addSuffix: true })}
                    </p>
                  </li>
                ))}
            </ol>
          </section>
        </div>

        {/* SIDEBAR */}
        <aside className="lg:col-span-2 space-y-6 lg:sticky lg:top-24 self-start">
          <div className="card">
            <div className="plate mb-4">Reporter</div>
            <Row icon={<User size={14} />} label="Name" value={reporter} />
            <Row
              icon={<Calendar size={14} />}
              label="Reported"
              value={formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
            />
            <Row
              icon={<MapPin size={14} />}
              label="Location"
              value={`${lat.toFixed(5)}, ${lng.toFixed(5)}`}
              mono
            />
          </div>

          <div className="h-56 border-2 border-ink/15">
            <IssuesMap issues={[issue]} height="100%" />
          </div>

          {/* Action panel — only department admins of this dept can act */}
          {canAct && (
            <div className="card !p-0">
              <div className="p-5 border-b border-ink/10">
                <div className="plate text-signal-rust mb-1">Take action</div>
                <p className="text-sm text-ink/70">
                  Update status. Add an optional note for the citizen.
                </p>
              </div>
              <div className="p-5 space-y-4">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="input text-sm"
                  placeholder="Optional note (visible to citizen)"
                />

                <div className="grid grid-cols-2 gap-2">
                  {NEXT_STATUSES.filter((s) => s !== issue.status).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateStatus(s)}
                      disabled={updating}
                      className="p-3 border-2 border-ink/20 text-left text-sm transition hover:border-signal-rust hover:bg-signal-rust/5 disabled:opacity-50"
                    >
                      <span className="block font-medium">{STATUS_LABELS[s]}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={reroute}
                  disabled={updating}
                  className="w-full p-3 border-2 border-signal-rust/40 text-signal-rust hover:bg-signal-rust/5 transition flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
                >
                  <AlertTriangle size={14} /> Not our issue — re-route
                </button>
              </div>
            </div>
          )}

          {/* Read-only notice for super-admins viewing a dept's issue */}
          {!canAct && (
            <div className="card text-sm text-ink/70">
              You&apos;re viewing this as a super-admin. Status updates are made by
              the department&apos;s own admin.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-ink/10 last:border-b-0">
      <span className="text-ink/50 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink/60">{label}</p>
        <p className={`text-sm ${mono ? 'font-mono' : 'font-medium'} truncate`}>{value}</p>
      </div>
    </div>
  );
}
