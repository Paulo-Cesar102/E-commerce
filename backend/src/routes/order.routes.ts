import { Router } from "express";
import { authRequired, sellerRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { cancelOrderSchema, checkoutSchema, paymentWebhookSchema, returnOrderSchema, updateOrderStatusSchema } from "../schemas/order.schema.js";
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

orderRoutes.post("/:id/cancel", authRequired, validateBody(cancelOrderSchema), asyncHandler(async (req, res) => {
  res.json(await orderService.cancelByCustomer(req.user!.sub, String(req.params.id), req.body.reason));
}));

orderRoutes.post("/:id/return", authRequired, validateBody(returnOrderSchema), asyncHandler(async (req, res) => {
  res.json(await orderService.requestReturn(req.user!.sub, String(req.params.id), req.body.reason));
}));

orderRoutes.post("/payments/mercado-pago/webhook", validateBody(paymentWebhookSchema), asyncHandler(async (req, res) => {
  res.json(await orderService.processMercadoPagoWebhook({
    body: req.body,
    query: req.query,
    signature: req.header("x-signature") ?? undefined,
    requestId: req.header("x-request-id") ?? undefined,
  }));
}));

orderRoutes.patch("/:id/status", authRequired, sellerRequired, validateBody(updateOrderStatusSchema), asyncHandler(async (req, res) => {
  res.json(await orderService.updateSellerOrder(req.user!.sub, String(req.params.id), req.body.status, req.body.correiosTrackingCode));
}));
