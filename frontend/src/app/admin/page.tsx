'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Check,
  X,
  Building2,
  AlertTriangle,
  BarChart3,
  Loader2,
  Calendar,
  Map as MapIcon,
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import type { Department, Issue, Category, IssueStatus } from '@/lib/types';
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  CATEGORY_COLORS,
  STATUS_COLORS,
} from '@/lib/types';

// Leaflet must not SSR
const IssuesMap = dynamic(() => import('@/components/IssuesMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] border border-ink/20 flex items-center justify-center bg-paper-warm/40">
      <Loader2 size={28} className="animate-spin text-ink/40" />
    </div>
  ),
});

type Tab = 'departments' | 'reroute' | 'map' | 'stats';

export default function AdminPage() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <AdminDashboard />
    </RoleGuard>
  );
}

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('departments');

  return (
    <main className="container-civic py-12">
      <div className="plate mb-2">No. 010 / Administrator Console</div>
      <h1 className="font-display text-5xl mb-10">Command center.</h1>

      <div className="flex gap-1 mb-10 border-b border-ink/15 flex-wrap">
        <TabButton
          active={tab === 'departments'}
          onClick={() => setTab('departments')}
          icon={<Building2 size={14} />}
        >
          Departments
        </TabButton>
        <TabButton
          active={tab === 'reroute'}
          onClick={() => setTab('reroute')}
          icon={<AlertTriangle size={14} />}
        >
          Reroute queue
        </TabButton>
        <TabButton
          active={tab === 'map'}
          onClick={() => setTab('map')}
          icon={<MapIcon size={14} />}
        >
          Map
        </TabButton>
        <TabButton
          active={tab === 'stats'}
          onClick={() => setTab('stats')}
          icon={<BarChart3 size={14} />}
        >
          Overview
        </TabButton>
      </div>

      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'reroute' && <RerouteTab />}
      {tab === 'map' && <MapTab />}
      {tab === 'stats' && <StatsTab />}
    </main>
  );
}

