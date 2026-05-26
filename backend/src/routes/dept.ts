import { Router } from 'express';
import { Issue } from '../models/Issue';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../utils/asyncHandler';
import { UpdateStatusSchema, RerouteSchema } from '../utils/validators';
import { BadRequestError, NotFoundError } from '../utils/errors';
import {
  emitIssueStatus,
  emitIssueReroute,
  emitMapUpdate,
} from '../sockets/emitters';
import { pushNotification } from '../services/notifications';

const router = Router();

// Every route below requires a department_admin
router.use(requireAuth, requireRole('department_admin'));

/**
 * GET /api/dept/issues — the queue, filtered to the admin's department
 */
router.get(
  '/issues',
  asyncHandler(async (req, res) => {
    if (!req.user!.department) {
      throw new BadRequestError('No department assigned to this admin');
    }
    const issues = await Issue.find({ assignedDepartment: req.user!.department })
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email')
      .lean();
    res.json({ issues });
  })
);

/**
 * PATCH /api/dept/issues/:id/status
 * Body: { status, note? }
 */
router.patch(
  '/issues/:id/status',
  asyncHandler(async (req, res) => {
    const body = UpdateStatusSchema.parse(req.body);

    const issue = await Issue.findById(req.params.id);
    if (!issue) throw new NotFoundError('Issue not found');

    if (
      !req.user!.department ||
      issue.assignedDepartment?.toString() !== req.user!.department.toString()
    ) {
      throw new NotFoundError('Issue not found');
    }

    issue.status = body.status;
    issue.statusHistory.push({
      status: body.status,
      changedBy: req.user!._id,
      note: body.note,
      at: new Date(),
    });
    await issue.save();

    // Push to citizen
    emitIssueStatus({
      reporterId: issue.reportedBy.toString(),
      issueId: issue._id.toString(),
      status: body.status,
      note: body.note,
    });
    emitMapUpdate(issue);

    await pushNotification({
      user: issue.reportedBy,
      issue: issue._id,
      type: body.status === 'resolved' ? 'resolved' : 'status_change',
      message: `Your report "${issue.title}" is now ${body.status.replace('_', ' ')}`,
    });

    res.json({ issue });
  })
);

/**
 * POST /api/dept/issues/:id/reroute
 * Bounces the issue back to super-admin for re-routing.
 */
router.post(
  '/issues/:id/reroute',
  asyncHandler(async (req, res) => {
    const body = RerouteSchema.parse(req.body);

    const issue = await Issue.findById(req.params.id);
    if (!issue) throw new NotFoundError('Issue not found');

    if (
      !req.user!.department ||
      issue.assignedDepartment?.toString() !== req.user!.department.toString()
    ) {
      throw new NotFoundError('Issue not found');
    }

    issue.status = 'needs_reroute';
    issue.assignedDepartment = null;
    issue.statusHistory.push({
      status: 'needs_reroute',
      changedBy: req.user!._id,
      note: body.note ?? 'Department flagged this as not theirs',
      at: new Date(),
    });
    await issue.save();

    emitIssueReroute(issue);
    emitIssueStatus({
      reporterId: issue.reportedBy.toString(),
      issueId: issue._id.toString(),
      status: 'needs_reroute',
      note: body.note,
    });
    emitMapUpdate(issue);

    res.json({ issue });
  })
);

export default router;
