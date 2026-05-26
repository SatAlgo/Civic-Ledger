'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, Filter } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/hooks/useSocket';
import type { Issue, IssueStatus } from '@/lib/types';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/types';

export default function DeptPage() {
  return (
    <RoleGuard allowed={['department_admin']}>
      <DeptDashboard />
    </RoleGuard>
  );
}

function DeptDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<IssueStatus | 'all'>('all');

  const load = () => {
    setLoading(true);
    api<{ issues: Issue[] }>('/api/dept/issues')
      .then((res) => setIssues(res.issues))
      .catch(() => toast.error('Could not load queue'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useSocket((socket) => {
    socket.on('issue:new', (issue: Issue) => {
      setIssues((prev) => [issue, ...prev]);
      toast.info(`New issue: ${issue.title}`);
    });
    socket.on('issue:status', () => load());
  });

  const counts = issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = filter === 'all' ? issues : issues.filter((i) => i.status === filter);
  const open = issues.filter((i) => !['resolved', 'rejected'].includes(i.status)).length;

  return (
    <>
      <main className="container-civic py-6 sm:py-12 pb-safe-bottom">
        <div className="plate mb-2">Department Console</div>

        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <h1 className="font-display text-3xl sm:text-5xl">
            <span className="text-signal-rust">{open}</span> open
          </h1>
          <p className="text-ink/70 mt-2 text-sm sm:text-base">
            Issues routed to your department
            {user?.name ? `, ${user.name.split(' ')[0]}` : ''}.
            Update status to keep citizens informed.
          </p>
        </div>

        {/* Stat tiles — 3 cols across all sizes */}
        <div className="grid grid-cols-3 gap-px bg-ink/10 border border-ink/10 mb-8 sm:mb-10">
          <Stat label="Total" value={issues.length} />
          <Stat label="In progress" value={counts.in_progress ?? 0} accent />
          <Stat label="Resolved" value={counts.resolved ?? 0} />
        </div>

        {/* Filter chips — horizontal scroll on mobile */}
        <div className="mb-6 sm:mb-8 pb-6 border-b border-ink/10">
          <div className="flex items-center gap-2 mb-3 sm:mb-0">
            <Filter size={14} className="text-ink/50" />
            <div className="plate">Filter</div>
          </div>
          <div className="chip-row sm:flex-wrap mt-3">
            <Chip
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              label="All"
              count={issues.length}
            />
            {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((key) =>
              counts[key] ? (
                <Chip
                  key={key}
                  active={filter === key}
                  onClick={() => setFilter(key)}
                  label={STATUS_LABELS[key]}
                  count={counts[key]}
                />
              ) : null
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 plate">Loading queue…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 sm:py-24 border-2 border-dashed border-ink/15">
            <h2 className="font-display text-xl sm:text-2xl mb-2">Inbox zero.</h2>
            <p className="text-ink/60 text-sm">Nothing in this filter right now.</p>
          </div>
        ) : (
          <>
            {/* MOBILE: card list */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((i) => (
                <button
                  key={i._id}
                  onClick={() => router.push(`/dept/issues/${i._id}`)}
                  className="card-tap text-left"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="font-display text-base font-medium line-clamp-2 leading-snug flex-1 min-w-0">
                      {i.title}
                    </div>
                    <ArrowUpRight
                      size={18}
                      className="text-ink/40 shrink-0 mt-0.5"
                    />
                  </div>
                  <p className="text-sm text-ink/70 line-clamp-2 mb-3">{i.description}</p>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-ink/60 font-mono">
                        {CATEGORY_LABELS[i.category]}
                      </span>
                      <StatusBadge status={i.status} />
                    </div>
                    <span className="text-xs font-mono text-ink/50 whitespace-nowrap">
                      {formatDistanceToNow(new Date(i.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* DESKTOP: table */}
            <div className="hidden md:block border border-ink/15">
              <table className="w-full">
                <thead className="bg-paper-soft border-b border-ink/15">
                  <tr className="text-left">
                    <Th>Issue</Th>
                    <Th>Category</Th>
                    <Th>Status</Th>
                    <Th>Reported</Th>
                    <Th>{''}</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr
                      key={i._id}
                      className="border-b border-ink/10 hover:bg-paper-soft transition group cursor-pointer"
                      onClick={() => router.push(`/dept/issues/${i._id}`)}
                    >
                      <Td>
                        <div className="font-display text-base font-medium line-clamp-1">
                          {i.title}
                        </div>
                        <div className="text-xs text-ink/60 line-clamp-1 mt-0.5">
                          {i.description}
                        </div>
                      </Td>
                      <Td>
                        <div className="text-sm">{CATEGORY_LABELS[i.category]}</div>
                      </Td>
                      <Td>
                        <StatusBadge status={i.status} />
                      </Td>
                      <Td>
                        <span className="text-xs font-mono text-ink/50">
                          {formatDistanceToNow(new Date(i.createdAt), { addSuffix: true })}
                        </span>
                      </Td>
                      <Td>
                        <ArrowUpRight
                          size={16}
                          className="text-ink/40 group-hover:text-signal-rust transition"
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-paper px-4 py-3 sm:px-6 sm:py-4">
      <div className="plate mb-1 truncate">{label}</div>
      <div className={`font-display text-2xl sm:text-3xl ${accent ? 'text-signal-rust' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border transition flex items-center gap-2 whitespace-nowrap min-h-[40px] ${
        active
          ? 'bg-ink text-paper border-ink'
          : 'bg-transparent text-ink border-ink/20 hover:border-ink'
      }`}
    >
      {label}
      <span className="font-mono text-xs opacity-70">{count}</span>
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-xs font-mono uppercase tracking-wider text-ink/60 font-medium">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-4 align-top">{children}</td>;
}
