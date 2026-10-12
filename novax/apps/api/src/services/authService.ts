import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, RefreshToken, WalletAccount, Notification } from '../models';
import { env } from '../config/env';
import { Currency, UserRole, NotificationType } from '@novax/shared';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'NOVAX-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class AuthService {
  async register(data: {
    fullName: string;
    username: string;
    email: string;
    phone?: string;
    password: string;
    referralCode?: string;
  }) {
    // Check duplicates
    const existingEmail = await User.findOne({ email: data.email.toLowerCase() });
    if (existingEmail) throw new Error('Email already registered');

    const existingUsername = await User.findOne({ username: data.username.toLowerCase() });
    if (existingUsername) throw new Error('Username already taken');

    // Hash password
    const hashedPassword = await argon2.hash(data.password, { type: argon2.argon2id });

    // Generate unique referral code
    let referralCode: string;
    let codeExists = true;
    do {
      referralCode = generateReferralCode();
      codeExists = !!(await User.findOne({ referralCode }));
    } while (codeExists);

    // Handle referral
    let referredBy;
    if (data.referralCode) {
      const referrer = await User.findOne({ referralCode: data.referralCode });
      if (referrer) {
        referredBy = referrer._id;
      }
    }

    // Create user
    const user = await User.create({
      fullName: data.fullName,
      username: data.username.toLowerCase(),
      email: data.email.toLowerCase(),
      phone: data.phone,
      password: hashedPassword,
      referralCode,
      referredBy,
      role: UserRole.USER,
    });

    // Create wallet accounts
    await WalletAccount.create([
      { userId: user._id, currency: Currency.DEMO_USDT, available: '0', reserved: '0' },
      { userId: user._id, currency: Currency.DEMO_NOVA, available: '0', reserved: '0' },
    ]);

    // Create referral records if referrer exists
    if (referredBy) {
      const { Referral } = await import('../models/Referral');
      await Referral.create({
        referrerId: referredBy,
        referredUserId: user._id,
        referralCode: data.referralCode,
        level: 1,
        isEligible: false,
      });

      // Second-level referral
      const referrer = await User.findById(referredBy);
      if (referrer?.referredBy) {
        await Referral.create({
          referrerId: referrer.referredBy,
          referredUserId: user._id,
          referralCode: data.referralCode,
          level: 2,
          isEligible: false,
        });
      }
    }

    // Create welcome notification
    await Notification.create({
      userId: user._id,
      type: NotificationType.REGISTRATION,
      title: 'Welcome to NovaX!',
      message: 'Your demo account has been created. Start by adding demo funds to your wallet.',
    });

    // Generate tokens
    const tokens = await this.generateTokens(user._id.toString(), user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(emailOrUsername: string, password: string) {
    const user = await User.findOne({
      $or: [
        { email: emailOrUsername.toLowerCase() },
        { username: emailOrUsername.toLowerCase() },
      ],
    }).select('+password');

    if (!user) throw new Error('Invalid credentials');
    if (user.status === 'SUSPENDED') throw new Error('Account suspended');

    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      await user.save();
      throw new Error('Invalid credentials');
    }

    user.loginAttempts = 0;
    await user.save();

    const tokens = await this.generateTokens(user._id.toString(), user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refreshAccessToken(refreshTokenStr: string) {
    const tokenDoc = await RefreshToken.findOne({ token: refreshTokenStr, isRevoked: false });
    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      throw new Error('Invalid refresh token');
    }

    const user = await User.findById(tokenDoc.userId);
    if (!user || user.status === 'SUSPENDED') throw new Error('Account not available');

    // Rotate refresh token
    tokenDoc.isRevoked = true;
    await tokenDoc.save();

    const tokens = await this.generateTokens(user._id.toString(), user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async logout(refreshTokenStr: string) {
    await RefreshToken.findOneAndUpdate(
      { token: refreshTokenStr },
      { isRevoked: true }
    );
  }

  async logoutAll(userId: string) {
    await RefreshToken.updateMany({ userId, isRevoked: false }, { isRevoked: true });
  }

  private async generateTokens(userId: string, role: string) {
    const accessToken = jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = crypto.randomBytes(40).toString('hex');

    await RefreshToken.create({
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const obj = user.toObject ? user.toObject() : user;
    delete obj.password;
    delete obj.twoFactorSecret;
    delete obj.__v;
    return obj;
  }
}

export const authService = new AuthService();
