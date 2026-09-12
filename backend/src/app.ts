import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authRoutes } from "./routes/auth.routes.js";
import { productRoutes } from "./routes/product.routes.js";
import { cartRoutes } from "./routes/cart.routes.js";
import { orderRoutes } from "./routes/order.routes.js";
import { sellerRoutes } from "./routes/seller.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";
import { addressRoutes } from "./routes/address.routes.js";
import { wishlistRoutes } from "./routes/wishlist.routes.js";
import { notificationRoutes } from "./routes/notification.routes.js";
import { privacyRoutes } from "./routes/privacy.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { uploadsDirectory } from "./middlewares/upload.js";
import fs from "node:fs";

export const app = express();
if (env.TRUST_PROXY) app.set("trust proxy", 1);
fs.mkdirSync(uploadsDirectory, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", (_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(uploadsDirectory));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", orderRoutes);
app.use("/seller", sellerRoutes);
app.use("/chats", chatRoutes);
app.use("/addresses", addressRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/notifications", notificationRoutes);
app.use("/privacy", privacyRoutes);
app.use("/admin", adminRoutes);
app.use(errorHandler);
