'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Triangle, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import type { ForumNearbyIssue, Category } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';

interface Props {
  lat: number | null;
  lng: number | null;
  category?: Category | '';
}

/**
 * Shown during the citizen report flow. As soon as we have a location and
 * (optionally) a category, fetch up to 5 nearby existing reports so the user
 * can upvote an existing one instead of filing a duplicate.
 */
export function NearbyIssuesPrompt({ lat, lng, category }: Props) {
  const [nearby, setNearby] = useState<ForumNearbyIssue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) {
      setNearby([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: '300', // 300m — close enough that they're probably the same thing
    });
    if (category) params.set('category', category);

    let cancelled = false;
    api<{ issues: ForumNearbyIssue[] }>(`/api/forum/nearby?${params.toString()}`)
      .then((res) => {
        if (!cancelled) setNearby(res.issues);
      })
      .catch(() => {
        if (!cancelled) setNearby([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, category]);

  if (loading || nearby.length === 0) return null;

  return (
    <div className="card-warm border-l-4 border-l-signal-rust">
      <div className="flex items-start gap-3 mb-4">
        <AlertCircle size={18} className="text-signal-rust mt-0.5 shrink-0" />
        <div>
          <p className="font-display text-lg mb-1">
            Already reported near here?
          </p>
          <p className="text-xs text-ink/70">
            We found {nearby.length} {nearby.length === 1 ? 'report' : 'reports'} within 300 metres. If any
            of these match your issue, please upvote instead of filing a duplicate.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {nearby.map((i) => (
          <li key={i._id}>
            <Link
              href={`/forum/issues/${i._id}`}
              target="_blank"
              className="flex items-center gap-3 p-3 bg-paper border border-ink/10 hover:border-signal-rust transition group"
            >
              <div className="flex flex-col items-center justify-center w-10 shrink-0 text-ink/60">
                <Triangle size={12} />
                <span className="font-mono text-[10px] mt-0.5">
                  {i.upvoteCount}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{i.title}</div>
                <div className="plate truncate">
                  {CATEGORY_LABELS[i.category]} ·{' '}
                  {i.reportedBy?.displayName ?? 'Citizen'}
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-ink/50 shrink-0">
                <MessageSquare size={11} />
                {i.commentCount}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
