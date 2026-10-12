import { Router, Response } from 'express';
import { marketEngine } from '../services/marketEngine';
import { Timeframe } from '@novax/shared';

const router = Router();

router.get('/status', (_req, res: Response) => {
  res.json({ success: true, data: marketEngine.getStatus() });
});

router.get('/candles', async (req, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as Timeframe) || Timeframe.M1;
    const limit = parseInt(req.query.limit as string) || 100;
    const candles = await marketEngine.getHistoricalCandles(timeframe, limit);
    res.json({ success: true, data: candles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
