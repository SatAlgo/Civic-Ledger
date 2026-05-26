'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Issue } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

const IssuesMap = dynamic(() => import('@/components/IssuesMap'), {
  ssr: false,
  loading: () => (
    <div className="bg-paper-soft h-full flex items-center justify-center">
      <Loader2 className="animate-spin text-ink/40" />
    </div>
  ),
});

const STATUS_COLORS: Record<string, string> = {
  reported: '#c89b3c',
  assigned: '#1e6091',
  in_progress: '#5a6b3a',
  resolved: '#2d5016',
  rejected: '#777',
  needs_reroute: '#b8442e',
};

export default function MapPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ issues: Issue[] }>('/api/issues')
      .then((res) => setIssues(res.issues ?? []))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }, []);

  const counts = issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <main className="container-civic py-12">
        <div className="plate mb-2">No. 009 / Public Map</div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="font-display text-5xl">
              {issues.length} {issues.length === 1 ? 'issue' : 'issues'}{' '}
              <span className="italic">on file.</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-mono">
            {Object.entries(STATUS_LABELS).map(([key, label]) =>
              counts[key] ? (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: STATUS_COLORS[key] }}
                  />
                  <span className="text-ink/70">
                    {label} <strong className="text-ink">{counts[key]}</strong>
                  </span>
                </div>
              ) : null
            )}
          </div>
        </div>

        <div className="h-[70vh] border-2 border-ink/15 overflow-hidden">
          {loading ? (
            <div className="bg-paper-soft h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-ink/40" />
            </div>
          ) : (
            <IssuesMap issues={issues} height="100%" />
          )}
        </div>

        <p className="mt-4 plate">Tap any pin to read the report. Colors indicate status.</p>
      </main>
    </>
  );
}
