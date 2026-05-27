'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  ArrowUpRight,
  Search,
  FileText,
  Loader2,
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import type { Issue, IssueStatus } from '@/lib/types';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/types';

/**
 * Status buckets — simpler than the 6 underlying statuses:
 *   pending     → reported, assigned        (filed, not yet being worked)
 *   ongoing     → in_progress               (actively being fixed)
 *   completed   → resolved, rejected        (closed)
 *   attention   → needs_reroute             (super-admin must re-route)
 */
type Bucket = 'pending' | 'ongoing' | 'completed' | 'attention' | 'all';

const BUCKET_STATUSES: Record<Bucket, IssueStatus[] | null> = {
  pending: ['reported', 'assigned'],
  ongoing: ['in_progress'],
  completed: ['resolved', 'rejected'],
  attention: ['needs_reroute'],
  all: null,
};

const BUCKET_LABELS: Record<Bucket, string> = {
  pending: 'Pending',
  ongoing: 'Ongoing',
  completed: 'Completed',
  attention: 'Needs attention',
  all: 'All',
};

export default function AdminIssuesPage() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <Suspense fallback={<LoadingFallback />}>
        <IssuesList />
      </Suspense>
    </RoleGuard>
  );
}

function LoadingFallback() {
  return (
    <main className="container-civic py-32 text-center">
      <Loader2 size={32} className="animate-spin mx-auto text-ink/40" />
    </main>
  );
}

