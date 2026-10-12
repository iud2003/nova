import mongoose, { Schema, Document } from 'mongoose';

export interface IReferralDoc extends Document {
  referrerId: mongoose.Types.ObjectId;
  referredUserId: mongoose.Types.ObjectId;
  referralCode: string;
  level: number;
  isEligible: boolean;
}

const referralSchema = new Schema<IReferralDoc>(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referralCode: { type: String, required: true },
    level: { type: Number, required: true, min: 1, max: 2 },
    isEligible: { type: Boolean, default: false },
  },
  { timestamps: true }
);

referralSchema.index({ referrerId: 1 });
referralSchema.index({ referredUserId: 1 });
referralSchema.index({ referrerId: 1, referredUserId: 1 }, { unique: true });

export const Referral = mongoose.model<IReferralDoc>('Referral', referralSchema);
