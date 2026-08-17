import express from "express";
import { createOrder, verifyPayment, handleWebhook } from "../controller/payment.controller.js";
import { isAuthHeader } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/payments/create-order", isAuthHeader, createOrder);
router.post("/payments/verify", isAuthHeader, verifyPayment);
router.post("/payments/webhook", express.json({
  verify: (req: express.Request & { rawBody?: string }, _res, buf) => {
    req.rawBody = buf.toString();
  }
}), handleWebhook);

export default router;
