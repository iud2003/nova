import mongoose, { Schema, Document } from 'mongoose';
import { GameMode, PredictionOutcome, Currency } from '@novax/shared';

export interface IPredictionDoc extends Document {
  userId: mongoose.Types.ObjectId;
  roundId: mongoose.Types.ObjectId;
  gameMode: GameMode;
  prediction: string;
  amount: string;
  currency: Currency;
  potentialPayout: string;
  payoutMultiplier: string;
  outcome: PredictionOutcome;
  payoutAmount: string;
  reservationTxId?: mongoose.Types.ObjectId;
  settlementTxId?: mongoose.Types.ObjectId;
  idempotencyKey: string;
}

const predictionSchema = new Schema<IPredictionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'GameRound', required: true },
    gameMode: { type: String, enum: Object.values(GameMode), required: true },
    prediction: { type: String, required: true },
    amount: { type: String, required: true },
    currency: { type: String, enum: Object.values(Currency), default: Currency.DEMO_USDT },
    potentialPayout: { type: String, required: true },
    payoutMultiplier: { type: String, required: true },
    outcome: { type: String, enum: Object.values(PredictionOutcome), default: PredictionOutcome.PENDING },
    payoutAmount: { type: String, default: '0' },
    reservationTxId: { type: Schema.Types.ObjectId, ref: 'LedgerTransaction' },
    settlementTxId: { type: Schema.Types.ObjectId, ref: 'LedgerTransaction' },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

predictionSchema.index({ userId: 1, roundId: 1 });
predictionSchema.index({ roundId: 1, outcome: 1 });

export const Prediction = mongoose.model<IPredictionDoc>('Prediction', predictionSchema);
