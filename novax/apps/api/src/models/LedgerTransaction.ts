import mongoose, { Schema, Document } from 'mongoose';
import { TransactionType, TransactionStatus, Currency } from '@novax/shared';

export interface ILedgerTransactionDoc extends Document {
  userId: mongoose.Types.ObjectId;
  type: TransactionType;
  status: TransactionStatus;
  currency: Currency;
  amount: string;
  balanceAfter: string;
  reference?: string;
  description: string;
  idempotencyKey: string;
}

const ledgerTransactionSchema = new Schema<ILedgerTransactionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(TransactionType), required: true },
    status: { type: String, enum: Object.values(TransactionStatus), default: TransactionStatus.COMPLETED },
    currency: { type: String, enum: Object.values(Currency), required: true },
    amount: { type: String, required: true },
    balanceAfter: { type: String, required: true },
    reference: { type: String },
    description: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

ledgerTransactionSchema.index({ userId: 1, createdAt: -1 });
ledgerTransactionSchema.index({ type: 1 });
ledgerTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });

export const LedgerTransaction = mongoose.model<ILedgerTransactionDoc>('LedgerTransaction', ledgerTransactionSchema);
