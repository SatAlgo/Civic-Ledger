import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IComment extends Document {
  _id: Types.ObjectId;
  issue: Types.ObjectId;
  user: Types.ObjectId;
  body: string;
  photo?: string | null;
  isHidden: boolean; // soft-delete: comment hidden but record retained
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    issue: {
      type: Schema.Types.ObjectId,
      ref: 'Issue',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    photo: { type: String, default: null },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Common access pattern: comments on an issue, newest first
CommentSchema.index({ issue: 1, createdAt: -1 });

export const Comment: Model<IComment> =
  mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);
