'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Plus, FileText, Map as MapIcon } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { IssueCard } from '@/components/IssueCard';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { Issue } from '@/lib/types';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';

const IssuesMap = dynamic(() => import('@/components/IssuesMap'), { ssr: false });

export default function CitizenHome() {
  return (
    <RoleGuard allowed={['citizen']}>
      <CitizenDashboard />
    </RoleGuard>
  );
}

function CitizenDashboard() {
  const user = useAuthStore((s) => s.user);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [nearby, setNearby] = useState<Issue[]>([]);
  const [view, setView] = useState<'list' | 'map'>('list');

  const load = async () => {
    try {
      const [mine, near] = await Promise.all([
        api<{ issues: Issue[] }>('/api/issues/mine'),
        api<{ issues: Issue[] }>('/api/issues/nearby'),
      ]);
      setIssues(mine.issues);
      setNearby(near.issues);
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  useSocket((socket) => {
    socket.on('issue:status', (data: { issueId: string; status: string }) => {
      toast.info(`Status updated to "${data.status.replace('_', ' ')}"`);
      load();
    });
  });

  return (
    <main className="container-civic py-12">
      {/* Header */}
      <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
        <div>
          <div className="plate mb-2">Citizen Registry</div>
          <h1 className="font-display text-5xl">
            Good to see you, <span className="italic">{user?.name.split(' ')[0]}</span>.
          </h1>
        </div>
        <Link href="/citizen/report" className="btn-primary">
          <Plus size={16} /> New Report
        </Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ink/10 mb-12 border border-ink/10">
        <Stat label="Your reports" value={issues.length} />
        <Stat
          label="Open"
          value={issues.filter((i) => !['resolved', 'rejected'].includes(i.status)).length}
        />
        <Stat label="Resolved" value={issues.filter((i) => i.status === 'resolved').length} />
        <Stat label="In your area" value={nearby.length} />
      </div>

      {/* My issues */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="plate">No. 006</div>
            <h2 className="font-display text-3xl">Your reports</h2>
          </div>
        </div>

        {issues.length === 0 ? (
          <div className="card text-center py-16">
            <FileText size={32} className="mx-auto mb-4 text-ink/40" />
            <p className="text-ink/60 mb-6">You haven't reported anything yet.</p>
            <Link href="/citizen/report" className="btn-primary">
              File your first report
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {issues.map((issue) => (
              <IssueCard key={issue._id} issue={issue} href={`/citizen/issues/${issue._id}`} />
            ))}
          </div>
        )}
      </section>

      {/* Nearby */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="plate">No. 007</div>
            <h2 className="font-display text-3xl">In your area</h2>
          </div>
          <div className="flex border border-ink/20">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 text-sm flex items-center gap-2 ${
                view === 'list' ? 'bg-ink text-paper' : ''
              }`}
            >
              <FileText size={14} /> List
            </button>
            <button
              onClick={() => setView('map')}
              className={`px-4 py-2 text-sm flex items-center gap-2 ${
                view === 'map' ? 'bg-ink text-paper' : ''
              }`}
            >
              <MapIcon size={14} /> Map
            </button>
          </div>
        </div>

        {nearby.length === 0 ? (
          <div className="card text-center py-12 text-ink/60">
            No reports near you yet.
          </div>
        ) : view === 'map' ? (
          <IssuesMap issues={nearby} height="500px" />
        ) : (
          <div className="grid gap-3">
            {nearby.map((issue) => (
              <IssueCard key={issue._id} issue={issue} href={`/citizen/issues/${issue._id}`} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-paper p-6">
      <div className="plate mb-2">{label}</div>
      <div className="font-display text-4xl">{value}</div>
    </div>
  );
}
