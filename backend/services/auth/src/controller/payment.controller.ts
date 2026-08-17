import crypto from "crypto";
import tryCatch from "../middlewares/tryCatch.js";
import Plan from "../model/plan.model.js";
import Purchase, { PurchaseStatus } from "../model/purchase.model.js";
import CreditAccount from "../model/creditAccount.model.js";
import CreditTransaction, { TransactionType } from "../model/creditTransaction.model.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { ensureUserCreditAccount } from "./user.controller.js";
import redis from "../configs/redis.js";

export const createOrder = tryCatch(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  const { planId } = req.body;

  if (!userId) {
    return sendError(res, "Unauthorized", null, 401);
  }

  if (!planId) {
    return sendError(res, "planId is required", null, 400);
  }

  // Load trusted plan from MongoDB
  const plan = await Plan.findById(planId);
  if (!plan) {
    return sendError(res, "Plan not found", null, 404);
  }

  if (!plan.isActive) {
    return sendError(res, "This plan is currently inactive and cannot be purchased", null, 400);
  }

  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

  let razorpayOrderId = "";

  if (keyId && keySecret && !keyId.includes("dummy")) {
    try {
      const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          amount: plan.price, // Amount in paise from MongoDB
          currency: plan.currency || "INR",
          receipt: `rcpt_${Date.now()}_${userId.substring(0, 6)}`,
          notes: {
            userId,
            planId: plan._id.toString(),
            credits: plan.credits.toString(),
          },
        }),
      });

      const orderData = (await rzpResponse.json()) as { id?: string; error?: { description?: string } };
      if (!rzpResponse.ok || !orderData.id) {
        console.error("Razorpay API order creation error:", orderData);
        return sendError(
          res,
          orderData.error?.description || "Failed to create order with Razorpay",
          null,
          500
        );
      }

      razorpayOrderId = orderData.id;
    } catch (err: unknown) {
      console.error("Razorpay fetch error:", err);
      return sendError(res, "Razorpay connection error", null, 500);
    }
  } else {
    // Fallback for development/testing when keys are not configured yet
    razorpayOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  const purchase = await Purchase.create({
    userId,
    planId: plan._id.toString(),
    amount: plan.price,
    currency: plan.currency || "INR",
    creditsGranted: plan.credits,
    status: PurchaseStatus.PENDING,
    razorpayOrderId,
  });

  return sendSuccess(res, "Order created successfully", {
    orderId: purchase.razorpayOrderId,
    amount: plan.price,
    currency: plan.currency,
    key: keyId || "rzp_test_dummy",
    planName: plan.name,
    credits: plan.credits,
  });
});

export const verifyPayment = tryCatch(async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!userId) {
    return sendError(res, "Unauthorized", null, 401);
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return sendError(
      res,
      "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
      null,
      400
    );
  }

  const purchase = await Purchase.findOne({ razorpayOrderId: razorpay_order_id });
  if (!purchase) {
    return sendError(res, "Purchase order not found", null, 404);
  }

  // Idempotency check: If already completed successfully, return success without duplicate credits
  if (purchase.status === PurchaseStatus.SUCCESS) {
    const account = await CreditAccount.findOne({ userId });
    return sendSuccess(res, "Payment verified successfully (Already processed)", {
      balance: account?.balance || 0,
      alreadyProcessed: true,
    });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

  // Verify HMAC SHA256 Signature
  let isValid = false;
  if (keySecret) {
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    isValid = expectedSignature === razorpay_signature;
  } else if (razorpay_order_id.startsWith("order_test_")) {
    // Development fallback if keys missing
    isValid = razorpay_signature === `sig_${razorpay_order_id}`;
  }

  if (!isValid) {
    purchase.status = PurchaseStatus.FAILED;
    await purchase.save();
    return sendError(res, "Invalid payment signature", null, 400);
  }

  // Update purchase status
  purchase.status = PurchaseStatus.SUCCESS;
  purchase.razorpayPaymentId = razorpay_payment_id;
  purchase.razorpaySignature = razorpay_signature;
  await purchase.save();

  // Grant credits atomically to user's CreditAccount
  await ensureUserCreditAccount(userId);
  const updatedAccount = await CreditAccount.findOneAndUpdate(
    { userId },
    {
      $inc: {
        balance: purchase.creditsGranted,
        totalPurchased: purchase.creditsGranted,
      },
    },
    { new: true }
  );

  const newBalance = updatedAccount ? updatedAccount.balance : purchase.creditsGranted;

  // Record CreditTransaction idempotently
  try {
    await CreditTransaction.create({
      userId,
      type: TransactionType.PURCHASE,
      amount: purchase.creditsGranted,
      balanceBefore: newBalance - purchase.creditsGranted,
      balanceAfter: newBalance,
      source: "RAZORPAY",
      referenceId: razorpay_payment_id,
      description: `Purchased ${purchase.creditsGranted} credits via Razorpay`,
    });
  } catch (err: unknown) {
    // Ignore duplicate key error on referenceId
    if ((err as { code?: number }).code !== 11000) {
      console.error("CreditTransaction create error:", err);
    }
  }

  // Clear Redis cache for user credits, transactions, and admin lists
  try {
    await redis.del(
      `user:credits:${userId}`,
      `user:tx:${userId}`,
      "admin:purchases",
      "admin:credit_tx",
      "admin:users",
      `admin:user:${userId}`
    );
  } catch (err) {
    console.error("Failed to clear user credit cache in Redis:", err);
  }

  return sendSuccess(res, "Payment verified and credits added successfully", {
    balance: newBalance,
    creditsAdded: purchase.creditsGranted,
  });
});

