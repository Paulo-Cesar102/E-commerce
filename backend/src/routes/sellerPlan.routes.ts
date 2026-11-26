import { Router } from "express";
import { authRequired, sellerRequired } from "../middlewares/auth.js";
import { SellerPlanService } from "../services/SellerPlanService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const sellerPlanRoutes = Router();
const sellerPlanService = new SellerPlanService();

sellerPlanRoutes.get("/plan", authRequired, sellerRequired, asyncHandler(async (req, res) => {
  res.json(await sellerPlanService.getPlan(req.user!.sub));
}));

sellerPlanRoutes.post("/subscription/checkout", authRequired, sellerRequired, asyncHandler(async (req, res) => {
  res.json(await sellerPlanService.startProSubscription(req.user!.sub));
}));

sellerPlanRoutes.post("/subscription/cancel", authRequired, sellerRequired, asyncHandler(async (req, res) => {
  res.json(await sellerPlanService.cancelProSubscription(req.user!.sub));
}));

sellerPlanRoutes.post("/subscription/mercado-pago/webhook", asyncHandler(async (req, res) => {
  res.json(await sellerPlanService.processMercadoPagoWebhook({
    body: req.body,
    query: req.query,
    signature: req.header("x-signature") ?? undefined,
    requestId: req.header("x-request-id") ?? undefined,
  }));
}));