function IssuesList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven filters so links from other pages (e.g. "View issues" on the
  // departments directory) deep-link directly into a filtered view.
  const initialBucket = (searchParams.get('bucket') as Bucket) || 'all';
  const initialDept = searchParams.get('dept') || 'all';

  const [bucket, setBucket] = useState<Bucket>(
    ['pending', 'ongoing', 'completed', 'attention', 'all'].includes(initialBucket)
      ? initialBucket
      : 'all'
  );
  const [deptFilter, setDeptFilter] = useState<string>(initialDept);
  const [search, setSearch] = useState('');

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<{ issues: Issue[] }>('/api/admin/stats')
      .then((res) => setIssues(res.issues ?? []))
      .catch(() => toast.error('Could not load issues'))
      .finally(() => setLoading(false));
  }, []);

  // Update URL when filters change (for shareable links + back button)
  useEffect(() => {
    const params = new URLSearchParams();
    if (bucket !== 'all') params.set('bucket', bucket);
    if (deptFilter !== 'all') params.set('dept', deptFilter);
    const qs = params.toString();
    const next = qs ? `/admin/issues?${qs}` : '/admin/issues';
    router.replace(next, { scroll: false });
  }, [bucket, deptFilter, router]);

  // Bucket counts (computed from unfiltered set so chips don't shrink to 0)
  const counts = useMemo(() => {
    const c: Record<Bucket, number> = {
      pending: 0,
      ongoing: 0,
      completed: 0,
      attention: 0,
      all: issues.length,
    };
    for (const i of issues) {
      for (const b of ['pending', 'ongoing', 'completed', 'attention'] as const) {
        if (BUCKET_STATUSES[b]?.includes(i.status)) c[b]++;
      }
    }
    return c;
  }, [issues]);

  // Build unique department list for the filter dropdown — only include depts
  // with both a real name AND a real id (skips the data-anomaly cases that
  // produced the confusing "(2)" entries in the old UI).
  const deptOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues) {
      const d = i.assignedDepartment;
      if (!d || typeof d === 'string') continue;
      if (!d._id || !d.name || !d.name.trim()) continue;
      map.set(d._id, d.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [issues]);

  const filtered = useMemo(() => {
    const allowedStatuses = BUCKET_STATUSES[bucket];
    const q = search.trim().toLowerCase();
    return issues.filter((i) => {
      if (allowedStatuses && !allowedStatuses.includes(i.status)) return false;

      if (deptFilter !== 'all') {
        if (deptFilter === 'unassigned') {
          if (i.assignedDepartment) return false;
        } else {
          const d = i.assignedDepartment;
          const id = typeof d === 'string' ? d : d?._id;
          if (id !== deptFilter) return false;
        }
      }

      if (q) {
        const reporter = reporterName(i);
        const haystack = [i.title, i.description, reporter, CATEGORY_LABELS[i.category]]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [issues, bucket, deptFilter, search]);

  return (
    <main className="container-civic py-12">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-signal-rust mb-6"
      >
        <ArrowLeft size={14} /> Back to console
      </Link>

      <div className="plate mb-2">All Issues</div>
      <h1 className="font-display text-5xl mb-3">
        {issues.length} {issues.length === 1 ? 'report' : 'reports'} on file.
      </h1>
      <p className="text-ink/70 mb-10 max-w-xl">
        Every issue across the city. Pick a bucket to focus.
      </p>

      {/* Big bucket tabs — the primary way to slice */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['attention', 'pending', 'ongoing', 'completed', 'all'] as Bucket[]).map((b) => (
          <BucketTab
            key={b}
            active={bucket === b}
            onClick={() => setBucket(b)}
            label={BUCKET_LABELS[b]}
            count={counts[b]}
            urgent={b === 'attention'}
          />
        ))}
      </div>

      {/* Secondary filters: department dropdown + search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6 pb-6 border-b border-ink/10">
        <div className="flex items-center gap-2">
          <span className="plate">Department</span>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-paper border border-ink/25 px-3 py-1.5 text-sm focus:border-signal-rust focus:outline-none min-w-[180px]"
          >
            <option value="all">All departments</option>
            <option value="unassigned">— Unassigned —</option>
            {deptOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:ml-auto relative w-full md:w-80">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, reporter, or category..."
            className="w-full bg-paper border border-ink/25 pl-9 pr-3 py-2 text-sm focus:border-signal-rust focus:outline-none"
          />
        </div>
      </div>

      {/* Results header */}
      <p className="plate mb-3">
        Showing {filtered.length} {filtered.length === 1 ? 'issue' : 'issues'}
        {bucket !== 'all' && ` in ${BUCKET_LABELS[bucket].toLowerCase()}`}
      </p>

      {/* Issues table */}
      {loading ? (
        <div className="text-center plate py-16 animate-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-ink/15">
          <FileText size={40} className="mx-auto text-ink/30 mb-4" />
          <h2 className="font-display text-2xl mb-2">Nothing here.</h2>
          <p className="text-ink/60">
            {bucket === 'attention'
              ? 'No issues currently need re-routing — nice work.'
              : 'No issues match these filters.'}
          </p>
        </div>
      ) : (
        <IssueTable issues={filtered} />
      )}
    </main>
  );
}

function BucketTab({
  active,
  onClick,
  label,
  count,
  urgent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  urgent?: boolean;
}) {
  const showUrgent = urgent && count > 0;
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-2 transition flex items-center gap-2.5 ${
        active
          ? showUrgent
            ? 'bg-signal-rust text-paper border-signal-rust'
            : 'bg-ink text-paper border-ink'
          : showUrgent
          ? 'bg-signal-rust/5 text-signal-rust border-signal-rust/40 hover:border-signal-rust'
          : 'bg-transparent text-ink/80 border-ink/20 hover:border-ink'
      }`}
    >
      <span>{label}</span>
      <span
        className={`font-mono text-xs px-1.5 py-0.5 ${
          active ? 'bg-paper/20' : 'bg-ink/5'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function IssueTable({ issues }: { issues: Issue[] }) {
  return (
    <div className="border border-ink/15">
      <table className="w-full">
        <thead className="bg-paper-soft border-b border-ink/15">
          <tr className="text-left">
            <Th>Title</Th>
            <Th>Category</Th>
            <Th>Department</Th>
            <Th>Reporter</Th>
            <Th>Status</Th>
            <Th>Reported</Th>
            <Th>{''}</Th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <IssueRow key={i._id} issue={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const router = useRouter();
  const dept =
    issue.assignedDepartment && typeof issue.assignedDepartment !== 'string'
      ? issue.assignedDepartment
      : null;

  // The super-admin uses the dept issue detail route as the canonical detail
  // page — it has the full status update + reroute panel.
  const detailHref =
    issue.status === 'needs_reroute' ? '/admin' : `/dept/issues/${issue._id}`;

  return (
    <tr
      onClick={() => router.push(detailHref)}
      className="border-b border-ink/10 hover:bg-paper-soft transition group cursor-pointer last:border-0"
    >
      <Td>
        <div className="font-display font-medium line-clamp-1 max-w-md">
          {issue.title}
        </div>
        <div className="text-xs text-ink/60 line-clamp-1 mt-0.5 max-w-md">
          {issue.description}
        </div>
      </Td>
      <Td>
        <span className="text-sm">{CATEGORY_LABELS[issue.category]}</span>
      </Td>
      <Td>
        {dept?.name ? (
          <span className="text-sm">{dept.name}</span>
        ) : issue.status === 'needs_reroute' ? (
          <span className="text-xs font-mono uppercase text-signal-rust">Unassigned</span>
        ) : (
          <span className="text-xs font-mono text-ink/40">—</span>
        )}
      </Td>
      <Td>
        <span className="text-sm text-ink/80">{reporterName(issue)}</span>
      </Td>
      <Td>
        <StatusBadge status={issue.status} />
      </Td>
      <Td>
        <span className="text-xs font-mono text-ink/50 whitespace-nowrap">
          {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
        </span>
      </Td>
      <Td>
        <ArrowUpRight
          size={16}
          className="text-ink/40 group-hover:text-signal-rust transition"
        />
      </Td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink/60 font-medium whitespace-nowrap">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function reporterName(issue: Issue): string {
  const r = issue.reportedBy;
  if (!r) return 'Anonymous';
  if (typeof r === 'string') return 'Citizen';
  if ('name' in r) return r.name;
  if ('displayName' in r) return r.displayName;
  return 'Citizen';
}
