import express from "express";
import {
  getUsers,
  getUserById,
  adjustUserCredits,
  getPurchases,
  getCreditTransactions,
  getAIUsages,
} from "../controller/admin.controller.js";
import { isAuthHeader, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use("/admin", isAuthHeader, isAdmin);

router.get("/admin/users", getUsers);
router.get("/admin/users/:id", getUserById);
router.post("/admin/users/:id/credits/adjust", adjustUserCredits);

router.get("/admin/purchases", getPurchases);
router.get("/admin/credit-transactions", getCreditTransactions);
router.get("/admin/usage", getAIUsages);

export default router;
