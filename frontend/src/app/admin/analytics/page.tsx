'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { api } from '@/lib/api';
import type { Issue, IssueStatus, Category } from '@/lib/types';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/types';
import {
  colorForDepartment,
  labelForDepartment,
  UNASSIGNED_COLOR,
  UNASSIGNED_LABEL,
} from '@/lib/deptColor';

const AnalyticsMap = dynamic(() => import('@/components/AnalyticsMap'), {
  ssr: false,
  loading: () => (
    <div className="border-2 border-ink/15 h-[600px] flex items-center justify-center">
      <Loader2 className="animate-spin text-ink/40" />
    </div>
  ),
});

/**
 * Status grouping that matches the issues list page exactly, so a user moving
 * between the two pages sees consistent buckets.
 */
type StatusFilter = 'all' | 'pending' | 'ongoing' | 'completed' | 'attention';

const STATUS_FILTER_MAP: Record<StatusFilter, IssueStatus[] | null> = {
  all: null,
  pending: ['reported', 'assigned'],
  ongoing: ['in_progress'],
  completed: ['resolved', 'rejected'],
  attention: ['needs_reroute'],
};

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  pending: 'Pending',
  ongoing: 'Ongoing',
  completed: 'Completed',
  attention: 'Needs attention',
};

export default function AnalyticsPage() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <Analytics />
    </RoleGuard>
  );
}

