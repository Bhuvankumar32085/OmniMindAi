import express from "express";
import { login, logout } from "../controller/user.controller.js";
const router = express.Router();

router.post("/login-signup", login);
router.get("/logout", logout);

export default router;
