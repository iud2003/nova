import mongoose, { Schema, Document } from 'mongoose';
import { GameMode, RoundStatus } from '@novax/shared';

export interface IGameRoundDoc extends Document {
  gameMode: GameMode;
  symbol?: string;
  timeframe?: string;
  duration: number;
  startTime: Date;
  bettingCloseTime: Date;
  endTime: Date;
  openPrice?: string;
  closePrice?: string;
  resultNumber?: number;
  resultCategory?: string;
  status: RoundStatus;
  totalPredictions: number;
  totalVolume: string;
}

const gameRoundSchema = new Schema<IGameRoundDoc>(
  {
    gameMode: { type: String, enum: Object.values(GameMode), required: true },
    symbol: { type: String },
    timeframe: { type: String },
    duration: { type: Number, required: true },
    startTime: { type: Date, required: true },
    bettingCloseTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    openPrice: { type: String },
    closePrice: { type: String },
    resultNumber: { type: Number },
    resultCategory: { type: String },
    status: { type: String, enum: Object.values(RoundStatus), default: RoundStatus.SCHEDULED },
    totalPredictions: { type: Number, default: 0 },
    totalVolume: { type: String, default: '0' },
  },
  { timestamps: true }
);

gameRoundSchema.index({ status: 1 });
gameRoundSchema.index({ gameMode: 1, status: 1 });
gameRoundSchema.index({ endTime: 1 });

export const GameRound = mongoose.model<IGameRoundDoc>('GameRound', gameRoundSchema);
