import Decimal from 'decimal.js';
import { WalletAccount, LedgerTransaction, Notification } from '../models';
import { Currency, TransactionType, TransactionStatus, NotificationType, DEMO_FUNDING_AMOUNTS } from '@novax/shared';
import { SystemSetting } from '../models/SystemSetting';

export class WalletService {
  async getWallets(userId: string) {
    const wallets = await WalletAccount.find({ userId });
    return wallets.map((w) => ({
      _id: w._id,
      userId: w.userId,
      currency: w.currency,
      available: w.available,
      reserved: w.reserved,
      total: new Decimal(w.available).plus(w.reserved).toString(),
      updatedAt: (w as any).updatedAt,
    }));
  }

  async addDemoFunds(userId: string, amount: number, idempotencyKey: string) {
    if (!DEMO_FUNDING_AMOUNTS.includes(amount as any)) {
      throw new Error('Invalid demo funding amount');
    }

    // Check idempotency
    const existing = await LedgerTransaction.findOne({ idempotencyKey });
    if (existing) return existing;

    const amountStr = new Decimal(amount).toString();
    const wallet = await WalletAccount.findOne({ userId, currency: Currency.DEMO_USDT });
    if (!wallet) throw new Error('Wallet not found');

    const newBalance = new Decimal(wallet.available).plus(amountStr);

    wallet.available = newBalance.toString();
    await wallet.save();

    const tx = await LedgerTransaction.create({
      userId,
      type: TransactionType.DEMO_FUNDING,
      status: TransactionStatus.COMPLETED,
      currency: Currency.DEMO_USDT,
      amount: amountStr,
      balanceAfter: newBalance.toString(),
      description: `Demo funding: +${amountStr} DEMO_USDT`,
      idempotencyKey,
    });

    return tx;
  }

  async convertTokens(
    userId: string,
    fromCurrency: Currency,
    toCurrency: Currency,
    amount: string,
    idempotencyKey: string
  ) {
    // Check idempotency
    const existing = await LedgerTransaction.findOne({ idempotencyKey });
    if (existing) return existing;

    const amountDec = new Decimal(amount);
    if (amountDec.lte(0)) throw new Error('Amount must be positive');

    // Get conversion rate
    const rateSetting = await SystemSetting.findOne({ key: 'conversion_rate' });
    const rate = new Decimal(rateSetting?.value || '1.0');

    const fromWallet = await WalletAccount.findOne({ userId, currency: fromCurrency });
    if (!fromWallet) throw new Error('Source wallet not found');

    const toWallet = await WalletAccount.findOne({ userId, currency: toCurrency });
    if (!toWallet) throw new Error('Destination wallet not found');

    const available = new Decimal(fromWallet.available);
    if (available.lt(amountDec)) throw new Error('Insufficient balance');

    let outputAmount: Decimal;
    if (fromCurrency === Currency.DEMO_USDT && toCurrency === Currency.DEMO_NOVA) {
      outputAmount = amountDec.mul(rate);
    } else if (fromCurrency === Currency.DEMO_NOVA && toCurrency === Currency.DEMO_USDT) {
      outputAmount = amountDec.div(rate);
    } else {
      throw new Error('Invalid conversion pair');
    }

    // Update balances
    fromWallet.available = available.minus(amountDec).toString();
    await fromWallet.save();

    const newToBalance = new Decimal(toWallet.available).plus(outputAmount);
    toWallet.available = newToBalance.toString();
    await toWallet.save();

    // Create debit transaction
    await LedgerTransaction.create({
      userId,
      type: TransactionType.TOKEN_CONVERSION,
      status: TransactionStatus.COMPLETED,
      currency: fromCurrency,
      amount: `-${amountDec.toString()}`,
      balanceAfter: fromWallet.available,
      description: `Converted ${amountDec} ${fromCurrency} to ${outputAmount} ${toCurrency} at rate ${rate}`,
      idempotencyKey: `${idempotencyKey}_debit`,
    });

    // Create credit transaction
    const creditTx = await LedgerTransaction.create({
      userId,
      type: TransactionType.TOKEN_CONVERSION,
      status: TransactionStatus.COMPLETED,
      currency: toCurrency,
      amount: outputAmount.toString(),
      balanceAfter: newToBalance.toString(),
      description: `Received ${outputAmount} ${toCurrency} from conversion of ${amountDec} ${fromCurrency}`,
      idempotencyKey: `${idempotencyKey}_credit`,
    });

    return {
      fromAmount: amountDec.toString(),
      toAmount: outputAmount.toString(),
      rate: rate.toString(),
      transaction: creditTx,
    };
  }

