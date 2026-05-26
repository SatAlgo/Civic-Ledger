import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type NotificationType =
  | 'status_change'
  | 'assigned'
  | 'resolved'
  | 'reroute'
  | 'department_approved'
  | 'department_rejected';

export interface INotification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  issue?: Types.ObjectId | null;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    issue: { type: Schema.Types.ObjectId, ref: 'Issue', default: null },
    type: {
      type: String,
      enum: [
        'status_change',
        'assigned',
        'resolved',
        'reroute',
        'department_approved',
        'department_rejected',
      ],
      required: true,
    },
    message: { type: String, required: true, maxlength: 300 },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema);
