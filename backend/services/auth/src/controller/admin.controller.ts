import tryCatch from "../middlewares/tryCatch.js";
import User from "../model/user.model.js";
import CreditAccount from "../model/creditAccount.model.js";
import CreditTransaction, { TransactionType } from "../model/creditTransaction.model.js";
import AIUsage from "../model/aiUsage.model.js";
import Purchase from "../model/purchase.model.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { ensureUserCreditAccount } from "./user.controller.js";
import redis from "../configs/redis.js";

export const getUsers = tryCatch(async (req, res) => {
  const cachedUsers = await redis.get("admin:users");
  if (cachedUsers) {
    return sendSuccess(res, "Users fetched successfully (cached)", JSON.parse(cachedUsers));
  }

  const users = await User.find().sort({ createdAt: -1 });

  // Map users with credit accounts
  const userIds = users.map((u) => u._id.toString());
  const accounts = await CreditAccount.find({ userId: { $in: userIds } });

  const accountMap = new Map(accounts.map((a) => [a.userId, a]));

  const result = users.map((user) => {
    const account = accountMap.get(user._id.toString());
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role || "user",
      createdAt: user.createdAt,
      credits: account
        ? {
            balance: account.balance,
            totalGranted: account.totalGranted,
            totalPurchased: account.totalPurchased,
            totalConsumed: account.totalConsumed,
          }
        : { balance: 0, totalGranted: 0, totalPurchased: 0, totalConsumed: 0 },
    };
  });

  await redis.set("admin:users", JSON.stringify(result), "EX", 300); // Cache for 5 minutes

  return sendSuccess(res, "Users fetched successfully", result);
});

export const getUserById = tryCatch(async (req, res) => {
  const { id } = req.params;

  const cacheKey = `admin:user:${id}`;
  const cachedUserDetail = await redis.get(cacheKey);
  if (cachedUserDetail) {
    return sendSuccess(res, "User details fetched successfully (cached)", JSON.parse(cachedUserDetail));
  }

  const user = await User.findById(id);
  if (!user) {
    return sendError(res, "User not found", null, 404);
  }

  const account = await ensureUserCreditAccount(user._id.toString());
  const transactions = await CreditTransaction.find({ userId: user._id.toString() }).sort({ createdAt: -1 });
  const usages = await AIUsage.find({ userId: user._id.toString() }).sort({ createdAt: -1 });

  const result = {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role || "user",
      createdAt: user.createdAt,
    },
    creditAccount: account,
    transactions,
    usages,
  };

  await redis.set(cacheKey, JSON.stringify(result), "EX", 300); // Cache for 5 minutes

  return sendSuccess(res, "User details fetched successfully", result);
});

export const adjustUserCredits = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { amount, description } = req.body;
  const adminId = req.headers["x-user-id"] as string;

  const adjustment = Number(amount);
  if (isNaN(adjustment) || adjustment === 0) {
    return sendError(res, "Amount must be a non-zero number", null, 400);
  }

  const user = await User.findById(id);
  if (!user) {
    return sendError(res, "User not found", null, 404);
  }

  const account = await ensureUserCreditAccount(user._id.toString());
  const balanceBefore = account.balance;

  if (balanceBefore + adjustment < 0) {
    return sendError(
      res,
      `Cannot reduce balance below 0. Current balance is ${balanceBefore}`,
      null,
      400
    );
  }

  const updatedAccount = await CreditAccount.findOneAndUpdate(
    { userId: user._id.toString() },
    {
      $inc: {
        balance: adjustment,
        totalGranted: adjustment > 0 ? adjustment : 0,
      },
    },
    { new: true }
  );

  const balanceAfter = updatedAccount ? updatedAccount.balance : balanceBefore + adjustment;

  const transaction = await CreditTransaction.create({
    userId: user._id.toString(),
    type: TransactionType.ADMIN_ADJUSTMENT,
    amount: adjustment,
    balanceBefore,
    balanceAfter,
    source: `ADMIN_${adminId || "SYSTEM"}`,
    referenceId: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    description: description || `Admin manual credit adjustment: ${adjustment > 0 ? "+" : ""}${adjustment}`,
  });

  // Invalidate Redis caches for user credits, transactions, and admin lists
  try {
    await redis.del(
      `user:credits:${user._id.toString()}`,
      `user:tx:${user._id.toString()}`,
      "admin:users",
      `admin:user:${user._id.toString()}`,
      "admin:credit_tx"
    );
  } catch (err) {
    console.error("Failed to clear Redis cache on credit adjustment:", err);
  }

  return sendSuccess(res, "User credit balance adjusted successfully", {
    user: { _id: user._id, name: user.name, email: user.email },
    creditAccount: updatedAccount,
    transaction,
  });
});

export const getPurchases = tryCatch(async (req, res) => {
  const cachedPurchases = await redis.get("admin:purchases");
  if (cachedPurchases) {
    return sendSuccess(res, "Purchases fetched successfully (cached)", JSON.parse(cachedPurchases));
  }

  const purchases = await Purchase.find().sort({ createdAt: -1 });
  await redis.set("admin:purchases", JSON.stringify(purchases), "EX", 300); // Cache for 5 minutes

  return sendSuccess(res, "Purchases fetched successfully", purchases);
});

export const getCreditTransactions = tryCatch(async (req, res) => {
  const cachedTx = await redis.get("admin:credit_tx");
  if (cachedTx) {
    return sendSuccess(res, "Credit transactions fetched successfully (cached)", JSON.parse(cachedTx));
  }

  const transactions = await CreditTransaction.find().sort({ createdAt: -1 });
  await redis.set("admin:credit_tx", JSON.stringify(transactions), "EX", 300); // Cache for 5 minutes

  return sendSuccess(res, "Credit transactions fetched successfully", transactions);
});

export const getAIUsages = tryCatch(async (req, res) => {
  const cachedUsages = await redis.get("admin:ai_usage");
  if (cachedUsages) {
    return sendSuccess(res, "AI Usages fetched successfully (cached)", JSON.parse(cachedUsages));
  }

  const usages = await AIUsage.find().sort({ createdAt: -1 });
  await redis.set("admin:ai_usage", JSON.stringify(usages), "EX", 300); // Cache for 5 minutes

  return sendSuccess(res, "AI Usages fetched successfully", usages);
});
