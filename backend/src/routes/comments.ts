import { Router } from 'express';
import { Issue } from '../models/Issue';
import { Comment } from '../models/Comment';
import { requireAuth } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { CreateCommentSchema } from '../utils/validators';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../utils/errors';
import { uploadBuffer } from '../services/cloudinaryUpload';
import { firstNameOnly } from '../utils/privacy';
import {
  emitIssueCommented,
  emitCommentDeleted,
} from '../sockets/emitters';
import { pushNotification } from '../services/notifications';

// mergeParams so we can read req.params.id (the issue id) from the parent
const router = Router({ mergeParams: true });

/**
 * Shape a populated comment doc for API output.
 * Public name (first name only), URL, body, photo, timestamps.
 */
function shapeComment(c: any) {
  return {
    _id: c._id.toString(),
    issue: c.issue.toString(),
    body: c.isHidden ? '[hidden by moderators]' : c.body,
    photo: c.isHidden ? null : (c.photo ?? null),
    isHidden: !!c.isHidden,
    createdAt: c.createdAt,
    user: c.user && typeof c.user === 'object'
      ? {
          _id: c.user._id.toString(),
          displayName: firstNameOnly(c.user.name),
          role: c.user.role,
        }
      : null,
  };
}

/**
 * GET /api/issues/:id/comments — list comments for an issue, newest first.
 * Public read; hidden comments are returned with redacted body.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const issueId = req.params.id;
    const issue = await Issue.findById(issueId).select('_id').lean();
    if (!issue) throw new NotFoundError('Issue not found');

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(5, parseInt(String(req.query.limit ?? '50'), 10) || 50)
    );
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      Comment.find({ issue: issueId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name role')
        .lean(),
      Comment.countDocuments({ issue: issueId }),
    ]);

    res.json({
      comments: comments.map(shapeComment),
      page,
      limit,
      total,
    });
  })
);

/**
 * POST /api/issues/:id/comments — create a comment. Optional photo upload.
 * Rate-limited: 10 per hour per user.
 */
router.post(
  '/',
  requireAuth,
  rateLimit({ name: 'comment-create', limit: 10, windowSec: 3600 }),
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const issueId = req.params.id;
    const body = CreateCommentSchema.parse(req.body);

    const issue = await Issue.findById(issueId);
    if (!issue) throw new NotFoundError('Issue not found');

    // Optional photo upload
    let photoUrl: string | null = null;
    const file = req.file as Express.Multer.File | undefined;
    if (file) {
      try {
        const result = await uploadBuffer(file.buffer, 'civic-reporter/comments');
        photoUrl = result.url;
      } catch (err: any) {
        throw new BadRequestError(`Photo upload failed: ${err?.message ?? err}`);
      }
    }

    const created = await Comment.create({
      issue: issue._id,
      user: req.user!._id,
      body: body.body,
      photo: photoUrl,
    });

    // Update cached counts & engagement timestamp
    issue.commentCount = (issue.commentCount ?? 0) + 1;
    issue.lastEngagedAt = new Date();
    await issue.save();

    // Populate user for socket payload
    await created.populate('user', 'name role');
    const shaped = shapeComment(created);

    // Real-time: tell forum + per-issue room
    emitIssueCommented({
      issueId: issue._id.toString(),
      commentCount: issue.commentCount,
      comment: shaped,
    });

    // Notify reporter (unless they're commenting on their own issue)
    if (issue.reportedBy.toString() !== req.user!._id.toString()) {
      await pushNotification({
        user: issue.reportedBy,
        issue: issue._id,
        type: 'status_change',
        message: `${shaped.user?.displayName ?? 'Someone'} commented on your report "${issue.title}"`,
      });
    }

    res.status(201).json({ comment: shaped });
  })
);

/**
 * DELETE /api/issues/:id/comments/:commentId
 * - The comment's author can delete their own (hard delete).
 * - A super_admin can soft-hide any (so the audit trail survives).
 * - Anyone else: forbidden.
 */
router.delete(
  '/:commentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id: issueId, commentId } = req.params as {
      id: string;
      commentId: string;
    };

    const comment = await Comment.findOne({ _id: commentId, issue: issueId });
    if (!comment) throw new NotFoundError('Comment not found');

    const isOwner = comment.user.toString() === req.user!._id.toString();
    const isSuperAdmin = req.user!.role === 'super_admin';

    if (!isOwner && !isSuperAdmin) {
      throw new ForbiddenError('You cannot delete this comment');
    }

    if (isSuperAdmin && !isOwner) {
      // Moderator hide — soft delete, keep the record
      comment.isHidden = true;
      await comment.save();
    } else {
      // Owner — hard delete and decrement count
      await comment.deleteOne();
      const issue = await Issue.findById(issueId);
      if (issue) {
        issue.commentCount = Math.max(0, (issue.commentCount ?? 0) - 1);
        await issue.save();
      }
    }

    const issue = await Issue.findById(issueId).select('commentCount');
    emitCommentDeleted({
      issueId,
      commentId,
      commentCount: issue?.commentCount ?? 0,
    });

    res.json({ ok: true });
  })
);

export default router;
