import { Router } from 'express';
import { Issue } from '../models/Issue';
import { Upvote } from '../models/Upvote';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { ForumSortSchema } from '../utils/validators';
import { firstNameOnly } from '../utils/privacy';

const router = Router();

/**
 * GET /api/forum?sort=trending|new|top&page=1&limit=20
 * Public-readable, but if signed in we also indicate which issues the
 * current user has upvoted.
 *
 * Returns a sanitized list — reporter is reduced to first name only.
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const sort = ForumSortSchema.parse(req.query.sort ?? 'trending');
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      50,
      Math.max(5, parseInt(String(req.query.limit ?? '20'), 10) || 20)
    );
    const skip = (page - 1) * limit;

    const sortSpec =
      sort === 'trending'
        ? { engagementScore: -1 as const, createdAt: -1 as const }
        : sort === 'top'
          ? { upvoteCount: -1 as const, createdAt: -1 as const }
          : { createdAt: -1 as const };

    const [issues, total] = await Promise.all([
      Issue.find()
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .populate('reportedBy', 'name')
        .populate('assignedDepartment', 'name code')
        .lean(),
      Issue.estimatedDocumentCount(),
    ]);

    // Which of these has the current user already upvoted?
    let upvotedIds = new Set<string>();
    if (req.user && issues.length > 0) {
      const ids = issues.map((i) => i._id);
      const myUpvotes = await Upvote.find({
        user: req.user._id,
        issue: { $in: ids },
      })
        .select('issue')
        .lean();
      upvotedIds = new Set(myUpvotes.map((u) => u.issue.toString()));
    }

    // Sanitize for public consumption — first name only
    const sanitized = issues.map((i) => ({
      ...i,
      reportedBy: i.reportedBy && typeof i.reportedBy === 'object'
        ? { displayName: firstNameOnly((i.reportedBy as any).name) }
        : null,
      hasUpvoted: upvotedIds.has(i._id.toString()),
    }));

    res.json({
      issues: sanitized,
      page,
      limit,
      total,
      sort,
    });
  })
);

/**
 * GET /api/forum/nearby?lat=&lng=&radius=&category=
 * Used by the report flow to surface existing reports near the user's location
 * BEFORE they file a duplicate. Returns a short list, sanitized.
 */
router.get(
  '/nearby',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusM = Math.min(2000, Number(req.query.radius) || 300);
    const category = req.query.category ? String(req.query.category) : undefined;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.json({ issues: [] });
    }

    const filter: any = {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusM,
        },
      },
      // Don't surface resolved/rejected — those aren't actionable duplicates
      status: { $nin: ['resolved', 'rejected'] },
    };
    if (category) filter.category = category;

    const issues = await Issue.find(filter)
      .limit(5)
      .populate('reportedBy', 'name')
      .lean();

    const sanitized = issues.map((i) => ({
      _id: i._id,
      title: i.title,
      category: i.category,
      status: i.status,
      photos: i.photos,
      upvoteCount: i.upvoteCount ?? 0,
      commentCount: i.commentCount ?? 0,
      createdAt: i.createdAt,
      location: i.location,
      reportedBy: i.reportedBy && typeof i.reportedBy === 'object'
        ? { displayName: firstNameOnly((i.reportedBy as any).name) }
        : null,
    }));

    res.json({ issues: sanitized });
  })
);

export default router;
