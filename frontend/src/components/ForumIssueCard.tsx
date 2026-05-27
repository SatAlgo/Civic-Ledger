'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, MessageSquare, ArrowUp, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { Issue } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

interface Props {
  issue: Issue;
  hrefBase?: string; // default '/forum/issues'
}

export function ForumIssueCard({ issue, hrefBase = '/forum/issues' }: Props) {
  const user = useAuthStore((s) => s.user);

  // Optimistic upvote state
  const [upvoted, setUpvoted] = useState<boolean>(!!issue.hasUpvoted);
  const [upvoteCount, setUpvoteCount] = useState<number>(issue.upvoteCount ?? 0);
  const [pending, setPending] = useState(false);

  const reporterName =
    issue.reportedBy && typeof issue.reportedBy === 'object'
      ? 'displayName' in issue.reportedBy
        ? issue.reportedBy.displayName
        : (issue.reportedBy as any).name?.split(' ')[0] ?? 'Citizen'
      : 'Citizen';

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error('Sign in to upvote');
      return;
    }
    if (pending) return;

    // Optimistic flip
    const nextUpvoted = !upvoted;
    setUpvoted(nextUpvoted);
    setUpvoteCount((c) => c + (nextUpvoted ? 1 : -1));
    setPending(true);

    try {
      const res = await api<{ upvoted: boolean; upvoteCount: number }>(
        `/api/issues/${issue._id}/upvote`,
        { method: 'POST' }
      );
      setUpvoted(res.upvoted);
      setUpvoteCount(res.upvoteCount);
    } catch (err: any) {
      // Roll back
      setUpvoted(upvoted);
      setUpvoteCount((c) => c + (nextUpvoted ? -1 : 1));
      toast.error(err?.message ?? 'Could not register upvote');
    } finally {
      setPending(false);
    }
  };

  return (
    <Link
      href={`${hrefBase}/${issue._id}`}
      className="card group hover:bg-paper-warm/40 transition-colors block"
    >
      {/* Mobile-only full-width image at top */}
      {issue.photos && issue.photos.length > 0 && (
        <div className="relative w-full h-40 sm:hidden mb-3 overflow-hidden border border-ink/15 bg-paper-warm -mx-4 -mt-4 w-[calc(100%+2rem)]">
          <img
            src={issue.photos[0]}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {issue.photos.length > 1 && (
            <span className="absolute bottom-1 right-1 bg-ink/80 text-paper text-[10px] font-mono px-1.5 py-0.5">
              +{issue.photos.length - 1}
            </span>
          )}
        </div>
      )}
      <div className="flex items-start gap-4">
        {/* Upvote column */}
        <button
          onClick={toggle}
          disabled={pending}
          className={`flex flex-row items-center gap-1 px-2 py-1.5 border transition shrink-0 ${
            upvoted
              ? 'border-signal-rust bg-signal-rust text-paper'
              : 'border-ink/20 hover:border-signal-rust hover:text-signal-rust'
          }`}
          aria-label={upvoted ? 'Remove upvote' : 'Upvote'}
        >
          <ArrowUp
            size={14}
            className={upvoted ? 'fill-current' : ''}
          />
          <span className="font-mono text-xs leading-none">{upvoteCount}</span>
        </button>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
            <span className="plate">{CATEGORY_LABELS[issue.category]}</span>
            <span className="w-1 h-1 rounded-full bg-ink/30" />
            <StatusBadge status={issue.status} />
          </div>

          <h3 className="font-display text-xl leading-snug mb-1 group-hover:text-signal-rust transition-colors">
            {issue.title}
          </h3>
          <p className="text-sm text-ink/70 line-clamp-2 mb-3">
            {issue.description}
          </p>

          <div className="flex items-center gap-4 text-xs font-mono text-ink/55 sm:ml-0 -ml-10">
            <span>by {reporterName}</span>
            <span>
              {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
            </span>
            <span className="flex items-center gap-1.5">
              <MessageSquare size={12} />
              {issue.commentCount ?? 0}
            </span>
          </div>
        </div>

        {issue.photos && issue.photos.length > 0 && (
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 overflow-hidden border border-ink/15 bg-paper-warm hidden sm:block">
            <img
              src={issue.photos[0]}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {issue.photos.length > 1 && (
              <span className="absolute bottom-1 right-1 bg-ink/80 text-paper text-[10px] font-mono px-1.5 py-0.5">
                +{issue.photos.length - 1}
              </span>
            )}
          </div>
        )}

        {/* Affordance */}
        <ArrowUpRight
          size={16}
          className="text-ink/30 group-hover:text-signal-rust group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition shrink-0"
        />
      </div>
    </Link>
  );
}
