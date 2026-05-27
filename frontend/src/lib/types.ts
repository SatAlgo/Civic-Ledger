export type Role = 'citizen' | 'department_admin' | 'super_admin';

export type IssueStatus =
  | 'reported'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'needs_reroute';

export type Category =
  | 'pothole'
  | 'garbage'
  | 'streetlight'
  | 'water'
  | 'drainage'
  | 'electrical'
  | 'other';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
}

export interface DepartmentAdmin {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  categories: Category[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  admins?: DepartmentAdmin[];
}

export interface Issue {
  _id: string;
  title: string;
  description: string;
  category: Category;
  photos: string[];
  location: { type: 'Point'; coordinates: [number, number] };
  address?: string;
  reportedBy:
    | { _id: string; name: string }
    | { displayName: string }
    | string;
  assignedDepartment?: { _id: string; name: string; code: string } | null;
  status: IssueStatus;
  statusHistory: Array<{
    status: IssueStatus;
    changedBy?: string;
    note?: string;
    at: string;
  }>;
  upvoteCount?: number;
  commentCount?: number;
  engagementScore?: number;
  hasUpvoted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  issue: string;
  body: string;
  photo: string | null;
  isHidden: boolean;
  createdAt: string;
  user: {
    _id: string;
    displayName: string;
    role: Role;
  } | null;
}

export interface ForumNearbyIssue {
  _id: string;
  title: string;
  category: Category;
  status: IssueStatus;
  photos: string[];
  upvoteCount: number;
  commentCount: number;
  createdAt: string;
  location: { type: 'Point'; coordinates: [number, number] };
  reportedBy?: { displayName: string } | null;
}

export interface Notification {
  _id: string;
  user: string;
  issue: string;
  type: 'status_change' | 'assigned' | 'resolved' | 'reroute';
  message: string;
  read: boolean;
  createdAt: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  pothole: 'Pothole / Road Damage',
  garbage: 'Garbage / Sanitation',
  streetlight: 'Street Light',
  water: 'Water Supply / Leak',
  drainage: 'Drainage / Sewage',
  electrical: 'Electrical Hazard',
  other: 'Other',
};

export const STATUS_LABELS: Record<IssueStatus, string> = {
  reported: 'Reported',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
  needs_reroute: 'Needs Re-route',
};

// --- New: shared color sources of truth ---

export const STATUS_COLORS: Record<IssueStatus, string> = {
  reported: '#c89b3c',
  assigned: '#1e6091',
  in_progress: '#5a6b3a',
  resolved: '#2d5016',
  rejected: '#777777',
  needs_reroute: '#b8442e',
};

/**
 * Each civic-issue category gets its own outer-ring color, kept inside the
 * earth-toned civic palette so pins read like signage rather than highlighter.
 * Used by the admin map view; citizen/public maps stay status-only.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  pothole: '#9d4edd',      // Vibrant Purple — stands out on dark asphalt
  garbage: '#ff007f',      // Bright Magenta — highly visible neon tone
  streetlight: '#00f5d4',  // Electric Teal/Cyan — represents bright illumination
  water: '#4cc9f0',        // Sky Blue — distinctly lighter than your status blue
  drainage: '#38b000',     // Lime Green — clear chemical/fluid separation
  electrical: '#ff9100',   // Neon Orange — high-visibility hazard warning
  other: '#b5a290',        // Warm Sand/Beige — neutral but distinct from grey
};
