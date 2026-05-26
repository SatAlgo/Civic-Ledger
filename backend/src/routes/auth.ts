import { Router } from 'express';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { signToken, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  SignupSchema,
  LoginSchema,
  DeptRegisterSchema,
  UpdateProfileSchema,
  ChangePasswordSchema,
} from '../utils/validators';
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from '../utils/errors';

const router = Router();

/**
 * POST /api/auth/signup — citizen self-signup
 */
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const body = SignupSchema.parse(req.body);

    const exists = await User.findOne({ email: body.email });
    if (exists) throw new ConflictError('Email is already registered');

    const user = await User.create({
      name: body.name,
      email: body.email,
      password: body.password,
      role: 'citizen',
      phone: body.phone,
    });

    const token = signToken(user);
    res.status(201).json({ user: user.toSafeJSON(), token });
  })
);

/**
 * POST /api/auth/login — any role
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = LoginSchema.parse(req.body);

    const user = await User.findOne({ email: body.email }).select('+password');
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const ok = await user.comparePassword(body.password);
    if (!ok) throw new UnauthorizedError('Invalid email or password');

    // Department admins can only log in if their department is approved
    if (user.role === 'department_admin') {
      if (!user.department) {
        throw new UnauthorizedError('Department assignment missing');
      }
      const dept = await Department.findById(user.department);
      if (!dept || dept.status !== 'approved') {
        throw new UnauthorizedError(
          dept?.status === 'rejected'
            ? 'Department application was rejected'
            : 'Department is awaiting approval'
        );
      }
    }

    const token = signToken(user);
    res.json({ user: user.toSafeJSON(), token });
  })
);

/**
 * GET /api/auth/me — current authenticated user
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user!.toSafeJSON() });
  })
);

/**
 * POST /api/auth/department/register
 * Creates a Department (status: pending) AND a department_admin user
 * tied to it. Admin can't log in until super-admin approves.
 */
router.post(
  '/department/register',
  asyncHandler(async (req, res) => {
    const body = DeptRegisterSchema.parse(req.body);

    const [existingUser, existingDept] = await Promise.all([
      User.findOne({ email: body.adminEmail }),
      Department.findOne({ code: body.deptCode.toUpperCase() }),
    ]);
    if (existingUser) throw new ConflictError('Admin email is already registered');
    if (existingDept) throw new ConflictError('Department code is already taken');

    const department = await Department.create({
      name: body.deptName,
      code: body.deptCode,
      description: body.description,
      categories: body.categories,
      status: 'pending',
    });

    try {
      await User.create({
        name: body.adminName,
        email: body.adminEmail,
        password: body.password,
        role: 'department_admin',
        department: department._id,
      });
    } catch (err) {
      // Roll back the department if user creation fails
      await Department.findByIdAndDelete(department._id);
      throw err;
    }

    res.status(201).json({
      message:
        'Department application submitted. You will be notified once a super-admin approves it.',
      departmentId: department._id.toString(),
    });
  })
);

/**
 * PATCH /api/auth/me — update current user's profile (name, phone).
 * Email is intentionally NOT updatable (it's the login identifier and would
 * need a verification flow we don't have in v1).
 */
router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = UpdateProfileSchema.parse(req.body);

    const user = req.user!;
    if (body.name !== undefined) user.name = body.name;
    if (body.phone !== undefined) user.phone = body.phone ?? undefined;
    await user.save();

    res.json({ user: user.toSafeJSON() });
  })
);

/**
 * POST /api/auth/change-password — verify current password, set new one.
 * Returns a freshly-signed token so the client can replace its stored token
 * (in case we ever add token-rotation/jti invalidation in the future).
 */
router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = ChangePasswordSchema.parse(req.body);

    // Re-fetch with the password field selected
    const user = await User.findById(req.user!._id).select('+password');
    if (!user) throw new UnauthorizedError('User not found');

    const ok = await user.comparePassword(body.currentPassword);
    if (!ok) throw new UnauthorizedError('Current password is incorrect');

    if (body.currentPassword === body.newPassword) {
      throw new BadRequestError('New password must differ from current');
    }

    user.password = body.newPassword; // pre-save hook will hash
    await user.save();

    const token = signToken(user);
    res.json({ ok: true, token });
  })
);

export default router;
