import { Router } from "express";
import { authRequired, sellerRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { sellerSettingsSchema } from "../schemas/seller.schema.js";
import { SellerDashboardService } from "../services/SellerDashboardService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const sellerRoutes = Router();
const dashboardService = new SellerDashboardService();

sellerRoutes.use(authRequired, sellerRequired);

sellerRoutes.get("/dashboard", asyncHandler(async (req, res) => {
  res.json(await dashboardService.summary(req.user!.sub));
}));

sellerRoutes.patch("/settings", validateBody(sellerSettingsSchema), asyncHandler(async (req, res) => {
  res.json(await dashboardService.updateSettings(req.user!.sub, req.body));
}));
