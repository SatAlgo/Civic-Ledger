import { getIO } from './index';
import type { IIssue, IssueStatus } from '../models/Issue';

/**
 * Notify a department's room that a new issue has been assigned to them.
 */
export function emitIssueNew(issue: IIssue) {
  if (!issue.assignedDepartment) return;
  const room = `dept:${issue.assignedDepartment.toString()}`;
  getIO().to(room).emit('issue:new', issue);
}

/**
 * Notify the reporter that their issue's status has changed.
 */
export function emitIssueStatus(params: {
  reporterId: string;
  issueId: string;
  status: IssueStatus;
  note?: string;
}) {
  getIO().to(`user:${params.reporterId}`).emit('issue:status', {
    issueId: params.issueId,
    status: params.status,
    note: params.note,
  });
}

/**
 * Notify super-admins that an issue has been bounced back for re-routing.
 */
export function emitIssueReroute(issue: IIssue) {
  getIO().to('super_admin').emit('issue:reroute', issue);
}

/**
 * Live-map broadcast — any client on /map can opt in via `socket.emit('join:map')`.
 */
export function emitMapUpdate(issue: IIssue) {
  getIO().to('map').emit('map:update', issue);
}
