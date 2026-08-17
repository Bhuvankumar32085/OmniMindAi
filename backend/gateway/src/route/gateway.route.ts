import express from "express";
import { getCurrentUser } from "../controller/gateway.controller.js";
import { isAuth } from "../middleware/auth.js";
const router = express.Router();

router.get("/me",isAuth, getCurrentUser);

export default router;
