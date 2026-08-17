import tryCatch from "../middlewares/tryCatch.js";
import Plan from "../model/plan.model.js";
import Purchase, { PurchaseStatus } from "../model/purchase.model.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import redis from "../configs/redis.js";

// Helper function to invalidate plan caches in Redis
export const clearPlanCache = async (planId?: string) => {
  try {
    const keys = ["plans:active", "plans:all"];
    if (planId) {
      keys.push(`plan:${planId}`);
    }
    await redis.del(...keys);
  } catch (err) {
    console.error("Failed to clear plan cache in Redis:", err);
  }
};

// Public User Endpoints
export const getActivePlans = tryCatch(async (req, res) => {
  const cachedPlans = await redis.get("plans:active");
  if (cachedPlans) {
    return sendSuccess(res, "Active plans fetched successfully (cached)", JSON.parse(cachedPlans));
  }

  const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
  await redis.set("plans:active", JSON.stringify(plans), "EX", 3600); // Cache for 1 hour

  return sendSuccess(res, "Active plans fetched successfully", plans);
});

export const getPlanById = tryCatch(async (req, res) => {
  const { id } = req.params;

  const cachedPlan = await redis.get(`plan:${id}`);
  if (cachedPlan) {
    return sendSuccess(res, "Plan fetched successfully (cached)", JSON.parse(cachedPlan));
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return sendError(res, "Plan not found", null, 404);
  }

  await redis.set(`plan:${id}`, JSON.stringify(plan), "EX", 3600); // Cache for 1 hour

  return sendSuccess(res, "Plan fetched successfully", plan);
});

// Admin Endpoints
export const adminGetPlans = tryCatch(async (req, res) => {
  const cachedPlans = await redis.get("plans:all");
  if (cachedPlans) {
    return sendSuccess(res, "All plans fetched successfully (cached)", JSON.parse(cachedPlans));
  }

  const plans = await Plan.find().sort({ createdAt: -1 });
  await redis.set("plans:all", JSON.stringify(plans), "EX", 600); // Cache for 10 minutes

  return sendSuccess(res, "All plans fetched successfully", plans);
});

export const adminCreatePlan = tryCatch(async (req, res) => {
  const { name, description, price, credits, currency } = req.body;
  const userId = req.headers["x-user-id"] as string;

  if (!name || price === undefined || !credits) {
    return sendError(
      res,
      "Name, price (in paise or currency unit), and credits are required",
      null,
      400
    );
  }

  const numericPrice = Number(price);
  const numericCredits = Number(credits);

  if (numericPrice <= 0 || numericCredits <= 0) {
    return sendError(
      res,
      "Price and credits must be positive numbers",
      null,
      400
    );
  }

  const plan = await Plan.create({
    name: name.trim(),
    description: description ? description.trim() : "",
    price: Math.round(numericPrice), // Store in paise
    credits: Math.round(numericCredits),
    currency: currency || "INR",
    isActive: true,
    createdBy: userId,
  });

  await clearPlanCache();

  return sendSuccess(res, "Plan created successfully", plan, 201);
});

export const adminUpdatePlan = tryCatch(async (req, res) => {
  const { id } = req.params;
  const { name, description, price, credits, currency, isActive } = req.body;

  const plan = await Plan.findById(id);
  if (!plan) {
    return sendError(res, "Plan not found", null, 404);
  }

  const planIdStr = (Array.isArray(id) ? id[0] : id) || "";

  if (name !== undefined) plan.name = name.trim();
  if (description !== undefined) plan.description = description.trim();
  if (price !== undefined) plan.price = Math.round(Number(price));
  if (credits !== undefined) plan.credits = Math.round(Number(credits));
  if (currency !== undefined) plan.currency = currency;
  if (isActive !== undefined) plan.isActive = Boolean(isActive);

  await plan.save();
  await clearPlanCache(planIdStr);

  return sendSuccess(res, "Plan updated successfully", plan);
});

export const adminDeletePlan = tryCatch(async (req, res) => {
  const { id } = req.params;
  const planIdStr = (Array.isArray(id) ? id[0] : id) || "";

  const plan = await Plan.findById(id);
  if (!plan) {
    return sendError(res, "Plan not found", null, 404);
  }

  // Check if plan has been purchased by any user
  const purchaseCount = await Purchase.countDocuments({
    planId: planIdStr,
    status: PurchaseStatus.SUCCESS,
  });

  if (purchaseCount > 0) {
    // Soft delete / deactivate to preserve purchase history integrity
    plan.isActive = false;
    await plan.save();
    await clearPlanCache(planIdStr);
    return sendSuccess(
      res,
      "Plan has existing purchases. Deactivated successfully instead of hard delete.",
      plan
    );
  } else {
    // Hard delete if never purchased
    await Plan.findByIdAndDelete(id);
    await clearPlanCache(planIdStr);
    return sendSuccess(res, "Plan deleted successfully");
  }
});
