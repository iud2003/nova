import mongoose, { Schema, Document } from 'mongoose';
import { PackageTier, UserPackageStatus } from '@novax/shared';

export interface IUserPackageDoc extends Document {
  userId: mongoose.Types.ObjectId;
  packageId: mongoose.Types.ObjectId;
  packageName: string;
  tier: PackageTier;
  purchasePrice: string;
  status: UserPackageStatus;
  purchaseDate: Date;
  expirationDate: Date;
  totalRewardsEarned: string;
  rewardCap: string;
  lastRewardDate?: Date;
}

const userPackageSchema = new Schema<IUserPackageDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    packageName: { type: String, required: true },
    tier: { type: String, enum: Object.values(PackageTier), required: true },
    purchasePrice: { type: String, required: true },
    status: { type: String, enum: Object.values(UserPackageStatus), default: UserPackageStatus.ACTIVE },
    purchaseDate: { type: Date, required: true },
    expirationDate: { type: Date, required: true },
    totalRewardsEarned: { type: String, default: '0' },
    rewardCap: { type: String, required: true },
    lastRewardDate: { type: Date },
  },
  { timestamps: true }
);

userPackageSchema.index({ userId: 1, status: 1 });

export const UserPackage = mongoose.model<IUserPackageDoc>('UserPackage', userPackageSchema);
