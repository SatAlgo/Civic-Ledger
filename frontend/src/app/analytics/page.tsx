'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, MapPin, Filter } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import type { Issue, Category, IssueStatus, Role } from '@/lib/types';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/types';
import {
  colorForDepartment,
  labelForDepartment,
  UNASSIGNED_COLOR,
  UNASSIGNED_LABEL,
} from '@/lib/deptColor';

// Leaflet must be client-only (window required)
const AnalyticsMap = dynamic(() => import('@/components/AnalyticsMap'), {
  ssr: false,
  loading: () => (
    <div className="border-2 border-ink/15 h-[600px] flex items-center justify-center">
      <Loader2 className="animate-spin text-ink/40" />
    </div>
  ),
});

type TimeWindow = '7d' | '30d' | 'all';

export default function AnalyticsPage() {
  return (
    <RoleGuard allowed={['super_admin', 'department_admin']}>
      <Analytics />
    </RoleGuard>
  );
}

function Analytics() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user)!;
  const role: Role = user.role;
  const isSuper = role === 'super_admin';

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [status, setStatus] = useState<IssueStatus | 'all'>('all');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all'); // super-admin only
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('30d');

  // Load issues from the right endpoint based on role
  useEffect(() => {
    setLoading(true);
    const endpoint = isSuper ? '/api/admin/stats' : '/api/dept/issues';
    api<{ issues: Issue[] }>(endpoint)
      .then((res) => setIssues(res.issues ?? []))
      .catch(() => toast.error('Could not load analytics data'))
      .finally(() => setLoading(false));
  }, [isSuper]);

  // Apply filters client-side. The data set is bounded (1000 max for super,
  // dept queue won't usually exceed that), so this is cheap and responsive —
  // no round-trip per filter change.
  const filtered = useMemo(() => {
    const cutoff = timeWindowCutoff(timeWindow);
    return issues.filter((i) => {
      if (status !== 'all' && i.status !== status) return false;
      if (category !== 'all' && i.category !== category) return false;
      if (isSuper && deptFilter !== 'all') {
        const deptId = deptIdOf(i);
        if (deptFilter === 'unassigned') {
          if (deptId !== null) return false;
        } else if (deptId !== deptFilter) {
          return false;
        }
      }
      if (cutoff && new Date(i.createdAt).getTime() < cutoff) return false;
      return true;
    });
  }, [issues, status, category, deptFilter, isSuper, timeWindow]);

  // Department breakdown — also serves as the legend
  const byDept = useMemo(() => groupByDept(filtered), [filtered]);
  const byStatus = useMemo(() => groupByStatus(filtered), [filtered]);
  const byCategory = useMemo(() => groupByCategory(filtered), [filtered]);
  const hotspots = useMemo(() => topHotspots(filtered, 5), [filtered]);

  // For the super-admin's "filter by department" dropdown, build options from
  // ALL issues (not the filtered ones), so the dropdown doesn't shrink as you
  // narrow other filters.
  const allDeptOptions = useMemo(() => groupByDept(issues), [issues]);

  return (
    <main className="container-civic py-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <div className="plate mb-2">
            {isSuper ? 'No. 011 / Analytics' : 'Department Analytics'}
          </div>
          <h1 className="font-display text-5xl">
            {isSuper ? (
              <>
                Where the city is <span className="italic text-signal-rust">hurting</span>.
              </>
            ) : (
              <>
                Your team&apos;s map,{' '}
                <span className="italic">at a glance</span>.
              </>
            )}
          </h1>
          <p className="text-ink/70 mt-2 max-w-2xl">
            {isSuper
              ? 'Every report on the map, colored by the department handling it. Use the filters to zoom in on a pattern.'
              : 'All issues routed to your department, plotted geographically. Filter by status to focus on what needs attention.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-px bg-ink/10 border border-ink/10 shrink-0">
          <Stat label="On map" value={filtered.length} />
          <Stat label="Of total" value={issues.length} />
          <Stat
            label="Open"
            value={filtered.filter((i) => !['resolved', 'rejected'].includes(i.status)).length}
            accent="rust"
          />
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 mb-8 pb-6 border-b border-ink/10">
        <Filter size={14} className="text-ink/50 mr-1" />

        <FilterGroup label="When">
          {(['7d', '30d', 'all'] as TimeWindow[]).map((w) => (
            <Chip key={w} active={timeWindow === w} onClick={() => setTimeWindow(w)}>
              {w === 'all' ? 'All time' : `Last ${w}`}
            </Chip>
          ))}
        </FilterGroup>

        <Separator />

        <FilterGroup label="Status">
          <Chip active={status === 'all'} onClick={() => setStatus('all')}>All</Chip>
          {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABELS[s]}
            </Chip>
          ))}
        </FilterGroup>

        <Separator />

        <FilterGroup label="Category">
          <Chip active={category === 'all'} onClick={() => setCategory('all')}>All</Chip>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </FilterGroup>

        {isSuper && allDeptOptions.length > 0 && (
          <>
            <Separator />
            <FilterGroup label="Department">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-paper border border-ink/25 px-3 py-1.5 text-sm focus:border-signal-rust focus:outline-none"
              >
                <option value="all">All departments</option>
                {allDeptOptions.map((d) => (
                  <option key={d.id ?? 'unassigned'} value={d.id ?? 'unassigned'}>
                    {d.label} ({d.count})
                  </option>
                ))}
              </select>
            </FilterGroup>
          </>
        )}
      </div>

      {loading ? (
        <div className="border-2 border-ink/15 h-[600px] flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-ink/40" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Map — main column */}
          <div className="lg:col-span-8">
            <AnalyticsMap
              issues={filtered}
              height="640px"
              onIssueClick={(id) => {
                // Both roles route through the dept issue detail page —
                // it's the existing place where you can see the full issue.
                // (Super-admin doesn't have a dedicated detail route in v1.)
                router.push(`/dept/issues/${id}`);
              }}
            />
            {filtered.length === 0 && (
              <p className="text-center plate mt-4">
                No issues match these filters.
              </p>
            )}
          </div>

          {/* Sidebar — breakdowns */}
          <aside className="lg:col-span-4 space-y-6">
            <Hotspots hotspots={hotspots} totalShown={filtered.length} />

            <Breakdown
              title={isSuper ? 'By department' : 'Routed status'}
              rows={byDept.map((d) => ({
                label: d.label,
                count: d.count,
                color: d.color,
              }))}
              showLegendDot
              emptyText="No assignments yet."
            />

            <Breakdown
              title="By status"
              rows={byStatus.map((s) => ({
                label: STATUS_LABELS[s.status],
                count: s.count,
              }))}
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

/* ---------------------------------- helpers ---------------------------------- */

function deptIdOf(issue: Issue): string | null {
  const d = issue.assignedDepartment;
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d._id ?? null;
}

function timeWindowCutoff(w: TimeWindow): number | null {
  if (w === 'all') return null;
  const days = w === '7d' ? 7 : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

interface DeptBucket {
  id: string | null;
  label: string;
  color: string;
  count: number;
}
function groupByDept(issues: Issue[]): DeptBucket[] {
  const map = new Map<string, DeptBucket>();
  for (const i of issues) {
    const id = deptIdOf(i);
    const key = id ?? '__unassigned__';
    let bucket = map.get(key);
    if (!bucket) {
      const dept =
        i.assignedDepartment && typeof i.assignedDepartment !== 'string'
          ? { name: i.assignedDepartment.name, code: i.assignedDepartment.code }
          : null;
      bucket = {
        id,
        label: id ? labelForDepartment(dept) : UNASSIGNED_LABEL,
        color: id ? colorForDepartment(id) : UNASSIGNED_COLOR,
        count: 0,
      };
      map.set(key, bucket);
    }
    bucket.count += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function groupByStatus(issues: Issue[]) {
  const map = new Map<IssueStatus, number>();
  for (const i of issues) map.set(i.status, (map.get(i.status) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function groupByCategory(issues: Issue[]) {
  const map = new Map<string, number>();
  for (const i of issues) map.set(i.category, (map.get(i.category) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Compute the top N geographic hotspots by bucketing issues into a coarse
 * lat/lng grid (~1.1km per cell at the equator). For each bucket, we track
 * the centroid of its issues so we can show a meaningful midpoint.
 *
 * This is intentionally simple — no clustering library. Good enough for a
 * city-scale data set up to a few thousand issues.
 */
const CELL_DEG = 0.01; // ~1.1km
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
    {
      sumLat: number;
      sumLng: number;
      count: number;
      categories: Map<string, number>;
    }
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
    b.count += 1;
    b.categories.set(i.category, (b.categories.get(i.category) ?? 0) + 1);
  }

  return Array.from(buckets.values())
    .filter((b) => b.count >= 2) // a single issue isn't a "hotspot"
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

/* ---------------------------------- presentation ---------------------------------- */

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'rust';
}) {
  return (
    <div className="bg-paper px-5 py-3 min-w-[88px]">
      <div className="plate">{label}</div>
      <div
        className={`font-display text-2xl ${accent === 'rust' ? 'text-signal-rust' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="plate mr-1">{label}</span>
      <div className="flex items-center gap-1 flex-wrap">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium border transition ${
        active
          ? 'bg-ink text-paper border-ink'
          : 'bg-transparent text-ink/70 border-ink/20 hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span className="h-5 w-px bg-ink/15 mx-1" />;
}

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
            Areas with multiple overlapping reports — likely worth a closer
            look.
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
