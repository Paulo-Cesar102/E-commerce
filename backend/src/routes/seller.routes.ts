import { Router } from "express";
import { authRequired, sellerRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { sellerSettingsSchema } from "../schemas/seller.schema.js";
import { SellerDashboardService } from "../services/SellerDashboardService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../../prisma/prisma.js";
import { z } from "zod";

export const sellerRoutes = Router();
const dashboardService = new SellerDashboardService();

sellerRoutes.use(authRequired, sellerRequired);

sellerRoutes.get("/dashboard", asyncHandler(async (req, res) => {
  res.json(await dashboardService.summary(req.user!.sub));
}));

sellerRoutes.patch("/settings", validateBody(sellerSettingsSchema), asyncHandler(async (req, res) => {
  res.json(await dashboardService.updateSettings(req.user!.sub, req.body));
}));

sellerRoutes.post("/withdrawals", validateBody(z.object({
  amount: z.number().positive().max(1_000_000),
  pixKey: z.string().trim().min(3).max(120),
})), asyncHandler(async (req, res) => {
  const withdrawal = await dashboardService.requestWithdrawal(req.user!.sub, req.body.amount, req.body.pixKey);
  req.app.locals.io?.to("admin:dashboard").emit("admin:refresh", { type: "SELLER_WITHDRAWAL_REQUESTED" });
  res.status(201).json(withdrawal);
}));