export const handleWebhook = tryCatch(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  const signature = req.headers["x-razorpay-signature"] as string;

  if (webhookSecret && signature) {
    const rawBody = (req as unknown as { rawBody?: string }).rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }
  }

  const event = req.body?.event;
  const payload = req.body?.payload;

  if (event === "payment.captured" || event === "order.paid") {
    const entity = payload?.payment?.entity || payload?.order?.entity;
    const orderId = entity?.order_id || entity?.id;
    const paymentId = entity?.id || entity?.payment_id;

    if (orderId) {
      const purchase = await Purchase.findOne({ razorpayOrderId: orderId });
      if (purchase && purchase.status !== PurchaseStatus.SUCCESS) {
        purchase.status = PurchaseStatus.SUCCESS;
        if (paymentId) purchase.razorpayPaymentId = paymentId;
        await purchase.save();

        await ensureUserCreditAccount(purchase.userId);
        const updatedAccount = await CreditAccount.findOneAndUpdate(
          { userId: purchase.userId },
          {
            $inc: {
              balance: purchase.creditsGranted,
              totalPurchased: purchase.creditsGranted,
            },
          },
          { new: true }
        );

        const newBalance = updatedAccount ? updatedAccount.balance : purchase.creditsGranted;

        try {
          await CreditTransaction.create({
            userId: purchase.userId,
            type: TransactionType.PURCHASE,
            amount: purchase.creditsGranted,
            balanceBefore: newBalance - purchase.creditsGranted,
            balanceAfter: newBalance,
            source: "RAZORPAY_WEBHOOK",
            referenceId: paymentId || `webhook_${orderId}`,
            description: `Purchased ${purchase.creditsGranted} credits via Webhook`,
          });
        } catch (err: unknown) {
          if ((err as { code?: number }).code !== 11000) {
            console.error("Webhook transaction error:", err);
          }
        }

        // Clear Redis cache for user credits, transactions, and admin lists
        try {
          await redis.del(
            `user:credits:${purchase.userId}`,
            `user:tx:${purchase.userId}`,
            "admin:purchases",
            "admin:credit_tx",
            "admin:users",
            `admin:user:${purchase.userId}`
          );
        } catch (err) {
          console.error("Failed to clear webhook user cache in Redis:", err);
        }
      }
    }
  } else if (event === "payment.failed") {
    const orderId = payload?.payment?.entity?.order_id;
    if (orderId) {
      await Purchase.updateOne(
        { razorpayOrderId: orderId, status: PurchaseStatus.PENDING },
        { status: PurchaseStatus.FAILED }
      );
    }
  }

  return res.status(200).json({ status: "ok" });
});