  async getTransactions(userId: string, page = 1, limit = 20, type?: string) {
    const query: any = { userId };
    if (type) query.type = type;

    const total = await LedgerTransaction.countDocuments(query);
    const transactions = await LedgerTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async reserveBalance(userId: string, currency: Currency, amount: string, idempotencyKey: string) {
    const existing = await LedgerTransaction.findOne({ idempotencyKey });
    if (existing) return existing;

    const amountDec = new Decimal(amount);
    const wallet = await WalletAccount.findOne({ userId, currency });
    if (!wallet) throw new Error('Wallet not found');

    const available = new Decimal(wallet.available);
    if (available.lt(amountDec)) throw new Error('Insufficient balance');

    wallet.available = available.minus(amountDec).toString();
    wallet.reserved = new Decimal(wallet.reserved).plus(amountDec).toString();
    await wallet.save();

    const tx = await LedgerTransaction.create({
      userId,
      type: TransactionType.PREDICTION_RESERVATION,
      status: TransactionStatus.COMPLETED,
      currency,
      amount: `-${amountDec.toString()}`,
      balanceAfter: wallet.available,
      description: `Reserved ${amountDec} ${currency} for prediction`,
      idempotencyKey,
    });

    return tx;
  }

  async releaseReserved(userId: string, currency: Currency, amount: string, idempotencyKey: string) {
    const existing = await LedgerTransaction.findOne({ idempotencyKey });
    if (existing) return existing;

    const amountDec = new Decimal(amount);
    const wallet = await WalletAccount.findOne({ userId, currency });
    if (!wallet) throw new Error('Wallet not found');

    wallet.reserved = new Decimal(wallet.reserved).minus(amountDec).toString();
    wallet.available = new Decimal(wallet.available).plus(amountDec).toString();
    await wallet.save();

    const tx = await LedgerTransaction.create({
      userId,
      type: TransactionType.PREDICTION_RELEASE,
      status: TransactionStatus.COMPLETED,
      currency,
      amount: amountDec.toString(),
      balanceAfter: wallet.available,
      description: `Released ${amountDec} ${currency} from reservation`,
      idempotencyKey,
    });

    return tx;
  }

  async creditPredictionReward(userId: string, currency: Currency, amount: string, idempotencyKey: string) {
    const existing = await LedgerTransaction.findOne({ idempotencyKey });
    if (existing) return existing;

    const amountDec = new Decimal(amount);
    const wallet = await WalletAccount.findOne({ userId, currency });
    if (!wallet) throw new Error('Wallet not found');

    wallet.available = new Decimal(wallet.available).plus(amountDec).toString();
    await wallet.save();

    const tx = await LedgerTransaction.create({
      userId,
      type: TransactionType.DEMO_PREDICTION_REWARD,
      status: TransactionStatus.COMPLETED,
      currency,
      amount: amountDec.toString(),
      balanceAfter: wallet.available,
      description: `Prediction reward: +${amountDec} ${currency}`,
      idempotencyKey,
    });

    return tx;
  }

  async deductForPackage(userId: string, amount: string, packageName: string, idempotencyKey: string) {
    const existing = await LedgerTransaction.findOne({ idempotencyKey });
    if (existing) return existing;

    const amountDec = new Decimal(amount);
    const wallet = await WalletAccount.findOne({ userId, currency: Currency.DEMO_NOVA });
    if (!wallet) throw new Error('NOVA wallet not found');

    const available = new Decimal(wallet.available);
    if (available.lt(amountDec)) throw new Error('Insufficient NOVA balance');

    wallet.available = available.minus(amountDec).toString();
    await wallet.save();

    const tx = await LedgerTransaction.create({
      userId,
      type: TransactionType.PACKAGE_PURCHASE,
      status: TransactionStatus.COMPLETED,
      currency: Currency.DEMO_NOVA,
      amount: `-${amountDec.toString()}`,
      balanceAfter: wallet.available,
      description: `Package purchase: ${packageName}`,
      idempotencyKey,
    });

    return tx;
  }
}

export const walletService = new WalletService();
