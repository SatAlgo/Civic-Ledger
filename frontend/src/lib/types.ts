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

export interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  categories: Category[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Issue {
  _id: string;
  title: string;
  description: string;
  category: Category;
  photos: string[];
  location: { type: 'Point'; coordinates: [number, number] };
  address?: string;
  reportedBy: { _id: string; name: string } | string;
  assignedDepartment?: { _id: string; name: string; code: string } | null;
  status: IssueStatus;
  statusHistory: Array<{
    status: IssueStatus;
    changedBy?: string;
    note?: string;
    at: string;
  }>;
  createdAt: string;
  updatedAt: string;
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
