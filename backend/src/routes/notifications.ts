import { Router } from 'express';
import { Notification } from '../models/Notification';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/notifications — current user's notifications (newest first)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ user: req.user!._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ notifications });
  })
);

/**
 * GET /api/notifications/unread-count
 */
router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({
      user: req.user!._id,
      read: false,
    });
    res.json({ count });
  })
);

/**
 * POST /api/notifications/read-all
 */
router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany(
      { user: req.user!._id, read: false },
      { $set: { read: true } }
    );
    res.json({ ok: true });
  })
);

/**
 * POST /api/notifications/:id/read — mark a single notification read
 */
router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user!._id },
      { $set: { read: true } },
      { new: true }
    );
    res.json({ notification: n });
  })
);

export default router;
