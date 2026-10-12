import Decimal from 'decimal.js';
import { GameRound, Prediction, Notification } from '../models';
import { walletService } from './walletService';
import { marketEngine } from './marketEngine';
import {
  GameMode, RoundStatus, PredictionOutcome, Currency,
  NotificationType, NUMBER_CATEGORIES, DEFAULT_PAYOUT_MULTIPLIERS,
} from '@novax/shared';
import { v4 as uuidv4 } from 'uuid';
import { Server as SocketServer } from 'socket.io';

export class GameService {
  private io: SocketServer | null = null;
  private activeRounds: Map<string, NodeJS.Timeout> = new Map();

  setIO(io: SocketServer) {
    this.io = io;
  }

  async createRound(gameMode: GameMode, duration: number) {
    const now = new Date();
    const bettingCloseTime = new Date(now.getTime() + (duration - 5) * 1000); // Close 5s before end
    const endTime = new Date(now.getTime() + duration * 1000);

    const roundData: any = {
      gameMode,
      duration,
      startTime: now,
      bettingCloseTime,
      endTime,
      status: RoundStatus.OPEN,
      totalPredictions: 0,
      totalVolume: '0',
    };

    if (gameMode === GameMode.PRICE_DIRECTION) {
      roundData.symbol = 'NOVAUSDT';
      roundData.timeframe = '1m';
      roundData.openPrice = marketEngine.getCurrentPrice();
    }

    const round = await GameRound.create(roundData);

    // Schedule round closure and settlement
    const closeTimer = setTimeout(async () => {
      await this.closeRound(round._id.toString());
    }, (duration - 5) * 1000);

    const settleTimer = setTimeout(async () => {
      await this.settleRound(round._id.toString());
    }, duration * 1000);

    this.activeRounds.set(`${round._id}_close`, closeTimer);
    this.activeRounds.set(`${round._id}_settle`, settleTimer);

    // Broadcast new round
    if (this.io) {
      this.io.emit('round:started', round.toObject());
    }

    return round;
  }

  async placePrediction(
    userId: string,
    roundId: string,
    prediction: string,
    amount: string,
    idempotencyKey: string
  ) {
    const round = await GameRound.findById(roundId);
    if (!round) throw new Error('Round not found');
    if (round.status !== RoundStatus.OPEN) throw new Error('Round is not accepting predictions');
    if (new Date() >= round.bettingCloseTime) throw new Error('Betting window has closed');

    const amountDec = new Decimal(amount);
    if (amountDec.lt('1')) throw new Error('Minimum prediction amount is 1');

    // Find payout multiplier
    const payoutConfig = DEFAULT_PAYOUT_MULTIPLIERS.find(
      (p) => p.category === prediction && p.gameMode === round.gameMode && p.isEnabled
    );
    if (!payoutConfig) throw new Error('Invalid prediction type');

    const multiplier = new Decimal(payoutConfig.multiplier);
    const potentialPayout = amountDec.mul(multiplier).toDecimalPlaces(2);

    // Reserve balance
    const reserveKey = `${idempotencyKey}_reserve`;
    await walletService.reserveBalance(userId, Currency.DEMO_USDT, amount, reserveKey);

    // Create prediction
    const pred = await Prediction.create({
      userId,
      roundId,
      gameMode: round.gameMode,
      prediction,
      amount: amountDec.toString(),
      currency: Currency.DEMO_USDT,
      potentialPayout: potentialPayout.toString(),
      payoutMultiplier: multiplier.toString(),
      outcome: PredictionOutcome.PENDING,
      payoutAmount: '0',
      idempotencyKey,
    });

    // Update round stats
    round.totalPredictions += 1;
    round.totalVolume = new Decimal(round.totalVolume).plus(amountDec).toString();
    await round.save();

    // Notify user
    if (this.io) {
      this.io.to(`user:${userId}`).emit('prediction:accepted', pred.toObject());
    }

    await Notification.create({
      userId,
      type: NotificationType.PREDICTION_ACCEPTED,
      title: 'Prediction Placed',
      message: `Your ${prediction} prediction of ${amount} DEMO_USDT has been accepted.`,
    });

    return pred;
  }

  private async closeRound(roundId: string) {
    const round = await GameRound.findById(roundId);
    if (!round || round.status !== RoundStatus.OPEN) return;

    round.status = RoundStatus.CLOSED;
    await round.save();

    if (this.io) {
      this.io.emit('round:closed', { roundId });
    }
  }

