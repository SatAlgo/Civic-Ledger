import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IUpvote extends Document {
  _id: Types.ObjectId;
  issue: Types.ObjectId;
  user: Types.ObjectId;
  createdAt: Date;
}

const UpvoteSchema = new Schema<IUpvote>(
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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Hard guarantee: a user can upvote an issue at most once.
UpvoteSchema.index({ issue: 1, user: 1 }, { unique: true });

export const Upvote: Model<IUpvote> =
  mongoose.models.Upvote || mongoose.model<IUpvote>('Upvote', UpvoteSchema);
