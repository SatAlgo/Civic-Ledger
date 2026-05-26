import { z } from 'zod';

export const CATEGORIES = [
  'pothole',
  'garbage',
  'streetlight',
  'water',
  'drainage',
  'electrical',
  'other',
] as const;

export const ISSUE_STATUSES = [
  'reported',
  'assigned',
  'in_progress',
  'resolved',
  'rejected',
  'needs_reroute',
] as const;

export const ROLES = ['citizen', 'department_admin', 'super_admin'] as const;

// ---- Auth ----

export const SignupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(6).max(100),
  phone: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const DeptRegisterSchema = z.object({
  deptName: z.string().min(2).max(100),
  deptCode: z.string().min(2).max(20),
  description: z.string().max(500).optional().default(''),
  adminName: z.string().min(2).max(100),
  adminEmail: z.string().email().toLowerCase(),
  password: z.string().min(6).max(100),
  categories: z.array(z.enum(CATEGORIES)).min(1),
});

// ---- Issues ----

export const CreateIssueSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(10).max(500),
  category: z.enum(CATEGORIES),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const UpdateStatusSchema = z.object({
  status: z.enum(['assigned', 'in_progress', 'resolved', 'rejected']),
  note: z.string().max(500).optional(),
});

export const RerouteSchema = z.object({
  note: z.string().max(500).optional(),
});

// ---- Admin ----

export const AssignSchema = z.object({
  departmentId: z.string().min(1),
});

// ---- Profile ----

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100),
});
