import { Router } from 'express';
import { Department } from '../models/Department';
import { Issue } from '../models/Issue';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { RoutingRule } from '../models/RoutingRule';
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
router.use(requireAuth, requireRole('super_admin'));

/**
 * GET /api/admin/departments?status=pending|approved|rejected
 *
 * Enriches each department with:
 *   - admins[]:    department_admin users tied to this department
 *   - issueCount:  count of issues currently assigned
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

    if (departments.length === 0) {
      return res.json({ departments: [] });
    }

    const deptIds = departments.map((d) => d._id);

    const [admins, issueCounts] = await Promise.all([
      User.find(
        { role: 'department_admin', department: { $in: deptIds } },
        { name: 1, email: 1, phone: 1, department: 1 }
      ).lean(),
      Issue.aggregate([
        { $match: { assignedDepartment: { $in: deptIds } } },
        { $group: { _id: '$assignedDepartment', count: { $sum: 1 } } },
      ]),
    ]);

    const adminsByDept = new Map<string, typeof admins>();
    for (const a of admins) {
      if (!a.department) continue;
      const k = a.department.toString();
      if (!adminsByDept.has(k)) adminsByDept.set(k, []);
      adminsByDept.get(k)!.push(a);
    }

    const countsByDept = new Map<string, number>();
    for (const c of issueCounts) {
      countsByDept.set(c._id.toString(), c.count);
    }

    const enriched = departments.map((d) => {
      const key = d._id.toString();
      return {
        ...d,
        admins: adminsByDept.get(key) ?? [],
        issueCount: countsByDept.get(key) ?? 0,
      };
    });

    res.json({ departments: enriched });
  })
);

router.patch(
  '/departments/:id/approve',
  asyncHandler(async (req, res) => {
    const dept = await Department.findById(req.params.id);
    if (!dept) throw new NotFoundError('Department not found');

    dept.status = 'approved';
    await dept.save();

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
 * DELETE /api/admin/departments/:id
 *
 * Hard-delete a rejected department. Only allowed when status === 'rejected'.
 * Cascades: deletes admins, their notifications, and any RoutingRule pointing
 * at this department. Refuses if any Issue still references this department.
 */
router.delete(
  '/departments/:id',
  asyncHandler(async (req, res) => {
    const dept = await Department.findById(req.params.id);
    if (!dept) throw new NotFoundError('Department not found');

    if (dept.status !== 'rejected') {
      throw new BadRequestError(
        `Can only delete rejected departments (this one is "${dept.status}"). Reject it first if you want to delete it.`
      );
    }

    const issueCount = await Issue.countDocuments({ assignedDepartment: dept._id });
    if (issueCount > 0) {
      throw new BadRequestError(
        `Refusing to delete: ${issueCount} issue(s) still assigned to this department. This indicates corrupted data — investigate manually.`
      );
    }

    const admins = await User.find({
      department: dept._id,
      role: 'department_admin',
    }).select('_id email name');

    const adminIds = admins.map((a) => a._id);
    const adminEmails = admins.map((a) => a.email);

    const [notifResult, ruleResult, userResult] = await Promise.all([
      adminIds.length > 0
        ? Notification.deleteMany({ user: { $in: adminIds } })
        : Promise.resolve({ deletedCount: 0 }),
      RoutingRule.deleteMany({ department: dept._id }),
      adminIds.length > 0
        ? User.deleteMany({ _id: { $in: adminIds } })
        : Promise.resolve({ deletedCount: 0 }),
    ]);

    await Department.findByIdAndDelete(dept._id);

    console.warn(
      `[ADMIN DELETE] Super-admin ${req.user!.email} deleted rejected department "${dept.name}" (code: ${dept.code}). ` +
        `Cleaned up: ${userResult.deletedCount} admin user(s) [${adminEmails.join(', ')}], ` +
        `${notifResult.deletedCount} notification(s), ${ruleResult.deletedCount} routing rule(s).`
    );

    res.json({
      ok: true,
      deleted: {
        department: { _id: dept._id.toString(), name: dept.name, code: dept.code },
        admins: userResult.deletedCount,
        notifications: notifResult.deletedCount,
        routingRules: ruleResult.deletedCount,
      },
    });
  })
);

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

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const issues = await Issue.find()
      .sort({ createdAt: -1 })
      .limit(1000)
      .populate('assignedDepartment', 'name code')
      .populate('reportedBy', 'name email')
      .lean();
    res.json({ issues });
  })
);

export default router;
