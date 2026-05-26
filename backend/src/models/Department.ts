import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { CATEGORIES } from '../utils/validators';

export type DepartmentStatus = 'pending' | 'approved' | 'rejected';

export interface IDepartment extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  categories: string[];
  status: DepartmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      unique: true,
      index: true,
    },
    description: { type: String, default: '', maxlength: 500 },
    categories: {
      type: [{ type: String, enum: CATEGORIES }],
      required: true,
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length > 0,
        message: 'At least one category required',
      },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

DepartmentSchema.index({ status: 1, categories: 1 });

export const Department: Model<IDepartment> =
  mongoose.models.Department ||
  mongoose.model<IDepartment>('Department', DepartmentSchema);
