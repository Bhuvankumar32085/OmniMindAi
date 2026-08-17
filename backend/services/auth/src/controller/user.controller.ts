import { getAuth } from "firebase-admin/auth";
import tryCatch from "../middlewares/tryCatch.js";
import { app } from "../configs/firebase.js";
import User, { UserRole } from "../model/user.model.js";
import CreditAccount from "../model/creditAccount.model.js";
import CreditTransaction, { TransactionType } from "../model/creditTransaction.model.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { isProduction } from "../configs/env.js";
import redis from "../configs/redis.js";

export const ensureUserCreditAccount = async (userId: string) => {
  let account = await CreditAccount.findOne({ userId });
  if (!account) {
    account = await CreditAccount.create({
      userId,
      balance: 100,
      totalGranted: 100,
      totalPurchased: 0,
      totalConsumed: 0,
      reserved: 0,
    });

    await CreditTransaction.create({
      userId,
      type: TransactionType.FREE_GRANT,
      amount: 100,
      balanceBefore: 0,
      balanceAfter: 100,
      source: "WELCOME_BONUS",
      referenceId: `welcome_${userId}`,
      description: "Initial 100 Free AI Credits",
    }).catch((err) => {
      // Ignore duplicate key error if already logged
      if (err.code !== 11000) throw err;
    });
  }
  return account;
};

export const login = tryCatch(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return sendError(res, "Token is required", null, 401);
  }

  const decoded = await getAuth(app).verifyIdToken(token);

  let user = await User.findOne({ firebaseUID: decoded.uid });

  let message = "Login Successfully";

  if (!user) {
    user = await User.create({
      firebaseUID: decoded.uid,
      name: decoded.name!,
      email: decoded.email!,
      avatar: decoded.picture!,
      role: UserRole.USER,
    });

    message = "Account Created And Login Successfully";
    try {
      await redis.del("admin:users");
    } catch (err) {
      console.error("Failed to clear admin:users cache on signup:", err);
    }
  } else if (!user.role) {
    user.role = UserRole.USER;
    await user.save();
  }

  // Ensure credit account exists (Idempotent initial grant)
  await ensureUserCreditAccount(user._id.toString());

  // Session create for both Login & Signup
  const sessionId = crypto.randomUUID();

  res.cookie("session", sessionId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  await redis.set(
    `session-${sessionId}`,
    JSON.stringify({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role || UserRole.USER,
    }),
    "EX",
    7 * 24 * 60 * 60,
  );

  const userData = typeof user.toObject === "function" ? user.toObject() : user;
  return sendSuccess(res, message, {
    ...userData,
    sessionId,
  });
});

export const logout = tryCatch(async (req, res) => {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

  const sessionId =
    bearerToken ||
    (req.headers["x-session-id"] as string) ||
    req.cookies?.session;

  if (!sessionId) {
    return sendError(res, "SessionId Not Found In Your cookies or headers", null, 404);
  }

  await redis.del(`session-${sessionId}`);

  res.clearCookie("session", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });

  return sendSuccess(res, " Logout Successfully");
});

