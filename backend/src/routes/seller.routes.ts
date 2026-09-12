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

sellerRoutes.post("/withdrawals", validateBody(z.object({ amount: z.number().positive().max(1_000_000) })), asyncHandler(async (req, res) => {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
  if (!seller) return res.status(404).json({ message: "Lojista nao encontrado" });
  res.status(201).json(await prisma.withdrawal.create({ data: { amount: req.body.amount, sellerId: seller.id } }));
}));
