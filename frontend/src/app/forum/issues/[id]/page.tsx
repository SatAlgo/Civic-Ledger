'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Building2,
  Loader2,
  Triangle,
  MessageSquare,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { CommentsSection } from '@/components/CommentsSection';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/hooks/useSocket';
import type { Issue } from '@/lib/types';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/types';

const IssuesMap = dynamic(() => import('@/components/IssuesMap'), { ssr: false });

export default function ForumIssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Local optimistic upvote state
  const [upvoted, setUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [voting, setVoting] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  const load = () => {
    if (!id) return;
    api<{ issue: Issue }>(`/api/issues/${id}`)
      .then((res) => {
        setIssue(res.issue);
        setUpvoted(!!res.issue.hasUpvoted);
        setUpvoteCount(res.issue.upvoteCount ?? 0);
        setCommentCount(res.issue.commentCount ?? 0);
        setLoadError(null);
      })
      .catch((err: any) => {
        const msg = err?.message ?? 'Could not load issue';
        setLoadError(msg);
        // Don't toast on initial load — the inline fallback explains it.
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Live updates for this specific issue
  useSocket((socket) => {
    socket.emit('join:issue', id);
    const onUpvoted = (data: { issueId: string; upvoteCount: number }) => {
      if (data.issueId === id) setUpvoteCount(data.upvoteCount);
    };
    socket.on('issue:upvoted', onUpvoted);
    return () => {
      socket.emit('leave:issue', id);
      socket.off('issue:upvoted', onUpvoted);
    };
  });

  const toggleUpvote = async () => {
    if (!user) {
      toast.error('Sign in to upvote');
      return;
    }
    if (voting || !id) return;
    const next = !upvoted;
    setUpvoted(next);
    setUpvoteCount((c) => c + (next ? 1 : -1));
    setVoting(true);
    try {
      const res = await api<{ upvoted: boolean; upvoteCount: number }>(
        `/api/issues/${id}/upvote`,
        { method: 'POST' }
      );
      setUpvoted(res.upvoted);
      setUpvoteCount(res.upvoteCount);
    } catch (err: any) {
      setUpvoted(!next);
      setUpvoteCount((c) => c + (next ? -1 : 1));
      toast.error(err?.message ?? 'Upvote failed');
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="container-civic py-32 text-center">
          <Loader2 size={32} className="animate-spin mx-auto text-ink/40" />
        </main>
      </>
    );
  }

  if (!issue) {
    const isNotFound = !loadError || /not found/i.test(loadError);
    return (
      <>
        <Navbar />
        <main className="container-civic py-24 text-center max-w-lg">
          <h1 className="font-display text-3xl mb-3">
            {isNotFound ? 'Issue not found.' : 'Could not load this issue.'}
          </h1>
          {!isNotFound && (
            <p className="text-ink/60 mb-6">{loadError}</p>
          )}
          <Link href="/forum" className="btn-primary">
            <ArrowLeft size={16} /> Back to forum
          </Link>
        </main>
      </>
    );
  }

  const [lng, lat] = issue.location.coordinates;
  const dept =
    typeof issue.assignedDepartment === 'object' && issue.assignedDepartment
      ? issue.assignedDepartment.name
      : null;
  const reporterName =
    issue.reportedBy && typeof issue.reportedBy === 'object'
      ? 'displayName' in issue.reportedBy
        ? issue.reportedBy.displayName
        : (issue.reportedBy as any).name?.split(' ')[0] ?? 'Citizen'
      : 'Citizen';

  return (
    <>
      <Navbar />
      <main className="container-civic max-w-5xl py-12">
        <Link
          href="/forum"
          className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-signal-rust mb-8"
        >
          <ArrowLeft size={14} /> Forum
        </Link>

        <div className="mb-10 flex items-start gap-5">
          {/* Big upvote button */}
          <button
            onClick={toggleUpvote}
            disabled={voting}
            className={`flex flex-col items-center gap-1 px-3 py-3 border-2 transition shrink-0 ${
              upvoted
                ? 'border-signal-rust bg-signal-rust text-paper'
                : 'border-ink/20 hover:border-signal-rust hover:text-signal-rust'
            }`}
            aria-label={upvoted ? 'Remove upvote' : 'Upvote this report'}
          >
            <Triangle size={18} className={upvoted ? 'fill-current' : ''} />
            <span className="font-mono text-sm leading-none mt-0.5">{upvoteCount}</span>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="plate">{CATEGORY_LABELS[issue.category]}</span>
              <span className="w-1 h-1 rounded-full bg-ink/30" />
              <StatusBadge status={issue.status} />
              <span className="plate flex items-center gap-1">
                <MessageSquare size={11} /> {commentCount}
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl leading-tight">
              {issue.title}
            </h1>
            <p className="text-xs font-mono text-ink/50 mt-3">
              Reported by {reporterName} ·{' '}
              {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* Main */}
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
              <div className="plate mb-4">Status timeline</div>
              <ol className="relative border-l-2 border-ink/15 ml-2 space-y-6">
                {(issue.statusHistory ?? [])
                  .slice()
                  .reverse()
                  .map((s, i) => (
                    <li key={i} className="pl-6 relative">
                      <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-signal-rust" />
                      <div className="font-medium">
                        {STATUS_LABELS[s.status] ?? s.status}
                      </div>
                      {s.note && (
                        <p className="text-sm text-ink/70 mt-0.5">{s.note}</p>
                      )}
                      <p className="text-xs font-mono text-ink/50 mt-1">
                        {formatDistanceToNow(new Date(s.at), { addSuffix: true })}
                      </p>
                    </li>
                  ))}
              </ol>
            </section>

            <CommentsSection issueId={issue._id} onCountChange={setCommentCount} />
          </div>

          {/* Sidebar */}
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
    </>
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
