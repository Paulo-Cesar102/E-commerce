import { Router } from "express";
import { authRequired, sellerRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { checkoutSchema, paymentWebhookSchema, updateOrderStatusSchema } from "../schemas/order.schema.js";
import { OrderService } from "../services/OrderService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const orderRoutes = Router();
const orderService = new OrderService();

orderRoutes.get("/mine", authRequired, asyncHandler(async (req, res) => {
  res.json(await orderService.listMine(req.user!.sub));
}));

orderRoutes.post("/checkout", authRequired, validateBody(checkoutSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await orderService.checkout(req.user!.sub, req.body));
}));

orderRoutes.post("/payments/mercado-pago/webhook", validateBody(paymentWebhookSchema), asyncHandler(async (req, res) => {
  res.json(await orderService.applyPaymentWebhook(req.body));
}));

orderRoutes.patch("/:id/status", authRequired, sellerRequired, validateBody(updateOrderStatusSchema), asyncHandler(async (req, res) => {
  res.json(await orderService.updateSellerOrder(req.user!.sub, String(req.params.id), req.body.status, req.body.correiosTrackingCode));
}));
