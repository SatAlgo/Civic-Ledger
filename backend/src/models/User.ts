import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export type Role = 'citizen' | 'department_admin' | 'super_admin';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: Role;
  department?: Types.ObjectId | null;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(plain: string): Promise<boolean>;
  toSafeJSON(): {
    _id: string;
    name: string;
    email: string;
    role: Role;
    department?: string | null;
    phone?: string;
  };
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false, minlength: 6 },
    role: {
      type: String,
      enum: ['citizen', 'department_admin', 'super_admin'],
      default: 'citizen',
      required: true,
      index: true,
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    phone: { type: String, trim: true, maxlength: 30 },
  },
  { timestamps: true }
);

// Hash password on save when modified
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.password);
};

UserSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department ? this.department.toString() : null,
    phone: this.phone,
  };
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
