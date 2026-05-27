import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { CATEGORIES, ISSUE_STATUSES } from '../utils/validators';

export type IssueStatus =
  | 'reported'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'needs_reroute';

export interface IStatusHistory {
  status: IssueStatus;
  changedBy?: Types.ObjectId;
  note?: string;
  at: Date;
}

export interface IIssue extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  category: string;
  photos: string[];
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  address?: string;
  reportedBy: Types.ObjectId;
  assignedDepartment?: Types.ObjectId | null;
  status: IssueStatus;
  statusHistory: IStatusHistory[];
  upvoteCount: number;
  commentCount: number;
  engagementScore: number;
  lastEngagedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StatusHistorySchema = new Schema<IStatusHistory>(
  {
    status: { type: String, enum: ISSUE_STATUSES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 500 },
    at: { type: Date, default: Date.now, required: true },
  },
  { _id: false }
);

const IssueSchema = new Schema<IIssue>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 500 },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    photos: { type: [String], default: [] },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (v: number[]) =>
            v.length === 2 &&
            v[0] >= -180 && v[0] <= 180 &&
            v[1] >= -90 && v[1] <= 90,
          message: 'Invalid coordinates — expected [lng, lat]',
        },
      },
    },
    address: { type: String, maxlength: 300 },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedDepartment: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ISSUE_STATUSES,
      default: 'reported',
      required: true,
      index: true,
    },
    statusHistory: { type: [StatusHistorySchema], default: [] },

    // ----- Forum / engagement cached fields -----
    upvoteCount: { type: Number, default: 0, min: 0, index: true },
    commentCount: { type: Number, default: 0, min: 0 },
    engagementScore: { type: Number, default: 0, index: true },
    lastEngagedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Geospatial index — needed for $near queries
IssueSchema.index({ location: '2dsphere' });
// Common access patterns
IssueSchema.index({ status: 1, createdAt: -1 });
IssueSchema.index({ assignedDepartment: 1, status: 1 });
// Trending feed sort
IssueSchema.index({ engagementScore: -1, createdAt: -1 });

export const Issue: Model<IIssue> =
  mongoose.models.Issue || mongoose.model<IIssue>('Issue', IssueSchema);
