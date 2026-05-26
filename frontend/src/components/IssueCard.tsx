import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { MapPin } from 'lucide-react';
import type { Issue } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

export function IssueCard({ issue, href }: { issue: Issue; href: string }) {
  const dept =
    typeof issue.assignedDepartment === 'object' && issue.assignedDepartment
      ? issue.assignedDepartment.name
      : null;

  return (
    <Link href={href} className="block group">
      <article className="card hover:bg-paper-warm transition-colors">
        <div className="flex gap-5">
          {issue.photos[0] ? (
            <div className="relative w-24 h-24 flex-shrink-0 bg-ink/5 overflow-hidden">
              <Image
                src={issue.photos[0]}
                alt={issue.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="96px"
              />
            </div>
          ) : (
            <div className="w-24 h-24 flex-shrink-0 bg-ink/5 flex items-center justify-center">
              <span className="plate">No photo</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <h3 className="font-display text-lg leading-tight truncate group-hover:text-signal-rust transition-colors">
                {issue.title}
              </h3>
              <StatusBadge status={issue.status} />
            </div>
            <p className="text-sm text-ink/70 line-clamp-2 mb-3">{issue.description}</p>
            <div className="flex items-center gap-4 text-xs text-ink/60">
              <span className="plate">{CATEGORY_LABELS[issue.category]}</span>
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {issue.address || `${issue.location.coordinates[1].toFixed(4)}, ${issue.location.coordinates[0].toFixed(4)}`}
              </span>
              <span className="plate">{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</span>
              {dept && <span className="plate">→ {dept}</span>}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
