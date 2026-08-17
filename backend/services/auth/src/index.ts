import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./configs/db.js";
import cookieParser from "cookie-parser";
import userRoute from "./route/user.route.js";
import creditRoute from "./route/credit.route.js";
import planRoute from "./route/plan.route.js";
import paymentRoute from "./route/payment.route.js";
import adminRoute from "./route/admin.route.js";
import cors from "cors";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;

app.use(express.json());
app.use(cookieParser());

app.get("/check", (_, res) => {
  res.send("Auth");
});

app.use("/", userRoute);
app.use("/", creditRoute);
app.use("/", planRoute);
app.use("/", paymentRoute);
app.use("/", adminRoute);

connectDB()
  .then(() => {
    console.log("Connected to the database successfully");
    app.listen(PORT, () => {
      console.log(`Auth Service is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
  });

