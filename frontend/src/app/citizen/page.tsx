'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Plus, FileText, Map as MapIcon, MapPin, Loader2 } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { IssueCard } from '@/components/IssueCard';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useGeolocation } from '@/hooks/useGeolocation';
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
  const geo = useGeolocation();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [nearby, setNearby] = useState<Issue[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');

  // Load the user's own reports (no location required)
  const loadMine = async () => {
    try {
      const mine = await api<{ issues: Issue[] }>('/api/issues/mine');
      setIssues(mine.issues);
    } catch {
      // silent — empty state will show
    }
  };

  // Load nearby issues once we have coordinates
  const loadNearby = async (lat: number, lng: number) => {
    setNearbyLoading(true);
    try {
      const near = await api<{ issues: Issue[] }>(
        `/api/issues/nearby?lat=${lat}&lng=${lng}&radius=10000`
      );
      setNearby(near.issues);
    } catch {
      setNearby([]);
    } finally {
      setNearbyLoading(false);
    }
  };

  // On mount: load my issues, request location
  useEffect(() => {
    loadMine();
    geo.fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When location resolves, fetch nearby
  useEffect(() => {
    if (geo.position) {
      loadNearby(geo.position.lat, geo.position.lng);
    }
  }, [geo.position]);

  // Real-time: my reports got updated
  useSocket((socket) => {
    socket.on('issue:status', (data: { issueId: string; status: string }) => {
      toast.info(`Status updated to "${data.status.replace('_', ' ')}"`);
      loadMine();
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
            <p className="text-ink/60 mb-6">You haven&apos;t reported anything yet.</p>
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
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="plate">No. 007</div>
            <h2 className="font-display text-3xl">In your area</h2>
            {geo.position && (
              <p className="text-xs font-mono text-ink/50 mt-1">
                Within 10 km of {geo.position.lat.toFixed(3)},{' '}
                {geo.position.lng.toFixed(3)}
              </p>
            )}
          </div>
          {nearby.length > 0 && (
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
          )}
        </div>

        {geo.loading || nearbyLoading ? (
          <div className="card text-center py-12 text-ink/60 flex flex-col items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ink/40" />
            <span>{geo.loading ? 'Locating you…' : 'Loading nearby reports…'}</span>
          </div>
        ) : geo.error ? (
          <div className="card text-center py-12 text-ink/70">
            <MapPin size={24} className="mx-auto mb-4 text-ink/40" />
            <p className="mb-1">Couldn&apos;t get your location.</p>
            <p className="text-xs text-ink/50 mb-5 max-w-sm mx-auto">
              {geo.error} — you can still browse the public map.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={geo.fetch} className="btn-secondary">
                Try again
              </button>
              <Link href="/map" className="btn-primary">
                Open public map
              </Link>
            </div>
          </div>
        ) : !geo.position ? (
          <div className="card text-center py-12 text-ink/70">
            <MapPin size={24} className="mx-auto mb-4 text-ink/40" />
            <p className="mb-5">
              Allow location access to see reports filed by people near you.
            </p>
            <button onClick={geo.fetch} className="btn-primary">
              Enable location
            </button>
          </div>
        ) : nearby.length === 0 ? (
          <div className="card text-center py-12 text-ink/60">
            <p className="mb-2">No reports within 10 km of you.</p>
            <p className="text-xs text-ink/50">Quiet neighborhood — or you&apos;re the first.</p>
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