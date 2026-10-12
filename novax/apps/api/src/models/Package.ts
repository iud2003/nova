import mongoose, { Schema, Document } from 'mongoose';
import { PackageTier, Currency } from '@novax/shared';

export interface IPackageDoc extends Document {
  name: string;
  tier: PackageTier;
  description: string;
  price: string;
  currency: Currency;
  durationDays: number;
  features: string[];
  rewardType: 'FIXED' | 'PERCENTAGE';
  rewardValue: string;
  rewardCap: string;
  rewardIntervalDays: number;
  isActive: boolean;
}

const packageSchema = new Schema<IPackageDoc>(
  {
    name: { type: String, required: true },
    tier: { type: String, enum: Object.values(PackageTier), required: true, unique: true },
    description: { type: String, required: true },
    price: { type: String, required: true },
    currency: { type: String, enum: Object.values(Currency), default: Currency.DEMO_NOVA },
    durationDays: { type: Number, required: true },
    features: [{ type: String }],
    rewardType: { type: String, enum: ['FIXED', 'PERCENTAGE'], default: 'FIXED' },
    rewardValue: { type: String, default: '0' },
    rewardCap: { type: String, default: '0' },
    rewardIntervalDays: { type: Number, default: 7 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Package = mongoose.model<IPackageDoc>('Package', packageSchema);
