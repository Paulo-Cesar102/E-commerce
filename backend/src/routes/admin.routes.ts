import { Router } from "express";
import { z } from "zod";
import prisma from "../../prisma/prisma.js";
import { adminRequired, authRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { Prisma } from "../../generated/prisma/index.js";
import type { Server } from "socket.io";
import type { Request } from "express";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";

const notifyAdminDashboard = (req: Request, type: string) => {
  req.app.locals.io?.to("admin:dashboard").emit("admin:refresh", { type });
};

const couponSchema = z.object({ code: z.string().trim().min(2).max(40), type: z.enum(["PERCENT", "FIXED"]), value: z.number().positive(), minOrderValue: z.number().nonnegative().optional(), maxUses: z.number().int().positive().nullable().optional(), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().nullable().optional(), active: z.boolean().optional() });
const kycSchema = z.object({ approvalStatus: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]), kycReviewNote: z.string().max(500).optional() });
const withdrawalSchema = z.object({ amount: z.number().positive().max(1_000_000) });
const dateRangeSchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });

export const adminRoutes = Router();
adminRoutes.use(authRequired, adminRequired);
adminRoutes.get("/overview", asyncHandler(async (_req, res) => {
  const paidOrderWhere: Prisma.OrderWhereInput = { payment: { status: "APPROVED" }, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } };
  const [pendingKyc, products, orders, coupons, paidOrders, paidOrderCount, feeOrders, sellers, sellerSales, supportChats, withdrawals] = await Promise.all([
    prisma.sellerProfile.findMany({ where: { approvalStatus: "PENDING" }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { kycSubmittedAt: "asc" } }),
    prisma.product.findMany({ include: { seller: { select: { storeName: true } }, category: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.order.findMany({ include: { customer: { select: { name: true, email: true } }, seller: { select: { storeName: true } }, payment: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.order.aggregate({ where: paidOrderWhere, _sum: { total: true, platformFee: true } }),
    prisma.order.count({ where: paidOrderWhere }),
    prisma.order.findMany({ where: paidOrderWhere, select: { id: true, platformFee: true, total: true, createdAt: true, seller: { select: { storeName: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.sellerProfile.findMany({ include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { products: true, orders: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.order.groupBy({ by: ["sellerId"], where: paidOrderWhere, _sum: { total: true, platformFee: true }, _count: { id: true } }),
    prisma.chat.findMany({ where: { status: "OPEN" }, include: { buyer: { select: { name: true, email: true } }, seller: { select: { storeName: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.withdrawal.findMany({ where: { sellerId: null }, orderBy: { requestedAt: "desc" }, take: 30 }),
  ]);
  const chartOrders = await prisma.order.findMany({ where: paidOrderWhere, select: { total: true, platformFee: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const salesChart = chartOrders.reduce<Record<string, { sales: number; fees: number }>>((chart, order) => { const key = order.createdAt.toISOString().slice(0, 10); const current = chart[key] ?? { sales: 0, fees: 0 }; chart[key] = { sales: current.sales + Number(order.total), fees: current.fees + Number(order.platformFee) }; return chart; }, {});
  const requested = withdrawals.filter((withdrawal) => ["REQUESTED", "APPROVED"].includes(withdrawal.status)).reduce((sum, withdrawal) => sum + Number(withdrawal.amount), 0);
  const sellerSalesMap = Object.fromEntries(sellerSales.map((sale) => [sale.sellerId, { total: sale._sum.total ?? 0, platformFee: sale._sum.platformFee ?? 0, orders: sale._count.id }]));
  res.json({ pendingKyc, products, orders, coupons, sellers: sellers.map((seller) => ({ ...seller, sales: sellerSalesMap[seller.id] ?? { total: 0, platformFee: 0, orders: 0 } })), supportChats, withdrawals, finance: { grossSales: paidOrders._sum?.total ?? 0, platformFees: paidOrders._sum?.platformFee ?? 0, availableFees: Math.max(0, Number(paidOrders._sum?.platformFee ?? 0) - requested), pendingFees: requested, paidOrders: paidOrderCount, recentFees: feeOrders, salesChart } });
}));
adminRoutes.patch("/kyc/:sellerId", validateBody(kycSchema), asyncHandler(async (req, res) => {
  const result = await prisma.sellerProfile.update({ where: { id: String(req.params.sellerId) }, data: { approvalStatus: req.body.approvalStatus, kycReviewNote: req.body.kycReviewNote, kycReviewedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: req.user!.sub, action: `KYC_${req.body.approvalStatus}`, entityType: "SellerProfile", entityId: result.id, metadata: { note: req.body.kycReviewNote } } });
  notifyAdminDashboard(req, "KYC_UPDATED");
  res.json(result);
}));
adminRoutes.post("/coupons", validateBody(couponSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await prisma.coupon.create({ data: { ...req.body, code: req.body.code.toUpperCase() } }));
}));
adminRoutes.patch("/coupons/:id", validateBody(couponSchema.partial()), asyncHandler(async (req, res) => {
  res.json(await prisma.coupon.update({ where: { id: String(req.params.id) }, data: { ...req.body, ...(req.body.code ? { code: req.body.code.toUpperCase() } : {}) } }));
}));
adminRoutes.post("/withdrawals", validateBody(withdrawalSchema), asyncHandler(async (req, res) => {
  const admin = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { email: true } });
  if (!admin || admin.email.toLowerCase() !== env.ADMIN_WITHDRAWAL_EMAIL.toLowerCase()) throw new AppError(403, "Este administrador nao pode solicitar saques");
  const result = await prisma.withdrawal.create({ data: { amount: req.body.amount } });
  notifyAdminDashboard(req, "WITHDRAWAL_REQUESTED");
  res.status(201).json(result);
}));
adminRoutes.patch("/withdrawals/:id", validateBody(z.object({ status: z.enum(["APPROVED", "REJECTED", "PAID"]), note: z.string().max(500).optional() })), asyncHandler(async (req, res) => {
  const result = await prisma.withdrawal.update({ where: { id: String(req.params.id) }, data: { status: req.body.status, note: req.body.note, ...(req.body.status === "PAID" || req.body.status === "REJECTED" ? { processedAt: new Date() } : {}) } });
  await prisma.auditLog.create({ data: { userId: req.user!.sub, action: `WITHDRAWAL_${req.body.status}`, entityType: "Withdrawal", entityId: result.id, metadata: { amount: result.amount } } });
  notifyAdminDashboard(req, "WITHDRAWAL_UPDATED");
  res.json(result);
}));

adminRoutes.get("/orders", asyncHandler(async (req, res) => {
  const parsed = dateRangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Periodo invalido" });
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status as "PENDING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED" | "RETURN_REQUESTED" : undefined;
  const sellerId = typeof req.query.sellerId === "string" && req.query.sellerId ? req.query.sellerId : undefined;
  const customer = typeof req.query.customer === "string" && req.query.customer ? req.query.customer : undefined;
  const orders = await prisma.order.findMany({ where: { ...(status ? { status } : {}), ...(sellerId ? { sellerId } : {}), ...(customer ? { customer: { OR: [{ name: { contains: customer, mode: "insensitive" } }, { email: { contains: customer, mode: "insensitive" } }] } } : {}), ...(parsed.data.from || parsed.data.to ? { createdAt: { ...(parsed.data.from ? { gte: parsed.data.from } : {}), ...(parsed.data.to ? { lte: parsed.data.to } : {}) } } : {}) }, include: { customer: { select: { name: true, email: true } }, seller: { select: { id: true, storeName: true } }, payment: true }, orderBy: { createdAt: "desc" }, take: 200 });
  res.json(orders);
}));

adminRoutes.get("/sellers/:id", asyncHandler(async (req, res) => {
  const seller = await prisma.sellerProfile.findUnique({ where: { id: String(req.params.id) }, include: { user: { select: { id: true, name: true, email: true, createdAt: true } }, products: { include: { images: { take: 1 } }, orderBy: { createdAt: "desc" } }, orders: { include: { customer: { select: { name: true } }, payment: true }, orderBy: { createdAt: "desc" }, take: 100 } } });
  if (!seller) return res.status(404).json({ message: "Lojista nao encontrado" });
  res.json(seller);
}));

adminRoutes.patch("/sellers/:id/status", validateBody(z.object({ status: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]), note: z.string().max(500).optional() })), asyncHandler(async (req, res) => {
  const seller = await prisma.sellerProfile.update({ where: { id: String(req.params.id) }, data: { approvalStatus: req.body.status, kycReviewNote: req.body.note, kycReviewedAt: new Date() }, include: { user: { select: { name: true, email: true } } } });
  await prisma.auditLog.create({ data: { userId: req.user!.sub, action: `SELLER_${req.body.status}`, entityType: "SellerProfile", entityId: seller.id, metadata: { sellerEmail: seller.user.email, note: req.body.note } } });
  notifyAdminDashboard(req, "SELLER_STATUS_UPDATED");
  res.json(seller);
}));

adminRoutes.get("/audit", asyncHandler(async (_req, res) => {
  res.json(await prisma.auditLog.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 }));
}));

adminRoutes.get("/notifications", asyncHandler(async (req, res) => {
  res.json(await prisma.notification.findMany({ where: { userId: req.user!.sub }, orderBy: { createdAt: "desc" }, take: 100 }));
}));

adminRoutes.get("/export/orders.csv", asyncHandler(async (req, res) => {
  const parsed = dateRangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Periodo invalido" });
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status as "PENDING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED" | "RETURN_REQUESTED" : undefined;
  const customer = typeof req.query.customer === "string" && req.query.customer ? req.query.customer : undefined;
  const sellerId = typeof req.query.sellerId === "string" && req.query.sellerId ? req.query.sellerId : undefined;
  const orders = await prisma.order.findMany({ where: { ...(status ? { status } : {}), ...(sellerId ? { sellerId } : {}), ...(customer ? { customer: { OR: [{ name: { contains: customer, mode: "insensitive" } }, { email: { contains: customer, mode: "insensitive" } }] } } : {}), ...(parsed.data.from || parsed.data.to ? { createdAt: { ...(parsed.data.from ? { gte: parsed.data.from } : {}), ...(parsed.data.to ? { lte: parsed.data.to } : {}) } } : {}) }, select: { id: true, createdAt: true, status: true, total: true, customer: { select: { name: true, email: true } }, seller: { select: { storeName: true } } }, orderBy: { createdAt: "desc" }, take: 1000 });
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = ["id,data,status,total,cliente,email,loja", ...orders.map((order) => [order.id, new Date(order.createdAt).toLocaleDateString("pt-BR"), order.status, order.total, order.customer.name, order.customer.email, order.seller.storeName].map(escape).join(","))];
  res.type("text/csv; charset=utf-8").setHeader("Content-Disposition", "attachment; filename=pedidos-vitrine.csv").send(`\ufeff${rows.join("\n")}`);
}));