import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Referral } from '../models/Referral';
import { User } from '../models';

const router = Router();

router.use(authenticate);

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const directReferrals = await Referral.find({ referrerId: user._id, level: 1 })
      .populate('referredUserId', 'fullName username email createdAt status');
    const secondLevelReferrals = await Referral.find({ referrerId: user._id, level: 2 })
      .populate('referredUserId', 'fullName username email createdAt status');

    res.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralLink: `${process.env.CLIENT_URL}/register?ref=${user.referralCode}`,
        directReferrals,
        secondLevelReferrals,
        totalDirect: directReferrals.length,
        totalSecondLevel: secondLevelReferrals.length,
        totalReferrals: directReferrals.length + secondLevelReferrals.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const directCount = await Referral.countDocuments({ referrerId: req.userId, level: 1 });
    const secondCount = await Referral.countDocuments({ referrerId: req.userId, level: 2 });
    const eligibleCount = await Referral.countDocuments({ referrerId: req.userId, isEligible: true });

    res.json({
      success: true,
      data: {
        directReferrals: directCount,
        secondLevelReferrals: secondCount,
        eligibleReferrals: eligibleCount,
        totalReferrals: directCount + secondCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
