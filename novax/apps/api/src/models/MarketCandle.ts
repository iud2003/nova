import mongoose, { Schema, Document } from 'mongoose';
import { Timeframe, MarketMode } from '@novax/shared';

export interface IMarketCandleDoc extends Document {
  symbol: string;
  timeframe: Timeframe;
  timestamp: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  isComplete: boolean;
  source: MarketMode;
}

const marketCandleSchema = new Schema<IMarketCandleDoc>(
  {
    symbol: { type: String, required: true },
    timeframe: { type: String, enum: Object.values(Timeframe), required: true },
    timestamp: { type: Date, required: true },
    open: { type: String, required: true },
    high: { type: String, required: true },
    low: { type: String, required: true },
    close: { type: String, required: true },
    volume: { type: String, default: '0' },
    isComplete: { type: Boolean, default: false },
    source: { type: String, enum: Object.values(MarketMode), default: MarketMode.SIMULATED },
  },
  { timestamps: true }
);

marketCandleSchema.index({ symbol: 1, timeframe: 1, timestamp: -1 }, { unique: true });

export const MarketCandle = mongoose.model<IMarketCandleDoc>('MarketCandle', marketCandleSchema);
