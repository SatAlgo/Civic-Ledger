'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Flame, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ForumIssueCard } from '@/components/ForumIssueCard';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import type { Issue } from '@/lib/types';

type Sort = 'trending' | 'new' | 'top';

interface ForumResponse {
  issues: Issue[];
  page: number;
  limit: number;
  total: number;
  sort: Sort;
}

export default function ForumPage() {
  const [sort, setSort] = useState<Sort>('trending');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Initial + sort change → reset and fetch from page 1
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    setIssues([]);
    setHasMore(true);

    api<ForumResponse>(`/api/forum?sort=${sort}&page=1&limit=20`)
      .then((res) => {
        if (cancelled) return;
        setIssues(res.issues);
        setHasMore(res.issues.length === res.limit);
      })
      .catch(() => toast.error('Could not load forum'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [sort]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await api<ForumResponse>(
        `/api/forum?sort=${sort}&page=${next}&limit=20`
      );
      setIssues((prev) => [...prev, ...res.issues]);
      setPage(next);
      setHasMore(res.issues.length === res.limit);
    } catch {
      toast.error('Could not load more');
    } finally {
      setLoadingMore(false);
    }
  }, [page, sort, hasMore, loadingMore]);

  // Live updates: keep counts current as people upvote and comment
  useSocket((socket) => {
    socket.emit('join:forum');

    const onUpvoted = (data: {
      issueId: string;
      upvoteCount: number;
    }) => {
      setIssues((prev) =>
        prev.map((i) =>
          i._id === data.issueId
            ? { ...i, upvoteCount: data.upvoteCount }
            : i
        )
      );
    };
    const onCommented = (data: {
      issueId: string;
      commentCount: number;
    }) => {
      setIssues((prev) =>
        prev.map((i) =>
          i._id === data.issueId
            ? { ...i, commentCount: data.commentCount }
            : i
        )
      );
    };

    socket.on('issue:upvoted', onUpvoted);
    socket.on('issue:commented', onCommented);

    return () => {
      socket.emit('leave:forum');
      socket.off('issue:upvoted', onUpvoted);
      socket.off('issue:commented', onCommented);
    };
  });

  return (
    <>
      <Navbar />
      <main className="container-civic max-w-4xl py-12">
        <div className="plate mb-2">No. 011 · Community Forum</div>
        <h1 className="font-display text-5xl mb-2">The city, in conversation.</h1>
        <p className="text-ink/70 mb-10 max-w-2xl">
          Every reported issue is here, open to upvote and discuss. The
          loudest issues rise to the top — that's how administrators see
          what matters most to citizens, right now.
        </p>

        {/* Sort tabs */}
        <div className="flex gap-1 mb-8 border-b border-ink/15">
          <SortTab
            active={sort === 'trending'}
            onClick={() => setSort('trending')}
            icon={<Flame size={14} />}
          >
            Trending
          </SortTab>
          <SortTab
            active={sort === 'new'}
            onClick={() => setSort('new')}
            icon={<Clock size={14} />}
          >
            Newest
          </SortTab>
          <SortTab
            active={sort === 'top'}
            onClick={() => setSort('top')}
            icon={<TrendingUp size={14} />}
          >
            Top
          </SortTab>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="text-center py-20 text-ink/40">
            <Loader2 size={28} className="animate-spin mx-auto" />
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-ink/15">
            <p className="font-display text-2xl mb-2">No reports yet.</p>
            <p className="text-ink/60 text-sm">Be the first to file one.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-4 mb-8">
              {issues.map((i) => (
                <li key={i._id}>
                  <ForumIssueCard issue={i} />
                </li>
              ))}
            </ul>

            {hasMore && (
              <div className="text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn-ghost"
                >
                  {loadingMore ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}

            {!hasMore && issues.length > 20 && (
              <p className="plate text-center mt-8">— End of feed —</p>
            )}
          </>
        )}
      </main>
    </>
  );
}

function SortTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-sm font-medium flex items-center gap-2 relative transition ${
        active ? 'text-ink' : 'text-ink/60 hover:text-ink'
      }`}
    >
      {icon}
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-signal-rust" />
      )}
    </button>
  );
}
