import express from "express";
import dotenv from "dotenv";
import proxy from "express-http-proxy";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import gatewayRoute from "./route/gateway.route.js";
import proxyWithHeader from "./utils/proxyWithHeader.js";
import { isAuth } from "./middleware/auth.js";
import { isAdmin } from "./middleware/admin.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
          origin
        ) ||
        origin.endsWith(".cloudfront.net") ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({ message: "OK" });
});

app.use("/", gatewayRoute);
app.use("/auth", proxy(process.env.AUTH_SERVICE!));

// Auth service user endpoints proxied with path preservation
app.use("/me", isAuth, proxyWithHeader(process.env.AUTH_SERVICE!, { preservePath: true }));
app.use("/plans", proxyWithHeader(process.env.AUTH_SERVICE!, { preservePath: true }));
app.use("/payments", isAuth, proxyWithHeader(process.env.AUTH_SERVICE!, { preservePath: true }));
app.use("/credits", isAuth, proxyWithHeader(process.env.AUTH_SERVICE!, { preservePath: true }));

// Admin endpoints protected by isAuth + isAdmin guards
app.use("/admin", isAuth, isAdmin, proxyWithHeader(process.env.AUTH_SERVICE!, { preservePath: true }));

// Microservices proxied with auth headers (prefix stripped for Flask routes)
app.use("/chat", isAuth, proxyWithHeader(process.env.CHAT_SERVICE!));
app.use("/agent", isAuth, proxyWithHeader(process.env.AGENT_SERVICE!));

app.listen(PORT, () => {
  console.log(`API Gateway is running on port ${PORT}`);
});
