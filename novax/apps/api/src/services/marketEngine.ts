import Decimal from 'decimal.js';
import { EventEmitter } from 'events';
import { MarketCandle } from '../models';
import { env } from '../config/env';
import { Timeframe, MarketMode, MarketStatus } from '@novax/shared';

interface Tick {
  symbol: string;
  price: string;
  timestamp: Date;
  volume: string;
}

interface CandleData {
  open: Decimal;
  high: Decimal;
  low: Decimal;
  close: Decimal;
  volume: Decimal;
  timestamp: Date;
  isComplete: boolean;
}

const TIMEFRAME_MS: Record<string, number> = {
  '1s': 1000,
  '5s': 5000,
  '15s': 15000,
  '30s': 30000,
  '1m': 60000,
  '3m': 180000,
  '5m': 300000,
  '15m': 900000,
  '1h': 3600000,
};

export class MarketEngine extends EventEmitter {
  private symbol = 'NOVAUSDT';
  private currentPrice: Decimal;
  private tickInterval: number;
  private tickTimer: NodeJS.Timeout | null = null;
  private candles: Map<string, CandleData> = new Map();
  private status: MarketStatus = MarketStatus.PAUSED;
  private tickCount = 0;

  constructor() {
    super();
    this.currentPrice = new Decimal(env.MARKET_STARTING_PRICE);
    this.tickInterval = parseInt(env.MARKET_TICK_INTERVAL_MS, 10);
  }

  start() {
    if (this.status === MarketStatus.ACTIVE) return;
    this.status = MarketStatus.ACTIVE;

    this.tickTimer = setInterval(() => {
      this.generateTick();
    }, this.tickInterval);

    this.emit('market:status', { status: this.status, symbol: this.symbol });
    console.log(`📈 Market engine started: ${this.symbol} at ${this.currentPrice}`);
  }

  stop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.status = MarketStatus.PAUSED;
    this.emit('market:status', { status: this.status, symbol: this.symbol });
  }

  getStatus() {
    return { status: this.status, symbol: this.symbol, price: this.currentPrice.toString() };
  }

  getCurrentPrice(): string {
    return this.currentPrice.toString();
  }

  private generateTick() {
    // Brownian motion with mean-reversion
    const volatility = 0.0008;
    const drift = 0.00001;
    const meanReversionStrength = 0.001;
    const meanPrice = new Decimal(env.MARKET_STARTING_PRICE);

    const random = this.gaussianRandom();
    const change = volatility * random + drift;
    const meanReversion = meanReversionStrength * meanPrice.minus(this.currentPrice).toNumber();

    this.currentPrice = this.currentPrice.plus(
      this.currentPrice.mul(change + meanReversion)
    );

    // Ensure price stays positive
    if (this.currentPrice.lte(0)) {
      this.currentPrice = new Decimal('0.0001');
    }

    // Round to 5 decimal places
    this.currentPrice = this.currentPrice.toDecimalPlaces(5);

    const tick: Tick = {
      symbol: this.symbol,
      price: this.currentPrice.toString(),
      timestamp: new Date(),
      volume: new Decimal(Math.random() * 100).toDecimalPlaces(2).toString(),
    };

    this.tickCount++;

    // Update all timeframe candles
    for (const tf of Object.keys(TIMEFRAME_MS)) {
      this.updateCandle(tf as Timeframe, tick);
    }

    // Emit tick event
    this.emit('market:tick', tick);
  }

  private updateCandle(timeframe: Timeframe, tick: Tick) {
    const intervalMs = TIMEFRAME_MS[timeframe];
    const candleTimestamp = new Date(
      Math.floor(tick.timestamp.getTime() / intervalMs) * intervalMs
    );
    const key = `${this.symbol}:${timeframe}:${candleTimestamp.getTime()}`;

    const price = new Decimal(tick.price);
    const volume = new Decimal(tick.volume);

    let candle = this.candles.get(key);

    if (!candle) {
      // Check if there's a previous candle to complete
      const prevTimestamp = new Date(candleTimestamp.getTime() - intervalMs);
      const prevKey = `${this.symbol}:${timeframe}:${prevTimestamp.getTime()}`;
      const prevCandle = this.candles.get(prevKey);

      if (prevCandle && !prevCandle.isComplete) {
        prevCandle.isComplete = true;
        this.persistCandle(timeframe, prevTimestamp, prevCandle);
        this.candles.delete(prevKey);
      }

      candle = {
        open: price,
        high: price,
        low: price,
        close: price,
        volume,
        timestamp: candleTimestamp,
        isComplete: false,
      };
      this.candles.set(key, candle);
    } else {
      candle.high = Decimal.max(candle.high, price);
      candle.low = Decimal.min(candle.low, price);
      candle.close = price;
      candle.volume = candle.volume.plus(volume);
    }

    // Emit candle update
    this.emit('market:candle', {
      symbol: this.symbol,
      timeframe,
      timestamp: candleTimestamp.toISOString(),
      open: candle.open.toString(),
      high: candle.high.toString(),
      low: candle.low.toString(),
      close: candle.close.toString(),
      volume: candle.volume.toString(),
      isComplete: candle.isComplete,
      source: MarketMode.SIMULATED,
    });
  }

  private async persistCandle(timeframe: Timeframe, timestamp: Date, candle: CandleData) {
    try {
      await MarketCandle.findOneAndUpdate(
        { symbol: this.symbol, timeframe, timestamp },
        {
          open: candle.open.toString(),
          high: candle.high.toString(),
          low: candle.low.toString(),
          close: candle.close.toString(),
          volume: candle.volume.toString(),
          isComplete: true,
          source: MarketMode.SIMULATED,
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Failed to persist candle:', error);
    }
  }

  async getHistoricalCandles(timeframe: Timeframe, limit = 100) {
    const candles = await MarketCandle.find({
      symbol: this.symbol,
      timeframe,
      isComplete: true,
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return candles.reverse();
  }

  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}

export const marketEngine = new MarketEngine();
