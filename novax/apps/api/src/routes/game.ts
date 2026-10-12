import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { GameRound, Prediction } from '../models';
import { GameMode, RoundStatus } from '@novax/shared';

const router = Router();

// Get current open/active rounds
router.get('/rounds/active', async (_req, res: Response) => {
  try {
    const rounds = await GameRound.find({
      status: { $in: [RoundStatus.OPEN, RoundStatus.LOCKED] },
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: rounds });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent completed rounds (history)
router.get('/rounds/history', async (req, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const gameMode = req.query.gameMode as GameMode;

    const query: any = { status: RoundStatus.SETTLED };
    if (gameMode) query.gameMode = gameMode;

    const rounds = await GameRound.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ success: true, data: rounds });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific round details
router.get('/rounds/:id', async (req, res: Response) => {
  try {
    const round = await GameRound.findById(req.params.id);
    if (!round) {
      res.status(404).json({ success: false, error: 'Round not found' });
      return;
    }
    res.json({ success: true, data: round });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Place prediction / ticket
const predictionSchema = z.object({
  roundId: z.string().min(1),
  prediction: z.string().min(1),
  amount: z.string().min(1),
  idempotencyKey: z.string().min(1),
});

router.post('/predict', authenticate, validate(predictionSchema), async (req: AuthRequest, res: Response) => {
  try {
    // Dynamic import / access to gameService singleton
    const { gameService } = await import('../services/gameService');
    const prediction = await gameService.placePrediction(
      req.userId!,
      req.body.roundId,
      req.body.prediction,
      req.body.amount,
      req.body.idempotencyKey
    );

    res.status(201).json({ success: true, data: prediction });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// User's own prediction tickets history
router.get('/my-predictions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const predictions = await Prediction.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('roundId', 'roundNumber gameMode openPrice closePrice winningOutcome status');

    res.json({ success: true, data: predictions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
