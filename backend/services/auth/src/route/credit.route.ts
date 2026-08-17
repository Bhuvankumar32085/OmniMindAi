import express from "express";
import { getCredits, getTransactions, getUsage } from "../controller/credit.controller.js";
import { isAuthHeader } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/credits", isAuthHeader, getCredits);
router.get("/credits/transactions", isAuthHeader, getTransactions);
router.get("/usage", isAuthHeader, getUsage);

export default router;
