import { Router } from "express";
import { authRequired, sellerRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { cancelOrderSchema, checkoutSchema, paymentWebhookSchema, returnOrderSchema, updateOrderStatusSchema } from "../schemas/order.schema.js";
import { OrderService } from "../services/OrderService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { Server } from "socket.io";
import prisma from "../../prisma/prisma.js";

const notifyAdminDashboard = (req: { app: { locals: { io?: Server } } }, type: string) => {
  req.app.locals.io?.to("admin:dashboard").emit("admin:refresh", { type });
};

async function notifyAdmins(title: string, body: string, data: object) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length) await prisma.notification.createMany({ data: admins.map((admin) => ({ userId: admin.id, type: "ADMIN_ACTIVITY", title, body, data })) });
}

export const orderRoutes = Router();
const orderService = new OrderService();

orderRoutes.get("/mine", authRequired, asyncHandler(async (req, res) => {
  res.json(await orderService.listMine(req.user!.sub));
}));

orderRoutes.post("/checkout", authRequired, validateBody(checkoutSchema), asyncHandler(async (req, res) => {
  const result = await orderService.checkout(req.user!.sub, req.body);
  await notifyAdmins("Novo pedido criado", `${result.length} pedido(s) aguardando pagamento.`, { type: "ORDER_CREATED" });
  notifyAdminDashboard(req, "ORDER_CREATED");
  res.status(201).json(result);
}));

orderRoutes.post("/:id/cancel", authRequired, validateBody(cancelOrderSchema), asyncHandler(async (req, res) => {
  res.json(await orderService.cancelByCustomer(req.user!.sub, String(req.params.id), req.body.reason));
}));

orderRoutes.post("/:id/return", authRequired, validateBody(returnOrderSchema), asyncHandler(async (req, res) => {
  res.json(await orderService.requestReturn(req.user!.sub, String(req.params.id), req.body.reason));
}));

orderRoutes.post("/payments/mercado-pago/webhook", validateBody(paymentWebhookSchema), asyncHandler(async (req, res) => {
  const result = await orderService.processMercadoPagoWebhook({
    body: req.body,
    query: req.query,
    signature: req.header("x-signature") ?? undefined,
    requestId: req.header("x-request-id") ?? undefined,
  });
  await notifyAdmins("Pagamento atualizado", "Um pagamento do Mercado Pago foi atualizado.", { type: "PAYMENT_UPDATED" });
  notifyAdminDashboard(req, "PAYMENT_UPDATED");
  res.json(result);
}));

orderRoutes.patch("/:id/status", authRequired, sellerRequired, validateBody(updateOrderStatusSchema), asyncHandler(async (req, res) => {
  const result = await orderService.updateSellerOrder(req.user!.sub, String(req.params.id), req.body.status, req.body.correiosTrackingCode);
  notifyAdminDashboard(req, "ORDER_STATUS_UPDATED");
  res.json(result);
}));
