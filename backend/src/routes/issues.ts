import { Router } from 'express';
import { Issue } from '../models/Issue';
import { Upvote } from '../models/Upvote';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { upload } from '../middleware/upload';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { CreateIssueSchema } from '../utils/validators';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { uploadMany } from '../services/cloudinaryUpload';
import { routeIssue } from '../services/routingEngine';
import {
  emitIssueNew,
  emitMapUpdate,
  emitIssueUpvoted,
} from '../sockets/emitters';

const router = Router();

/**
 * POST /api/issues — create new issue (citizens only)
 * Accepts multipart with photos[] up to 5 files.
 */
router.post(
  '/',
  requireAuth,
  requireRole('citizen'),
  upload.array('photos', 5),
  asyncHandler(async (req, res) => {
    const body = CreateIssueSchema.parse(req.body);

    const files = (req.files as Express.Multer.File[]) ?? [];

    let photoUrls: string[] = [];
    if (files.length > 0) {
      try {
        photoUrls = await uploadMany(files);
      } catch (err: any) {
        throw new BadRequestError(`Photo upload failed: ${err?.message ?? err}`);
      }
    }

    // Route to a department
    const routing = await routeIssue(body.category);

    const issue = await Issue.create({
      title: body.title,
      description: body.description,
      category: body.category,
      photos: photoUrls,
      location: {
        type: 'Point',
        coordinates: [body.lng, body.lat],
      },
      reportedBy: req.user!._id,
      assignedDepartment: routing.departmentId,
      status: routing.status,
      statusHistory: [
        {
          status: 'reported',
          changedBy: req.user!._id,
          at: new Date(),
        },
        ...(routing.status === 'assigned'
          ? [
              {
                status: 'assigned' as const,
                note: 'Auto-routed by system',
                at: new Date(),
              },
            ]
          : []),
      ],
    });

    // Emit socket events
    if (routing.departmentId) {
      emitIssueNew(issue);
    }
    emitMapUpdate(issue);

    res.status(201).json({ issue });
  })
);

/**
 * GET /api/issues — public list of recent issues (for the live map)
 * Returns the last 500, newest first.
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (_req, res) => {
    const issues = await Issue.find()
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('assignedDepartment', 'name code')
      .lean();
    res.json({ issues });
  })
);

/**
 * GET /api/issues/mine — current citizen's reports
 */
router.get(
  '/mine',
  requireAuth,
  requireRole('citizen'),
  asyncHandler(async (req, res) => {
    const issues = await Issue.find({ reportedBy: req.user!._id })
      .sort({ createdAt: -1 })
      .populate('assignedDepartment', 'name code')
      .lean();
    res.json({ issues });
  })
);

/**
 * GET /api/issues/mine/stats — aggregate counts for the current citizen's reports
 */
router.get(
  '/mine/stats',
  requireAuth,
  requireRole('citizen'),
  asyncHandler(async (req, res) => {
    const agg = await Issue.aggregate<{ _id: string; count: number }>([
      { $match: { reportedBy: req.user!._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of agg) {
      byStatus[row._id] = row.count;
      total += row.count;
    }

    res.json({ total, byStatus });
  })
);

/**
 * GET /api/issues/nearby?lat=&lng=&radius=
 * Defaults to 5km radius. Returns up to 100 issues sorted by distance.
 */
router.get(
  '/nearby',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusM = Number(req.query.radius) || 5000;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      // No coordinates supplied — return empty rather than erroring
      return res.json({ issues: [] });
    }

    const issues = await Issue.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusM,
        },
      },
    })
      .limit(100)
      .populate('assignedDepartment', 'name code')
      .lean();

    res.json({ issues });
  })
);

/**
 * GET /api/issues/:id — single issue by id.
 *
 * With the public forum, any signed-in user can read any issue (so they can
 * see comments, photos, etc). However the reporter's identity is redacted
 * to first-name-only UNLESS the viewer is the reporter themselves, the
 * assigned department admin, or a super admin.
 */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const issue = await Issue.findById(req.params.id)
      .populate('reportedBy', 'name email')
      .populate('assignedDepartment', 'name code');

    if (!issue) throw new NotFoundError('Issue not found');

    // Anonymous viewers get a public-redacted view; signed-in privileged
    // viewers (the reporter, the assigned dept admin, super admins) see the
    // full reporter identity.
    const user = req.user; // may be undefined for anonymous
    const reporterIdRaw = (issue.reportedBy as any)?._id ?? issue.reportedBy;
    const reporterId = reporterIdRaw?.toString();
    const deptId = (issue.assignedDepartment as any)?._id?.toString();
    const isReporter = !!user && reporterId === user._id.toString();
    const isAssignedDeptAdmin =
      !!user &&
      user.role === 'department_admin' &&
      !!user.department &&
      deptId === user.department.toString();
    const isSuperAdmin = !!user && user.role === 'super_admin';
    const hasPrivateView = isReporter || isAssignedDeptAdmin || isSuperAdmin;

    // Redact reporter identity for non-privileged viewers
    const issueObj = issue.toObject() as any;
    if (!hasPrivateView && issueObj.reportedBy && typeof issueObj.reportedBy === 'object') {
      const first = (issueObj.reportedBy.name ?? 'Citizen').trim().split(/\s+/)[0];
      issueObj.reportedBy = { displayName: first || 'Citizen' };
    }

    // Has the current user upvoted this issue? Anonymous → always false.
    if (user) {
      const myUpvote = await Upvote.findOne({
        user: user._id,
        issue: issue._id,
      }).lean();
      issueObj.hasUpvoted = !!myUpvote;
    } else {
      issueObj.hasUpvoted = false;
    }

    res.json({ issue: issueObj });
  })
);

/**
 * POST /api/issues/:id/upvote — toggle the current user's upvote.
 * Idempotent-ish: returns the new state. Rate-limited to 30/hr per user.
 */
router.post(
  '/:id/upvote',
  requireAuth,
  rateLimit({ name: 'upvote', limit: 30, windowSec: 3600 }),
  asyncHandler(async (req, res) => {
    const issueId = req.params.id;
    const userId = req.user!._id;

    const issue = await Issue.findById(issueId);
    if (!issue) throw new NotFoundError('Issue not found');

    // Try to remove an existing upvote (toggle off)
    const removed = await Upvote.findOneAndDelete({ issue: issueId, user: userId });
    let upvoted: boolean;
    if (removed) {
      issue.upvoteCount = Math.max(0, (issue.upvoteCount ?? 0) - 1);
      upvoted = false;
    } else {
      // Wasn't upvoted — create. Catch the duplicate-key race just in case.
      try {
        await Upvote.create({ issue: issueId, user: userId });
        issue.upvoteCount = (issue.upvoteCount ?? 0) + 1;
        upvoted = true;
      } catch (err: any) {
        if (err?.code === 11000) {
          // Lost the race — already upvoted. Re-read and report current state.
          const exists = await Upvote.findOne({ issue: issueId, user: userId });
          upvoted = !!exists;
        } else {
          throw err;
        }
      }
    }

    issue.lastEngagedAt = new Date();
    await issue.save();

    emitIssueUpvoted({
      issueId: issue._id.toString(),
      upvoteCount: issue.upvoteCount,
      userId: userId.toString(),
      upvoted,
    });

    res.json({
      upvoted,
      upvoteCount: issue.upvoteCount,
    });
  })
);

export default router;
