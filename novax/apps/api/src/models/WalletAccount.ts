import mongoose, { Schema, Document } from 'mongoose';
import { Currency } from '@novax/shared';

export interface IWalletAccountDoc extends Document {
  userId: mongoose.Types.ObjectId;
  currency: Currency;
  available: string;
  reserved: string;
}

const walletAccountSchema = new Schema<IWalletAccountDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, enum: Object.values(Currency), required: true },
    available: { type: String, default: '0' },
    reserved: { type: String, default: '0' },
  },
  { timestamps: true }
);

walletAccountSchema.index({ userId: 1, currency: 1 }, { unique: true });

export const WalletAccount = mongoose.model<IWalletAccountDoc>('WalletAccount', walletAccountSchema);
