import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Package, UserPackage } from '../models';
import { walletService } from '../services/walletService';
import { UserPackageStatus, NotificationType } from '@novax/shared';
import { Notification } from '../models/Notification';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Public: list packages
router.get('/', async (_req, res: Response) => {
  try {
    const packages = await Package.find({ isActive: true });
    res.json({ success: true, data: packages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userPackages = await UserPackage.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: userPackages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res: Response) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) { res.status(404).json({ success: false, error: 'Package not found' }); return; }
    res.json({ success: true, data: pkg });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/purchase', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg || !pkg.isActive) {
      res.status(404).json({ success: false, error: 'Package not available' });
      return;
    }

    const idempotencyKey = req.body.idempotencyKey || uuidv4();

    // Deduct NOVA tokens
    await walletService.deductForPackage(
      req.userId!,
      pkg.price,
      pkg.name,
      `pkg_purchase_${idempotencyKey}`
    );

    // Create user package
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + pkg.durationDays);

    const userPkg = await UserPackage.create({
      userId: req.userId,
      packageId: pkg._id,
      packageName: pkg.name,
      tier: pkg.tier,
      purchasePrice: pkg.price,
      status: UserPackageStatus.ACTIVE,
      purchaseDate: new Date(),
      expirationDate,
      totalRewardsEarned: '0',
      rewardCap: pkg.rewardCap,
    });

    await Notification.create({
      userId: req.userId,
      type: NotificationType.PACKAGE_PURCHASED,
      title: 'Package Purchased',
      message: `You have purchased the ${pkg.name} package for ${pkg.price} NOVA.`,
    });

    const wallets = await walletService.getWallets(req.userId!);
    res.status(201).json({ success: true, data: { userPackage: userPkg, wallets } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
