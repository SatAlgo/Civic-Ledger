'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Building2,
  Check,
  X,
  Mail,
  Phone,
  Search,
  AlertCircle,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { DeleteDepartmentModal } from '@/components/DeleteDepartmentModal';
import { api } from '@/lib/api';
import type { Department, Category, IssueStatus } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';

/**
 * Extended Department shape — the backend should populate `admins` with the
 * department_admin users tied to this department, and `issueCount` with a
 * count of issues currently assigned to it. If the backend doesn't yet
 * return these fields, the UI degrades gracefully.
 *
 * Backend change needed in src/routes/admin.ts GET /departments:
 *   - aggregate or lookup department_admin users where `department === _id`
 *   - countDocuments({ assignedDepartment: _id }) for issueCount
 */
interface DepartmentWithExtras extends Department {
  admins?: Array<{
    _id: string;
    name: string;
    email: string;
    phone?: string;
  }>;
  issueCount?: number;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function DepartmentsDirectoryPage() {
  return (
    <RoleGuard allowed={['super_admin']}>
      <Directory />
    </RoleGuard>
  );
}

function Directory() {
  const [departments, setDepartments] = useState<DepartmentWithExtras[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  // Modal state — null when closed, the dept being deleted when open
  const [deletingDept, setDeletingDept] = useState<DepartmentWithExtras | null>(null);

  const load = () => {
    setLoading(true);
    api<{ departments: DepartmentWithExtras[] }>('/api/admin/departments')
      .then((res) => setDepartments(res.departments ?? []))
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

  const handleDelete = async (dept: DepartmentWithExtras) => {
    // Throws on failure so the modal can keep itself open for retry
    const res = await api<{
      ok: boolean;
      deleted: {
        department: { name: string; code: string };
        admins: number;
      };
    }>(`/api/admin/departments/${dept._id}`, { method: 'DELETE' }).catch((e: any) => {
      toast.error(e?.message ?? 'Could not delete department');
      throw e;
    });

    toast.success(
      `Deleted ${res.deleted.department.code}` +
        (res.deleted.admins > 0
          ? ` and ${res.deleted.admins} admin account${res.deleted.admins === 1 ? '' : 's'}`
          : '')
    );
    setDeletingDept(null);
    load();
  };

  // Counts for the filter chips
  const counts = useMemo(() => {
    const c = { all: departments.length, pending: 0, approved: 0, rejected: 0 };
    for (const d of departments) c[d.status]++;
    return c;
  }, [departments]);

  // Apply both status filter and search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return departments.filter((d) => {
      if (filter !== 'all' && d.status !== filter) return false;
      if (!q) return true;
      const haystack = [
        d.name,
        d.code,
        d.description ?? '',
        ...(d.admins ?? []).flatMap((a) => [a.name, a.email]),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [departments, filter, search]);

  return (
    <main className="container-civic py-12">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-ink/60 hover:text-signal-rust mb-6"
      >
        <ArrowLeft size={14} /> Back to console
      </Link>

      <div className="plate mb-2">Departments Directory</div>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="font-display text-5xl">
            {counts.approved}{' '}
            <span className="italic">active</span>
            {counts.pending > 0 && (
              <>
                , <span className="text-signal-rust">{counts.pending} pending</span>
              </>
            )}
            .
          </h1>
          <p className="text-ink/70 mt-2 max-w-xl">
            Every department on the platform — search, contact admins, approve new applications.
          </p>
        </div>
      </div>

      {/* Filter + search bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-8 pb-6 border-b border-ink/10">
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium border transition capitalize flex items-center gap-2 ${
                filter === f
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-transparent text-ink/80 border-ink/20 hover:border-ink'
              }`}
            >
              {f}
              <span className="font-mono text-xs opacity-70">{counts[f]}</span>
            </button>
          ))}
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
            placeholder="Search by name, code, admin, email..."
            className="w-full bg-paper border border-ink/25 pl-9 pr-3 py-2 text-sm focus:border-signal-rust focus:outline-none"
          />
        </div>
      </div>

      {/* Directory grid */}
      {loading ? (
        <p className="text-center plate py-16 animate-pulse">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-ink/15">
          <Building2 size={40} className="mx-auto text-ink/30 mb-4" />
          <h2 className="font-display text-2xl mb-2">
            {departments.length === 0 ? 'No departments yet.' : 'Nothing matches.'}
          </h2>
          <p className="text-ink/60">
            {departments.length === 0
              ? 'Departments register themselves — they\'ll show up here when they do.'
              : 'Try a different search or filter.'}
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {filtered.map((d) => (
            <DepartmentCard
              key={d._id}
              dept={d}
              onApprove={() => act(d._id, 'approve')}
              onReject={() => act(d._id, 'reject')}
              onRequestDelete={() => setDeletingDept(d)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation — overlay sits above the entire page */}
      {deletingDept && (
        <DeleteDepartmentModal
          dept={{
            _id: deletingDept._id,
            name: deletingDept.name || 'Unnamed department',
            code: deletingDept.code || 'NO-CODE',
            adminEmails: deletingDept.admins?.map((a) => a.email) ?? [],
          }}
          onConfirm={() => handleDelete(deletingDept)}
          onClose={() => setDeletingDept(null)}
        />
      )}
    </main>
  );
}

function DepartmentCard({
  dept,
  onApprove,
  onReject,
  onRequestDelete,
}: {
  dept: DepartmentWithExtras;
  onApprove: () => void;
  onReject: () => void;
  onRequestDelete: () => void;
}) {
  const statusMeta = {
    pending: { label: 'Pending review', color: 'text-signal-rust', dot: 'bg-signal-rust' },
    approved: { label: 'Active', color: 'text-signal-moss', dot: 'bg-signal-moss' },
    rejected: { label: 'Rejected', color: 'text-ink/50', dot: 'bg-ink/30' },
  }[dept.status];

  // Surface data anomalies clearly instead of showing "()"
  const hasName = dept.name && dept.name.trim().length > 0;
  const hasCode = dept.code && dept.code.trim().length > 0;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {hasCode ? (
              <span className="font-mono text-xs px-1.5 py-0.5 bg-ink text-paper">
                {dept.code}
              </span>
            ) : (
              <span className="font-mono text-xs px-1.5 py-0.5 bg-signal-rust/20 text-signal-rust border border-signal-rust/30">
                NO CODE
              </span>
            )}
            <span className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 ${statusMeta.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
            </span>
          </div>
          {hasName ? (
            <h3 className="font-display text-xl leading-tight">{dept.name}</h3>
          ) : (
            <h3 className="font-display text-xl leading-tight text-signal-rust flex items-center gap-2">
              <AlertCircle size={16} />
              Unnamed department
            </h3>
          )}
        </div>

        {dept.status === 'pending' && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={onApprove}
              className="p-2 border border-signal-moss text-signal-moss hover:bg-signal-moss hover:text-paper transition"
              title="Approve"
              aria-label="Approve"
            >
              <Check size={14} />
            </button>
            <button
              onClick={onReject}
              className="p-2 border border-ink/30 text-ink/60 hover:bg-ink hover:text-paper transition"
              title="Reject"
              aria-label="Reject"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {dept.status === 'rejected' && (
          <button
            onClick={onRequestDelete}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-signal-rust/40 text-signal-rust hover:bg-signal-rust hover:text-paper hover:border-signal-rust transition text-xs font-medium shrink-0"
            title="Delete permanently — frees up the email and code"
          >
            <Trash2 size={13} />
            Delete
          </button>
        )}
      </div>

      {dept.description && (
        <p className="text-sm text-ink/70 mb-4 leading-relaxed">{dept.description}</p>
      )}

      {/* Categories */}
      <div className="mb-4">
        <div className="plate mb-2">Handles</div>
        {dept.categories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {dept.categories.map((c) => (
              <span key={c} className="text-xs px-2 py-1 bg-paper-warm font-mono">
                {CATEGORY_LABELS[c as Category] ?? c}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-signal-rust flex items-center gap-1.5">
            <AlertCircle size={12} /> No categories — this dept won't get auto-routed any issues
          </p>
        )}
      </div>

      {/* Admins / contact */}
      <div className="mb-4">
        <div className="plate mb-2">Admin contact</div>
        {dept.admins && dept.admins.length > 0 ? (
          <ul className="space-y-1.5">
            {dept.admins.map((a) => (
              <li key={a._id} className="text-sm">
                <div className="font-medium">{a.name}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5 text-xs">
                  <a
                    href={`mailto:${a.email}`}
                    className="inline-flex items-center gap-1 text-ink/70 hover:text-signal-rust"
                  >
                    <Mail size={11} /> {a.email}
                  </a>
                  {a.phone && (
                    <a
                      href={`tel:${a.phone}`}
                      className="inline-flex items-center gap-1 text-ink/70 hover:text-signal-rust"
                    >
                      <Phone size={11} /> {a.phone}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink/50">
            Admin contact info not loaded.{' '}
            <span className="font-mono">
              {/* Hint to whoever maintains this — backend should populate admins[] */}
              (Backend should populate <code>admins[]</code> on departments.)
            </span>
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 mt-4 border-t border-ink/10 flex items-center justify-between text-xs">
        <span className="text-ink/50 font-mono">
          Registered{' '}
          {dept.createdAt
            ? formatDistanceToNow(new Date(dept.createdAt), { addSuffix: true })
            : 'unknown'}
          {typeof dept.issueCount === 'number' && (
            <span className="ml-2">· {dept.issueCount} issues handled</span>
          )}
        </span>

        {dept.status === 'approved' && (
          <Link
            href={`/admin/issues?dept=${dept._id}`}
            className="inline-flex items-center gap-1 text-ink hover:text-signal-rust font-medium"
          >
            View issues <ExternalLink size={11} />
          </Link>
        )}
      </div>
    </div>
  );
}
