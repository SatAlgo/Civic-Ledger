import type { Types } from 'mongoose';
import { Department } from '../models/Department';
import { RoutingRule } from '../models/RoutingRule';

export interface RoutingResult {
  departmentId: Types.ObjectId | null;
  status: 'assigned' | 'needs_reroute';
}

/**
 * Given an issue category, decides which department should own it.
 *
 * Resolution order:
 *   1. Highest-priority RoutingRule for the category whose department is approved
 *   2. First approved department whose `categories` array includes the category
 *   3. Falls back to status 'needs_reroute' if no match
 */
export async function routeIssue(category: string): Promise<RoutingResult> {
  // 1. Check explicit routing rules
  const rule = await RoutingRule.findOne({ category })
    .sort({ priority: -1, createdAt: -1 })
    .populate('department');

  if (rule && rule.department) {
    const dept = rule.department as any;
    if (dept.status === 'approved') {
      return { departmentId: dept._id, status: 'assigned' };
    }
  }

  // 2. Fall back to any approved department that handles this category
  const dept = await Department.findOne({
    status: 'approved',
    categories: category,
  }).sort({ createdAt: 1 }); // earliest-registered first, stable

  if (dept) {
    return { departmentId: dept._id, status: 'assigned' };
  }

  // 3. No match — needs super-admin to manually route
  return { departmentId: null, status: 'needs_reroute' };
}
