import type { IssueStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';
import { cn } from '@/lib/cn';

const STATUS_STYLES: Record<IssueStatus, string> = {
  reported: 'bg-status-reported/15 text-status-reported border-status-reported/30',
  assigned: 'bg-status-assigned/15 text-status-assigned border-status-assigned/30',
  in_progress: 'bg-status-progress/15 text-status-progress border-status-progress/30',
  resolved: 'bg-status-resolved/15 text-status-resolved border-status-resolved/30',
  rejected: 'bg-ink/10 text-ink/60 border-ink/20',
  needs_reroute: 'bg-status-reroute/15 text-status-reroute border-status-reroute/30',
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={cn('badge border', STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