function TabButton({
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

/* -------------------- DEPARTMENTS -------------------- */
function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] =
    useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const load = () => {
    setLoading(true);
    api<{ departments: Department[] }>('/api/admin/departments')
      .then((res) => setDepartments(res.departments))
      .catch(() => toast.error('Could not load departments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api(`/api/admin/departments/${id}/${action}`, { method: 'PATCH' });
      toast.success(`Department ${action}d`);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Action failed');
    }
  };

  const filtered =
    filter === 'all'
      ? departments
      : departments.filter((d) => d.status === filter);

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm border transition capitalize ${
              filter === f
                ? 'bg-ink text-paper border-ink'
                : 'bg-transparent border-ink/20 hover:border-ink'
            }`}
          >
            {f}
            <span className="ml-2 font-mono text-xs opacity-70">
              {f === 'all'
                ? departments.length
                : departments.filter((d) => d.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 size={32} className="animate-spin mx-auto text-ink/40 my-16" />
      ) : filtered.length === 0 ? (
        <p className="text-center py-16 text-ink/60">Nothing here.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map((d) => (
            <div key={d._id} className="card">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs px-1.5 py-0.5 bg-ink text-paper">
                      {d.code}
                    </span>
                    <span
                      className={`text-xs font-mono uppercase ${
                        d.status === 'pending'
                          ? 'text-signal-rust'
                          : d.status === 'approved'
                          ? 'text-signal-moss'
                          : 'text-ink/50'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <h3 className="font-display text-xl">{d.name}</h3>
                </div>
                {d.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => act(d._id, 'approve')}
                      className="p-2 border border-signal-moss text-signal-moss hover:bg-signal-moss hover:text-paper transition"
                      title="Approve"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => act(d._id, 'reject')}
                      className="p-2 border border-ink/30 text-ink/60 hover:bg-ink hover:text-paper transition"
                      title="Reject"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
              {d.description && (
                <p className="text-sm text-ink/70 mb-3">{d.description}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {d.categories.map((c) => (
                  <span
                    key={c}
                    className="text-xs px-2 py-0.5 bg-paper-warm font-mono"
                  >
                    {CATEGORY_LABELS[c] ?? c}
                  </span>
                ))}
              </div>
              <div className="text-xs font-mono text-ink/50 mt-3 flex items-center gap-1.5">
                <Calendar size={11} />{' '}
                {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- REROUTE -------------------- */
function RerouteTab() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api<{ issues: Issue[] }>('/api/admin/issues/reroute-queue'),
      api<{ departments: Department[] }>('/api/admin/departments?status=approved'),
    ])
      .then(([r1, r2]) => {
        setIssues(r1.issues);
        setDepartments(r2.departments);
      })
      .catch(() => toast.error('Could not load reroute queue'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const assign = async (issueId: string, departmentId: string) => {
    try {
      await api(`/api/admin/issues/${issueId}/assign`, {
        method: 'PATCH',
        json: { departmentId },
      });
      toast.success('Routed');
      setIssues((prev) => prev.filter((i) => i._id !== issueId));
    } catch (e: any) {
      toast.error(e?.message ?? 'Assign failed');
    }
  };

  if (loading)
    return <Loader2 size={32} className="animate-spin mx-auto text-ink/40 my-16" />;
  if (issues.length === 0)
    return (
      <div className="text-center py-16">
        <h2 className="font-display text-2xl mb-2">Reroute queue is clear.</h2>
        <p className="text-ink/60">No departments have flagged anything.</p>
      </div>
    );

  return (
    <div className="space-y-4">
      {issues.map((i) => (
        <div key={i._id} className="card">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 text-xs">
                <span className="plate">{CATEGORY_LABELS[i.category]}</span>
                <span className="w-1 h-1 rounded-full bg-ink/30" />
                <StatusBadge status={i.status} />
              </div>
              <h3 className="font-display text-lg mb-1">{i.title}</h3>
              <p className="text-sm text-ink/70 line-clamp-2">{i.description}</p>
            </div>

            <div className="md:w-80 shrink-0">
              <label className="label">Assign to</label>
              <select
                onChange={(e) => e.target.value && assign(i._id, e.target.value)}
                defaultValue=""
                className="input"
              >
                <option value="" disabled>
                  Pick a department…
                </option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------- MAP (admin) -------------------- */
function MapTab() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');

  useEffect(() => {
    api<{ issues: Issue[] }>('/api/admin/stats')
      .then((res) => setIssues(res.issues || []))
      .catch(() =>
        api<{ issues: Issue[] }>('/api/issues')
          .then((res) => setIssues(res.issues))
          .catch(() => toast.error('Could not load issues'))
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = issues.filter((i) => {
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return <Loader2 size={32} className="animate-spin mx-auto text-ink/40 my-16" />;
  }

  return (
    <div className="space-y-6">
      {/* Header w/ counts */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="plate mb-1">No. 011 / City Map</div>
          <h2 className="font-display text-3xl">
            {filtered.length}
            <span className="text-ink/40 text-2xl ml-2">
              {filtered.length === issues.length
                ? 'issues'
                : `of ${issues.length} issues`}
            </span>
          </h2>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="label !mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="input !py-1.5"
            >
              <option value="all">All categories</option>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label !mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="input !py-1.5"
            >
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Map */}
      <IssuesMap issues={filtered} variant="admin" height="600px" />

      {/* Legend */}
      <div className="grid md:grid-cols-2 gap-6 pt-2">
        <div>
          <div className="plate mb-3">Outer ring — Category</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <LegendRow
                key={c}
                color={CATEGORY_COLORS[c]}
                label={CATEGORY_LABELS[c]}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="plate mb-3">Inner dot — Status</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((s) => (
              <LegendRow
                key={s}
                color={STATUS_COLORS[s]}
                label={STATUS_LABELS[s]}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-ink/50 font-mono">
        Each pin: outer ring shows what kind of issue it is, inner dot shows
        where it is in the workflow.
      </p>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className="inline-block w-3 h-3 rounded-full border border-paper"
        style={{ background: color, boxShadow: '0 0 0 1px rgba(0,0,0,0.15)' }}
      />
      <span className="text-ink/80">{label}</span>
    </div>
  );
}

/* -------------------- STATS -------------------- */
function StatsTab() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ issues: Issue[] }>('/api/admin/stats')
      .then((res) => setIssues(res.issues || []))
      .catch(() =>
        api<{ issues: Issue[] }>('/api/issues')
          .then((res) => setIssues(res.issues))
          .catch(() => {})
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <Loader2 size={32} className="animate-spin mx-auto text-ink/40 my-16" />;

  const counts = issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  const byCategory = issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + 1;
    return acc;
  }, {});

  const maxCat = Math.max(...Object.values(byCategory), 1);

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ink/10 border border-ink/10">
        <BigStat label="Total" value={issues.length} />
        <BigStat label="Resolved" value={counts.resolved ?? 0} accent="moss" />
        <BigStat label="In progress" value={counts.in_progress ?? 0} accent="rust" />
        <BigStat
          label="Awaiting routing"
          value={counts.needs_reroute ?? 0}
          accent="rust"
        />
      </div>

      <div>
        <div className="plate text-signal-rust mb-4">— By category</div>
        <div className="space-y-3">
          {Object.entries(byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, n]) => (
              <div key={cat} className="flex items-center gap-4">
                <div className="w-48 text-sm font-medium shrink-0 flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{
                      background:
                        CATEGORY_COLORS[cat as Category] ?? '#6b6b6b',
                    }}
                  />
                  {CATEGORY_LABELS[cat as Category] ?? cat}
                </div>
                <div className="flex-1 bg-paper-warm h-6 relative">
                  <div
                    className="h-full absolute left-0 top-0 transition-all duration-500"
                    style={{
                      width: `${(n / maxCat) * 100}%`,
                      background: CATEGORY_COLORS[cat as Category] ?? '#b8442e',
                    }}
                  />
                </div>
                <div className="w-12 text-right font-mono text-sm">{n}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'rust' | 'moss';
}) {
  return (
    <div className="bg-paper px-6 py-6">
      <div className="plate mb-2">{label}</div>
      <div
        className={`font-display text-4xl ${
          accent === 'rust'
            ? 'text-signal-rust'
            : accent === 'moss'
            ? 'text-signal-moss'
            : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}