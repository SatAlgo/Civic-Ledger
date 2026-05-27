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

// ============== Forum events ==============
// Clients on /forum opt in via `socket.emit('join:forum')`.
// Clients viewing a specific issue can opt in via
// `socket.emit('join:issue', issueId)` to get live comments on that issue only.

export function emitIssueUpvoted(payload: {
  issueId: string;
  upvoteCount: number;
  userId: string;
  upvoted: boolean; // true on add, false on remove
}) {
  getIO().to('forum').emit('issue:upvoted', payload);
  getIO().to(`issue:${payload.issueId}`).emit('issue:upvoted', payload);
}

export function emitIssueCommented(payload: {
  issueId: string;
  commentCount: number;
  comment: any; // populated comment with publicUser
}) {
  getIO().to('forum').emit('issue:commented', payload);
  getIO().to(`issue:${payload.issueId}`).emit('issue:commented', payload);
}

export function emitCommentDeleted(payload: {
  issueId: string;
  commentId: string;
  commentCount: number;
}) {
  getIO().to('forum').emit('comment:deleted', payload);
  getIO().to(`issue:${payload.issueId}`).emit('comment:deleted', payload);
}
