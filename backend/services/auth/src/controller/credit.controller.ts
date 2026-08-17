import tryCatch from "../middlewares/tryCatch.js";
import CreditAccount from "../model/creditAccount.model.js";
import CreditTransaction from "../model/creditTransaction.model.js";
import AIUsage from "../model/aiUsage.model.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { ensureUserCreditAccount } from "./user.controller.js";
import redis from "../configs/redis.js";

export const getCredits = tryCatch(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    return sendError(res, "Unauthorized", null, 401);
  }

  const cacheKey = `user:credits:${userId}`;
  if (req.query.fresh === "true") {
    await redis.del(cacheKey);
  } else {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return sendSuccess(res, "Credit account fetched successfully (cached)", JSON.parse(cachedData));
    }
  }

  const account = await ensureUserCreditAccount(userId);
  const result = {
    balance: account.balance,
    totalGranted: account.totalGranted,
    totalPurchased: account.totalPurchased,
    totalConsumed: account.totalConsumed,
    reserved: account.reserved,
  };

  await redis.set(cacheKey, JSON.stringify(result), "EX", 300); // Cache for 5 minutes

  return sendSuccess(res, "Credit account fetched successfully", result);
});

export const getTransactions = tryCatch(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    return sendError(res, "Unauthorized", null, 401);
  }

  const cacheKey = `user:tx:${userId}`;
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    return sendSuccess(res, "Transactions fetched successfully (cached)", JSON.parse(cachedData));
  }

  const transactions = await CreditTransaction.find({ userId }).sort({
    createdAt: -1,
  });

  await redis.set(cacheKey, JSON.stringify(transactions), "EX", 300); // Cache for 5 minutes

  return sendSuccess(res, "Transactions fetched successfully", transactions);
});

export const getUsage = tryCatch(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    return sendError(res, "Unauthorized", null, 401);
  }

  const cacheKey = `user:usage:${userId}`;
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    return sendSuccess(res, "Usage history fetched successfully (cached)", JSON.parse(cachedData));
  }

  const usages = await AIUsage.find({ userId }).sort({ createdAt: -1 });

  await redis.set(cacheKey, JSON.stringify(usages), "EX", 300); // Cache for 5 minutes

  return sendSuccess(res, "Usage history fetched successfully", usages);
});
