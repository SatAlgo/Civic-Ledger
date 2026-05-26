import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { CATEGORIES } from '../utils/validators';

/**
 * Optional manual category→department overrides set by super-admin.
 * If a rule exists for a category, it takes priority over the default
 * "any approved dept with this category" matching in the routing engine.
 */
export interface IRoutingRule extends Document {
  _id: Types.ObjectId;
  category: string;
  department: Types.ObjectId;
  priority: number; // higher wins if multiple rules match
  createdAt: Date;
  updatedAt: Date;
}

const RoutingRuleSchema = new Schema<IRoutingRule>(
  {
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

RoutingRuleSchema.index({ category: 1, priority: -1 });

export const RoutingRule: Model<IRoutingRule> =
  mongoose.models.RoutingRule ||
  mongoose.model<IRoutingRule>('RoutingRule', RoutingRuleSchema);
