import { Router } from 'express';
import { Issue } from '../models/Issue';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { upload } from '../middleware/upload';
import { asyncHandler } from '../utils/asyncHandler';
import { CreateIssueSchema } from '../utils/validators';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { uploadMany } from '../services/cloudinaryUpload';
import { routeIssue } from '../services/routingEngine';
import { emitIssueNew, emitMapUpdate } from '../sockets/emitters';

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
 * Citizens can only fetch their own; dept admins can only fetch ones assigned
 * to their department; super admins can fetch any.
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const issue = await Issue.findById(req.params.id)
      .populate('reportedBy', 'name email')
      .populate('assignedDepartment', 'name code');

    if (!issue) throw new NotFoundError('Issue not found');

    const user = req.user!;
    if (user.role === 'citizen') {
      const reporterId = (issue.reportedBy as any)?._id?.toString() ?? issue.reportedBy.toString();
      if (reporterId !== user._id.toString()) throw new NotFoundError('Issue not found');
    } else if (user.role === 'department_admin') {
      const deptId = (issue.assignedDepartment as any)?._id?.toString();
      if (!user.department || deptId !== user.department.toString()) {
        throw new NotFoundError('Issue not found');
      }
    }
    // super_admin: see all

    res.json({ issue });
  })
);

export default router;
