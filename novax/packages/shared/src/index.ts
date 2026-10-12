// ===================== ENUMS =====================

export enum UserRole {
  GUEST = 'GUEST',
  USER = 'USER',
  SUPPORT = 'SUPPORT',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

export enum Currency {
  DEMO_USDT = 'DEMO_USDT',
  DEMO_NOVA = 'DEMO_NOVA',
}

export enum TransactionType {
  DEMO_FUNDING = 'DEMO_FUNDING',
  TOKEN_CONVERSION = 'TOKEN_CONVERSION',
  PACKAGE_PURCHASE = 'PACKAGE_PURCHASE',
  PACKAGE_REFUND = 'PACKAGE_REFUND',
  PACKAGE_REWARD = 'PACKAGE_REWARD',
  REFERRAL_REWARD = 'REFERRAL_REWARD',
  PREDICTION_RESERVATION = 'PREDICTION_RESERVATION',
  PREDICTION_RELEASE = 'PREDICTION_RELEASE',
  DEMO_PREDICTION_REWARD = 'DEMO_PREDICTION_REWARD',
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

export enum PackageTier {
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
}

export enum UserPackageStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum MarketMode {
  SIMULATED = 'SIMULATED',
  LIVE = 'LIVE',
}

export enum MarketStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

export enum GameMode {
  PRICE_DIRECTION = 'PRICE_DIRECTION',
  NUMBER_PREDICTION = 'NUMBER_PREDICTION',
}

export enum PriceDirection {
  UP = 'UP',
  DOWN = 'DOWN',
}

export enum NumberCategory {
  BIG = 'BIG',
  SMALL = 'SMALL',
  ODD = 'ODD',
  EVEN = 'EVEN',
  BIG_ODD = 'BIG_ODD',
  BIG_EVEN = 'BIG_EVEN',
  SMALL_ODD = 'SMALL_ODD',
  SMALL_EVEN = 'SMALL_EVEN',
}

export enum RoundStatus {
  SCHEDULED = 'SCHEDULED',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  SETTLING = 'SETTLING',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
}

export enum PredictionOutcome {
  WIN = 'WIN',
  LOSS = 'LOSS',
  TIE = 'TIE',
  PENDING = 'PENDING',
  CANCELLED = 'CANCELLED',
}

export enum Timeframe {
  S1 = '1s',
  S5 = '5s',
  S15 = '15s',
  S30 = '30s',
  M1 = '1m',
  M3 = '3m',
  M5 = '5m',
  M15 = '15m',
  H1 = '1h',
}

export enum NotificationType {
  REGISTRATION = 'REGISTRATION',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  PACKAGE_PURCHASED = 'PACKAGE_PURCHASED',
  REWARD_CREDITED = 'REWARD_CREDITED',
  REFERRAL_REWARD = 'REFERRAL_REWARD',
  PREDICTION_ACCEPTED = 'PREDICTION_ACCEPTED',
  PREDICTION_SETTLED = 'PREDICTION_SETTLED',
  PREDICTION_CANCELLED = 'PREDICTION_CANCELLED',
  SECURITY_EVENT = 'SECURITY_EVENT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
}

// ===================== INTERFACES =====================

export interface IUser {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  referralCode: string;
  referredBy?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IWalletAccount {
  _id: string;
  userId: string;
  currency: Currency;
  available: string; // decimal string
  reserved: string;
  total: string;
  updatedAt: string;
}

export interface ILedgerTransaction {
  _id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  currency: Currency;
  amount: string;
  balanceAfter: string;
  reference?: string;
  description: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface IConversionRecord {
  _id: string;
  userId: string;
  fromCurrency: Currency;
  toCurrency: Currency;
  fromAmount: string;
  toAmount: string;
  rate: string;
  transactionId: string;
  createdAt: string;
}

export interface IPackage {
  _id: string;
  name: string;
  tier: PackageTier;
  description: string;
  price: string;
  currency: Currency;
  durationDays: number;
  features: string[];
  rewardType: 'FIXED' | 'PERCENTAGE';
  rewardValue: string;
  rewardCap: string;
  rewardIntervalDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IUserPackage {
  _id: string;
  userId: string;
  packageId: string;
  packageName: string;
  tier: PackageTier;
  purchasePrice: string;
  status: UserPackageStatus;
  purchaseDate: string;
  expirationDate: string;
  totalRewardsEarned: string;
  rewardCap: string;
  lastRewardDate?: string;
  createdAt: string;
}

export interface IReferral {
  _id: string;
  referrerId: string;
  referredUserId: string;
  referralCode: string;
  level: number;
  isEligible: boolean;
  createdAt: string;
}

export interface IReferralReward {
  _id: string;
  referralId: string;
  referrerId: string;
  referredUserId: string;
  level: number;
  triggerType: string;
  triggerAmount: string;
  commissionRate: string;
  rewardAmount: string;
  transactionId: string;
  createdAt: string;
}

export interface IMarketCandle {
  symbol: string;
  timeframe: Timeframe;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  isComplete: boolean;
  source: MarketMode;
}

export interface IGameRound {
  _id: string;
  gameMode: GameMode;
  symbol?: string;
  timeframe?: string;
  duration: number; // seconds
  startTime: string;
  bettingCloseTime: string;
  endTime: string;
  openPrice?: string;
  closePrice?: string;
  resultNumber?: number;
  resultCategory?: string;
  status: RoundStatus;
  totalPredictions: number;
  totalVolume: string;
  createdAt: string;
}

export interface IPrediction {
  _id: string;
  userId: string;
  roundId: string;
  gameMode: GameMode;
  prediction: string; // UP, DOWN, BIG, SMALL, etc
  amount: string;
  currency: Currency;
  potentialPayout: string;
  payoutMultiplier: string;
  outcome: PredictionOutcome;
  payoutAmount: string;
  createdAt: string;
}

export interface INotification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface IAuditLog {
  _id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface ISystemSetting {
  _id: string;
  key: string;
  value: string;
  description: string;
  updatedBy?: string;
  updatedAt: string;
}

// ===================== API TYPES =====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  requestId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoginRequest {
  emailOrUsername: string;
  password: string;
  twoFactorCode?: string;
}

export interface RegisterRequest {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  referralCode?: string;
  acceptTerms: boolean;
}

export interface AuthResponse {
  user: IUser;
  accessToken: string;
}

export interface DemoFundingRequest {
  amount: number; // one of: 10, 50, 100, 500, 1000
  idempotencyKey: string;
}

export interface ConvertRequest {
  fromCurrency: Currency;
  toCurrency: Currency;
  amount: string;
  idempotencyKey: string;
}

export interface PurchasePackageRequest {
  idempotencyKey: string;
}

export interface CreatePredictionRequest {
  prediction: string;
  amount: string;
  idempotencyKey: string;
}

export interface PayoutConfig {
  category: string;
  displayName: string;
  multiplier: string;
  isEnabled: boolean;
  gameMode: GameMode;
}

export interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  demoFundingVolume: string;
  conversionVolume: string;
  activePackages: number;
  packagePurchaseVolume: string;
  rewardsCredited: string;
  referralCount: number;
  predictionVolume: string;
  totalRounds: number;
  pendingSettlements: number;
}

// ===================== SOCKET EVENTS =====================

export interface ServerToClientEvents {
  'market:status': (data: { status: MarketStatus; symbol: string }) => void;
  'market:tick': (data: { symbol: string; price: string; timestamp: string }) => void;
  'market:candle': (data: IMarketCandle) => void;
  'round:started': (data: IGameRound) => void;
  'round:countdown': (data: { roundId: string; secondsLeft: number }) => void;
  'round:closed': (data: { roundId: string }) => void;
  'round:result': (data: IGameRound) => void;
  'prediction:accepted': (data: IPrediction) => void;
  'prediction:settled': (data: IPrediction) => void;
  'wallet:updated': (data: IWalletAccount[]) => void;
  'notification:created': (data: INotification) => void;
}

export interface ClientToServerEvents {
  'market:subscribe': (data: { symbol: string; timeframe: Timeframe }) => void;
  'market:unsubscribe': (data: { symbol: string }) => void;
  'game:subscribe': (data: { gameMode: GameMode }) => void;
}

// ===================== CONSTANTS =====================

export const DEMO_FUNDING_AMOUNTS = [10, 50, 100, 500, 1000] as const;

export const ROUND_DURATIONS = [60, 180, 300] as const; // 1m, 3m, 5m in seconds

export const NUMBER_CATEGORIES: Record<number, string[]> = {
  0: ['SMALL', 'EVEN', 'SMALL_EVEN'],
  1: ['SMALL', 'ODD', 'SMALL_ODD'],
  2: ['SMALL', 'EVEN', 'SMALL_EVEN'],
  3: ['SMALL', 'ODD', 'SMALL_ODD'],
  4: ['SMALL', 'EVEN', 'SMALL_EVEN'],
  5: ['BIG', 'ODD', 'BIG_ODD'],
  6: ['BIG', 'EVEN', 'BIG_EVEN'],
  7: ['BIG', 'ODD', 'BIG_ODD'],
  8: ['BIG', 'EVEN', 'BIG_EVEN'],
  9: ['BIG', 'ODD', 'BIG_ODD'],
};

export const DEFAULT_PAYOUT_MULTIPLIERS: PayoutConfig[] = [
  { category: 'UP', displayName: 'Up', multiplier: '1.95', isEnabled: true, gameMode: GameMode.PRICE_DIRECTION },
  { category: 'DOWN', displayName: 'Down', multiplier: '1.95', isEnabled: true, gameMode: GameMode.PRICE_DIRECTION },
  { category: 'BIG', displayName: 'Big (5-9)', multiplier: '1.95', isEnabled: true, gameMode: GameMode.NUMBER_PREDICTION },
  { category: 'SMALL', displayName: 'Small (0-4)', multiplier: '1.95', isEnabled: true, gameMode: GameMode.NUMBER_PREDICTION },
  { category: 'ODD', displayName: 'Odd', multiplier: '1.95', isEnabled: true, gameMode: GameMode.NUMBER_PREDICTION },
  { category: 'EVEN', displayName: 'Even', multiplier: '1.95', isEnabled: true, gameMode: GameMode.NUMBER_PREDICTION },
  { category: 'BIG_ODD', displayName: 'Big Odd', multiplier: '4.50', isEnabled: true, gameMode: GameMode.NUMBER_PREDICTION },
  { category: 'BIG_EVEN', displayName: 'Big Even', multiplier: '4.50', isEnabled: true, gameMode: GameMode.NUMBER_PREDICTION },
  { category: 'SMALL_ODD', displayName: 'Small Odd', multiplier: '4.50', isEnabled: true, gameMode: GameMode.NUMBER_PREDICTION },
  { category: 'SMALL_EVEN', displayName: 'Small Even', multiplier: '4.50', isEnabled: true, gameMode: GameMode.NUMBER_PREDICTION },
];
