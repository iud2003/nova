import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { walletService } from '../services/walletService';
import { Currency } from '@novax/shared';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const wallets = await walletService.getWallets(req.userId!);
    res.json({ success: true, data: wallets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const fundingSchema = z.object({
  amount: z.number().refine((v) => [10, 50, 100, 500, 1000].includes(v)),
  idempotencyKey: z.string().min(1),
});

router.post('/demo-funding', validate(fundingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const tx = await walletService.addDemoFunds(req.userId!, req.body.amount, req.body.idempotencyKey);
    const wallets = await walletService.getWallets(req.userId!);
    res.json({ success: true, data: { transaction: tx, wallets } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

const convertSchema = z.object({
  fromCurrency: z.nativeEnum(Currency),
  toCurrency: z.nativeEnum(Currency),
  amount: z.string().min(1),
  idempotencyKey: z.string().min(1),
});

router.post('/convert', validate(convertSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await walletService.convertTokens(
      req.userId!,
      req.body.fromCurrency,
      req.body.toCurrency,
      req.body.amount,
      req.body.idempotencyKey
    );
    const wallets = await walletService.getWallets(req.userId!);
    res.json({ success: true, data: { ...result, wallets } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string;
    const result = await walletService.getTransactions(req.userId!, page, limit, type);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
