import express from "express";
import { isAuthHeader, isAdmin } from "../middlewares/auth.middleware.js";
import { getActivePlans } from "../controller/plan.controller.js";
import { getPlanById } from "../controller/plan.controller.js";
import { adminGetPlans } from "../controller/plan.controller.js";
import { adminCreatePlan } from "../controller/plan.controller.js";
import { adminUpdatePlan } from "../controller/plan.controller.js";
import { adminDeletePlan } from "../controller/plan.controller.js";

const router = express.Router();

// Public/User plan routes
router.get("/plans", getActivePlans);
router.get("/plans/:id", getPlanById);

// Admin plan routes
router.get("/admin/plans", isAuthHeader, isAdmin, adminGetPlans);
router.post("/admin/plans", isAuthHeader, isAdmin, adminCreatePlan);
router.patch("/admin/plans/:id", isAuthHeader, isAdmin, adminUpdatePlan);
router.delete("/admin/plans/:id", isAuthHeader, isAdmin, adminDeletePlan);

export default router;
