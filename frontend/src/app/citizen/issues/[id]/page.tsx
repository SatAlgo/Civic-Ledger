'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, MapPin, Calendar, Building2, Loader2 } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { StatusBadge } from '@/components/StatusBadge';
import { CommentsSection } from '@/components/CommentsSection';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import type { Issue } from '@/lib/types';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/types';

const IssuesMap = dynamic(() => import('@/components/IssuesMap'), { ssr: false });

export default function IssueDetailPage() {
  return (
    <RoleGuard allowed={['citizen']}>
      <IssueDetail />
    </RoleGuard>
  );
}

function IssueDetail() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api<{ issue: Issue }>(`/api/issues/${id}`)
      .then((res) => setIssue(res.issue))
      .catch(() => toast.error('Could not load issue'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useSocket((socket) => {
    socket.on('issue:status', (data: { issueId: string; status: string }) => {
      if (data.issueId === id) {
        toast.info(`Status → ${data.status.replace('_', ' ')}`);
        load();
      }
    });
  });

  if (loading) {
    return (
      <main className="container-civic py-32 text-center">
        <Loader2 size={32} className="animate-spin mx-auto text-ink/40" />
      </main>
    );
  }
  if (!issue) {
    return (
      <main className="container-civic py-24 text-center">
        <h1 className="font-display text-3xl mb-4">Report not found.</h1>
        <Link href="/citizen" className="btn-primary">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
      </main>
    );
  }

  const [lng, lat] = issue.location.coordinates;
  const dept =
    typeof issue.assignedDepartment === 'object' && issue.assignedDepartment
      ? issue.assignedDepartment.name
      : null;

  return (
    <main className="container-civic max-w-5xl py-12">
      <Link
        href="/citizen"
        className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-signal-rust mb-8"
      >
        <ArrowLeft size={14} /> Your reports
      </Link>

      <div className="mb-10">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="plate">{CATEGORY_LABELS[issue.category]}</span>
          <span className="w-1 h-1 rounded-full bg-ink/30" />
          <StatusBadge status={issue.status} />
        </div>
        <h1 className="font-display text-4xl md:text-5xl leading-tight">{issue.title}</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        {/* MAIN */}
        <div className="lg:col-span-2 space-y-10">
          <section>
            <div className="plate mb-3">Description</div>
            <p className="text-lg leading-relaxed text-ink/80 whitespace-pre-wrap">
              {issue.description}
            </p>
          </section>

          {issue.photos.length > 0 && (
            <section>
              <div className="plate mb-3">Photos</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {issue.photos.map((src, i) => (
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={i}
                    className="aspect-square block bg-paper-warm overflow-hidden group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </a>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="plate mb-4">Activity timeline</div>
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
              {(!issue.statusHistory || issue.statusHistory.length === 0) && (
                <li className="pl-6 text-sm text-ink/60">No status changes yet.</li>
              )}
            </ol>
          </section>

          <CommentsSection issueId={issue._id} />
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-6 lg:sticky lg:top-24 self-start">
          <div className="card">
            <div className="plate mb-4">Details</div>
            <Detail
              icon={<Calendar size={14} />}
              label="Reported"
              value={formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
            />
            <Detail
              icon={<Building2 size={14} />}
              label="Assigned to"
              value={dept ?? 'Awaiting routing'}
            />
            <Detail
              icon={<MapPin size={14} />}
              label="Location"
              value={`${lat.toFixed(5)}, ${lng.toFixed(5)}`}
              mono
            />
          </div>

          <div className="h-64 border-2 border-ink/15">
            <IssuesMap issues={[issue]} height="100%" />
          </div>
        </aside>
      </div>
    </main>
  );
}

function Detail({
  icon,
  label,
  value,
  mono = false,
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