  private async settleRound(roundId: string) {
    const round = await GameRound.findById(roundId);
    if (!round || round.status === RoundStatus.SETTLED) return;

    round.status = RoundStatus.SETTLING;
    await round.save();

    let resultCategory: string;

    if (round.gameMode === GameMode.PRICE_DIRECTION) {
      // Get final price
      const closePrice = marketEngine.getCurrentPrice();
      round.closePrice = closePrice;

      const openDec = new Decimal(round.openPrice || '0');
      const closeDec = new Decimal(closePrice);

      if (closeDec.gt(openDec)) {
        resultCategory = 'UP';
      } else if (closeDec.lt(openDec)) {
        resultCategory = 'DOWN';
      } else {
        resultCategory = 'TIE';
      }
    } else {
      // Number prediction - generate random number 0-9
      const resultNumber = Math.floor(Math.random() * 10);
      round.resultNumber = resultNumber;
      resultCategory = (NUMBER_CATEGORIES[resultNumber] || []).join(',');
    }

    round.resultCategory = resultCategory;
    round.status = RoundStatus.SETTLED;
    await round.save();

    // Settle all predictions for this round
    const predictions = await Prediction.find({ roundId, outcome: PredictionOutcome.PENDING });

    for (const pred of predictions) {
      try {
        await this.settlePrediction(pred, round);
      } catch (error) {
        console.error(`Failed to settle prediction ${pred._id}:`, error);
      }
    }

    // Broadcast result
    if (this.io) {
      this.io.emit('round:result', round.toObject());
    }

    // Cleanup timers
    this.activeRounds.delete(`${roundId}_close`);
    this.activeRounds.delete(`${roundId}_settle`);

    // Auto-create next round
    setTimeout(() => {
      this.createRound(round.gameMode, round.duration).catch(console.error);
    }, 2000);
  }

  private async settlePrediction(pred: any, round: any) {
    const userId = pred.userId.toString();
    const amount = new Decimal(pred.amount);

    let isWin = false;
    let isTie = false;

    if (round.gameMode === GameMode.PRICE_DIRECTION) {
      if (round.resultCategory === 'TIE') {
        isTie = true;
      } else {
        isWin = pred.prediction === round.resultCategory;
      }
    } else {
      // Number prediction
      const categories = NUMBER_CATEGORIES[round.resultNumber] || [];
      isWin = categories.includes(pred.prediction);
    }

    // Release reserved funds
    const releaseKey = `settle_release_${pred._id}`;
    await walletService.releaseReserved(userId, Currency.DEMO_USDT, pred.amount, releaseKey);

    if (isTie) {
      pred.outcome = PredictionOutcome.TIE;
      pred.payoutAmount = pred.amount; // Return original amount
      await pred.save();
    } else if (isWin) {
      const payout = amount.mul(new Decimal(pred.payoutMultiplier)).toDecimalPlaces(2);
      const rewardKey = `settle_reward_${pred._id}`;

      // Deduct original amount (since we released it), then credit payout
      await walletService.creditPredictionReward(userId, Currency.DEMO_USDT, payout.toString(), rewardKey);

      pred.outcome = PredictionOutcome.WIN;
      pred.payoutAmount = payout.toString();
      await pred.save();
    } else {
      // Loss - funds already released and we don't re-credit
      // Actually, we need to deduct again since we released
      const deductKey = `settle_deduct_${pred._id}`;
      const wallet = await (await import('../models')).WalletAccount.findOne({
        userId, currency: Currency.DEMO_USDT
      });
      if (wallet) {
        const available = new Decimal(wallet.available);
        wallet.available = available.minus(amount).toString();
        await wallet.save();
      }

      pred.outcome = PredictionOutcome.LOSS;
      pred.payoutAmount = '0';
      await pred.save();
    }

    // Notify user
    await Notification.create({
      userId,
      type: NotificationType.PREDICTION_SETTLED,
      title: `Prediction ${pred.outcome}`,
      message: pred.outcome === PredictionOutcome.WIN
        ? `You won ${pred.payoutAmount} DEMO_USDT!`
        : pred.outcome === PredictionOutcome.TIE
          ? `Tie! Your ${pred.amount} DEMO_USDT has been returned.`
          : `You lost ${pred.amount} DEMO_USDT.`,
    });

    if (this.io) {
      this.io.to(`user:${userId}`).emit('prediction:settled', pred.toObject());
      const wallets = await walletService.getWallets(userId);
      this.io.to(`user:${userId}`).emit('wallet:updated', wallets);
    }
  }

  async getCurrentRounds() {
    return GameRound.find({
      status: { $in: [RoundStatus.OPEN, RoundStatus.CLOSED, RoundStatus.SCHEDULED] },
    }).sort({ startTime: -1 });
  }

  async getRoundHistory(page = 1, limit = 20, gameMode?: GameMode) {
    const query: any = { status: RoundStatus.SETTLED };
    if (gameMode) query.gameMode = gameMode;

    const total = await GameRound.countDocuments(query);
    const rounds = await GameRound.find(query)
      .sort({ endTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      rounds,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserPredictions(userId: string, page = 1, limit = 20) {
    const total = await Prediction.countDocuments({ userId });
    const predictions = await Prediction.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('roundId');

    return {
      predictions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  cleanup() {
    for (const [, timer] of this.activeRounds) {
      clearTimeout(timer);
    }
    this.activeRounds.clear();
  }
}

export const gameService = new GameService();
