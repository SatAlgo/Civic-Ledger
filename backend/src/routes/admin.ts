import { Router } from 'express';
import { Department } from '../models/Department';
import { Issue } from '../models/Issue';
import { User } from '../models/User';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../utils/asyncHandler';
import { AssignSchema } from '../utils/validators';
import { BadRequestError, NotFoundError } from '../utils/errors';
import {
  emitIssueNew,
  emitIssueStatus,
  emitMapUpdate,
} from '../sockets/emitters';
import { pushNotification } from '../services/notifications';

const router = Router();

// Every route below requires super_admin
router.use(requireAuth, requireRole('super_admin'));

/**
 * GET /api/admin/departments?status=pending|approved|rejected
 */
router.get(
  '/departments',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const filter: Record<string, any> = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }
    const departments = await Department.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    res.json({ departments });
  })
);

/**
 * PATCH /api/admin/departments/:id/approve
 */
router.patch(
  '/departments/:id/approve',
  asyncHandler(async (req, res) => {
    const dept = await Department.findById(req.params.id);
    if (!dept) throw new NotFoundError('Department not found');

    dept.status = 'approved';
    await dept.save();

    // Notify the department admins tied to this dept
    const admins = await User.find({
      department: dept._id,
      role: 'department_admin',
    });
    await Promise.all(
      admins.map((u) =>
        pushNotification({
          user: u._id,
          type: 'department_approved',
          message: `Your department "${dept.name}" was approved. You can now sign in.`,
        })
      )
    );

    res.json({ department: dept });
  })
);

/**
 * PATCH /api/admin/departments/:id/reject
 */
router.patch(
  '/departments/:id/reject',
  asyncHandler(async (req, res) => {
    const dept = await Department.findById(req.params.id);
    if (!dept) throw new NotFoundError('Department not found');

    dept.status = 'rejected';
    await dept.save();

    const admins = await User.find({
      department: dept._id,
      role: 'department_admin',
    });
    await Promise.all(
      admins.map((u) =>
        pushNotification({
          user: u._id,
          type: 'department_rejected',
          message: `Your department "${dept.name}" application was rejected.`,
        })
      )
    );

    res.json({ department: dept });
  })
);

/**
 * GET /api/admin/issues/reroute-queue
 * Issues that have no assigned department.
 */
router.get(
  '/issues/reroute-queue',
  asyncHandler(async (_req, res) => {
    const issues = await Issue.find({ status: 'needs_reroute' })
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email')
      .lean();
    res.json({ issues });
  })
);

/**
 * PATCH /api/admin/issues/:id/assign
 * Body: { departmentId }
 * Manually assigns an issue to a department.
 */
router.patch(
  '/issues/:id/assign',
  asyncHandler(async (req, res) => {
    const body = AssignSchema.parse(req.body);

    const [issue, dept] = await Promise.all([
      Issue.findById(req.params.id),
      Department.findById(body.departmentId),
    ]);

    if (!issue) throw new NotFoundError('Issue not found');
    if (!dept) throw new NotFoundError('Department not found');
    if (dept.status !== 'approved') {
      throw new BadRequestError('Cannot assign to a non-approved department');
    }

    issue.assignedDepartment = dept._id;
    issue.status = 'assigned';
    issue.statusHistory.push({
      status: 'assigned',
      changedBy: req.user!._id,
      note: `Manually assigned to ${dept.name} by super-admin`,
      at: new Date(),
    });
    await issue.save();

    emitIssueNew(issue);
    emitIssueStatus({
      reporterId: issue.reportedBy.toString(),
      issueId: issue._id.toString(),
      status: 'assigned',
      note: `Assigned to ${dept.name}`,
    });
    emitMapUpdate(issue);

    await pushNotification({
      user: issue.reportedBy,
      issue: issue._id,
      type: 'assigned',
      message: `Your report "${issue.title}" was routed to ${dept.name}.`,
    });

    res.json({ issue });
  })
);

/**
 * GET /api/admin/stats
 * Returns recent issues for the overview tab to compute counts.
 * (Could be a real aggregation but this is fine for v1.)
 */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const issues = await Issue.find()
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    res.json({ issues });
  })
);

export default router;
