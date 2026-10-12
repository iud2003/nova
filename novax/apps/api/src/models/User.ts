import mongoose, { Schema, Document } from 'mongoose';
import { UserRole, UserStatus } from '@novax/shared';

export interface IUserDoc extends Document {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  avatar?: string;
  loginAttempts: number;
  lockUntil?: Date;
}

const userSchema = new Schema<IUserDoc>(
  {
    fullName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
    emailVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    referralCode: { type: String, required: true, unique: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    avatar: { type: String },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ referralCode: 1 });
userSchema.index({ status: 1 });

export const User = mongoose.model<IUserDoc>('User', userSchema);
