import { Router } from 'express';
import { getMe, updateMe, updatePassword } from '../controllers/user.controller';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.put('/me/password', protect, updatePassword);

export default router;