function Analytics() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    api<{ issues: Issue[] }>('/api/admin/stats')
      .then((res) => setIssues(res.issues ?? []))
      .catch(() => toast.error('Could not load analytics'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const allowed = STATUS_FILTER_MAP[statusFilter];
    if (!allowed) return issues;
    return issues.filter((i) => allowed.includes(i.status));
  }, [issues, statusFilter]);

  const byDept = useMemo(() => groupByDept(filtered), [filtered]);
  const byCategory = useMemo(() => groupByCategory(filtered), [filtered]);
  const hotspots = useMemo(() => topHotspots(filtered, 5), [filtered]);

  return (
    <main className="container-civic py-12">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-signal-rust mb-6"
      >
        <ArrowLeft size={14} /> Back to console
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <div className="plate mb-2">Analytics</div>
          <h1 className="font-display text-5xl">
            Where the city is <span className="italic text-signal-rust">hurting</span>.
          </h1>
          <p className="text-ink/70 mt-2 max-w-2xl">
            Every issue plotted geographically. For tracking specific reports,{' '}
            <Link href="/admin/issues" className="underline hover:text-signal-rust">
              use the issues list
            </Link>{' '}
            instead.
          </p>
        </div>
      </div>

      {/* One simple filter — status only */}
      <div className="flex flex-wrap items-center gap-2 mb-8 pb-6 border-b border-ink/10">
        <span className="plate mr-2">Show</span>
        {(['all', 'pending', 'ongoing', 'completed', 'attention'] as StatusFilter[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-sm font-medium border transition ${
                statusFilter === s
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-transparent text-ink/80 border-ink/20 hover:border-ink'
              }`}
            >
              {STATUS_FILTER_LABELS[s]}
            </button>
          )
        )}
        <span className="ml-auto plate">
          {filtered.length} {filtered.length === 1 ? 'issue' : 'issues'} on map
        </span>
      </div>

      {loading ? (
        <div className="border-2 border-ink/15 h-[600px] flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-ink/40" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <AnalyticsMap
              issues={filtered}
              height="640px"
              onIssueClick={(id) => router.push(`/dept/issues/${id}`)}
            />
            {filtered.length === 0 && (
              <p className="text-center plate mt-4">No issues match this filter.</p>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <Hotspots hotspots={hotspots} totalShown={filtered.length} />

            <Breakdown
              title="By department"
              rows={byDept.map((d) => ({
                label: d.label,
                count: d.count,
                color: d.color,
              }))}
              showLegendDot
              emptyText="No assignments yet."
            />

            <Breakdown
              title="By category"
              rows={byCategory.map((c) => ({
                label: CATEGORY_LABELS[c.category as Category] ?? c.category,
                count: c.count,
              }))}
            />
          </aside>
        </div>
      )}
    </main>
  );
}

/* ---------------- helpers ---------------- */

function deptIdOf(issue: Issue): string | null {
  const d = issue.assignedDepartment;
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d._id ?? null;
}

interface DeptBucket {
  id: string | null;
  label: string;
  color: string;
  count: number;
}

/**
 * Group issues by department, skipping departments with missing names so the
 * sidebar doesn't show meaningless entries like "(2)" — they fold into the
 * unassigned bucket instead, where they at least make visual sense.
 */
function groupByDept(issues: Issue[]): DeptBucket[] {
  const map = new Map<string, DeptBucket>();
  for (const i of issues) {
    const id = deptIdOf(i);
    const dept =
      i.assignedDepartment && typeof i.assignedDepartment !== 'string'
        ? i.assignedDepartment
        : null;

    // If the dept reference is broken (no name), treat as unassigned
    const isUsable = id && dept && dept.name && dept.name.trim();
    const key = isUsable ? id : '__unassigned__';

    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        id: isUsable ? id : null,
        label: isUsable ? labelForDepartment({ name: dept!.name, code: dept!.code }) : UNASSIGNED_LABEL,
        color: isUsable ? colorForDepartment(id!) : UNASSIGNED_COLOR,
        count: 0,
      };
      map.set(key, bucket);
    }
    bucket.count++;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function groupByCategory(issues: Issue[]) {
  const map = new Map<string, number>();
  for (const i of issues) map.set(i.category, (map.get(i.category) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

const CELL_DEG = 0.01;
interface Hotspot {
  lat: number;
  lng: number;
  count: number;
  topCategory: string;
}
function topHotspots(issues: Issue[], limit: number): Hotspot[] {
  if (issues.length === 0) return [];
  const buckets = new Map<
    string,
    { sumLat: number; sumLng: number; count: number; categories: Map<string, number> }
  >();
  for (const i of issues) {
    if (!i.location?.coordinates) continue;
    const [lng, lat] = i.location.coordinates;
    const key = `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`;
    let b = buckets.get(key);
    if (!b) {
      b = { sumLat: 0, sumLng: 0, count: 0, categories: new Map() };
      buckets.set(key, b);
    }
    b.sumLat += lat;
    b.sumLng += lng;
    b.count++;
    b.categories.set(i.category, (b.categories.get(i.category) ?? 0) + 1);
  }
  return Array.from(buckets.values())
    .filter((b) => b.count >= 2)
    .map((b) => {
      let top = 'other';
      let topN = 0;
      for (const [cat, n] of b.categories) {
        if (n > topN) {
          top = cat;
          topN = n;
        }
      }
      return {
        lat: b.sumLat / b.count,
        lng: b.sumLng / b.count,
        count: b.count,
        topCategory: top,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/* ---------------- presentation ---------------- */

function Breakdown({
  title,
  rows,
  showLegendDot,
  emptyText,
}: {
  title: string;
  rows: Array<{ label: string; count: number; color?: string }>;
  showLegendDot?: boolean;
  emptyText?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card">
      <div className="plate mb-3">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink/50">{emptyText ?? 'No data.'}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {showLegendDot && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: r.color ?? '#0a0a0a' }}
                    />
                  )}
                  <span className="text-sm truncate" title={r.label}>
                    {r.label}
                  </span>
                </div>
                <span className="font-mono text-xs text-ink/70 shrink-0">{r.count}</span>
              </div>
              <div className="h-1 bg-ink/5">
                <div
                  className="h-full"
                  style={{
                    width: `${(r.count / max) * 100}%`,
                    background: r.color ?? '#0a0a0a',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Hotspots({
  hotspots,
  totalShown,
}: {
  hotspots: Hotspot[];
  totalShown: number;
}) {
  return (
    <div className="card border-signal-rust/30">
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={14} className="text-signal-rust" />
        <div className="plate text-signal-rust">Hotspots</div>
      </div>
      {hotspots.length === 0 ? (
        <p className="text-sm text-ink/60 leading-relaxed">
          {totalShown < 2
            ? 'Not enough data points yet for a meaningful hotspot.'
            : 'No clusters — issues are evenly distributed.'}
        </p>
      ) : (
        <>
          <p className="text-xs text-ink/60 mb-3 leading-relaxed">
            Areas with multiple overlapping reports — likely worth a closer look.
          </p>
          <ol className="space-y-2">
            {hotspots.map((h, i) => (
              <li
                key={i}
                className="flex items-center gap-3 py-1.5 border-b border-ink/5 last:border-0"
              >
                <span className="font-mono text-xs text-ink/40 w-5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {CATEGORY_LABELS[h.topCategory as Category] ?? h.topCategory}{' '}
                    cluster
                  </div>
                  <div className="font-mono text-[10px] text-ink/50">
                    {h.lat.toFixed(4)}, {h.lng.toFixed(4)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl">{h.count}</div>
                  <div className="plate">reports</div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
