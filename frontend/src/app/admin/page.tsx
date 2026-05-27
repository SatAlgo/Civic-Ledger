'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Building2,
  FileText,
  BarChart3,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { api } from '@/lib/api';
import type { Department, Issue } from '@/lib/types';

export default function AdminOverviewPage() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <Overview />
    </RoleGuard>
  );
}

function Overview() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ departments: Department[] }>('/api/admin/departments'),
      api<{ issues: Issue[] }>('/api/admin/stats'),
    ])
      .then(([d, i]) => {
        setDepartments(d.departments ?? []);
        setIssues(i.issues ?? []);
      })
      .catch(() => toast.error('Could not load overview'))
      .finally(() => setLoading(false));
  }, []);

  const pendingDepts = departments.filter((d) => d.status === 'pending').length;
  const approvedDepts = departments.filter((d) => d.status === 'approved').length;
  const needsReroute = issues.filter((i) => i.status === 'needs_reroute').length;
  const pending = issues.filter((i) => ['reported', 'assigned'].includes(i.status)).length;
  const ongoing = issues.filter((i) => i.status === 'in_progress').length;
  const completed = issues.filter((i) => i.status === 'resolved').length;

  return (
    <main className="container-civic py-12">
      <div className="plate mb-2">No. 010 / Administrator Console</div>
      <h1 className="font-display text-5xl mb-3">Command center.</h1>
      <p className="text-ink/70 mb-12 max-w-2xl">
        Three workspaces. Pick where you want to go.
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-ink/40" />
        </div>
      ) : (
        <>
          {/* Action card grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <ActionCard
              href="/admin/departments"
              icon={<Building2 size={20} />}
              title="Departments"
              subtitle="Directory & approvals"
              stats={[
                { label: 'Total', value: departments.length },
                { label: 'Pending review', value: pendingDepts, accent: pendingDepts > 0 },
                { label: 'Active', value: approvedDepts },
              ]}
              cta={pendingDepts > 0 ? `${pendingDepts} awaiting review` : 'Manage directory'}
            />
            <ActionCard
              href="/admin/issues"
              icon={<FileText size={20} />}
              title="Issues"
              subtitle="Track every report"
              stats={[
                { label: 'Pending', value: pending },
                { label: 'Ongoing', value: ongoing },
                { label: 'Completed', value: completed },
              ]}
              cta="Open issue list"
            />
            <ActionCard
              href="/admin/analytics"
              icon={<BarChart3 size={20} />}
              title="Analytics"
              subtitle="Map & patterns"
              stats={[
                { label: 'On map', value: issues.length },
                { label: 'Departments', value: approvedDepts },
              ]}
              cta="Explore the map"
            />
          </div>

          {/* Urgent banner */}
          {needsReroute > 0 && (
            <Link
              href="/admin/issues?bucket=attention"
              className="card border-signal-rust/40 bg-signal-rust/5 flex items-center gap-4 hover:bg-signal-rust/10 transition mb-10"
            >
              <AlertTriangle size={24} className="text-signal-rust shrink-0" />
              <div className="flex-1">
                <div className="font-display text-xl">
                  {needsReroute} {needsReroute === 1 ? 'issue needs' : 'issues need'} your attention
                </div>
                <p className="text-sm text-ink/70 mt-0.5">
                  Bounced back by departments — waiting for you to re-route them.
                </p>
              </div>
              <ArrowUpRight size={20} className="text-signal-rust" />
            </Link>
          )}
        </>
      )}
    </main>
  );
}

function ActionCard({
  href,
  icon,
  title,
  subtitle,
  stats,
  cta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  stats: Array<{ label: string; value: number; accent?: boolean }>;
  cta: string;
}) {
  return (
    <Link href={href} className="card group hover:border-ink transition-colors block">
      <div className="flex items-start justify-between mb-4">
        <div className="text-signal-rust">{icon}</div>
        <ArrowUpRight
          size={18}
          className="text-ink/30 group-hover:text-signal-rust group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all"
        />
      </div>
      <h2 className="font-display text-2xl mb-1">{title}</h2>
      <p className="text-sm text-ink/60 mb-6">{subtitle}</p>

      <div className="space-y-2 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between text-sm">
            <span className="text-ink/60">{s.label}</span>
            <span
              className={`font-display text-lg ${
                s.accent ? 'text-signal-rust' : ''
              }`}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-ink/10 flex items-center justify-between">
        <span className="plate group-hover:text-signal-rust transition">{cta}</span>
        <ArrowUpRight size={14} className="text-ink/40 group-hover:text-signal-rust transition" />
      </div>
    </Link>
  );
}
