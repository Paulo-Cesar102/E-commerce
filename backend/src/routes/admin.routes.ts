import { Router } from "express";
import { z } from "zod";
import prisma from "../../prisma/prisma.js";
import { adminRequired, authRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Prisma } from "../../generated/prisma/index.js";
import type { Server } from "socket.io";
import type { Request } from "express";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { QuickSaleRepository } from "../repository/QuickSaleRepository.js";
import { AdminReturnService } from "../services/AdminReturnService.js";
import { privateKycDirectory } from "../middlewares/kycUpload.js";
import fs from "node:fs";
import path from "node:path";

const notifyAdminDashboard = (req: Request, type: string) => {
  req.app.locals.io?.to("admin:dashboard").emit("admin:refresh", { type });
};

const couponFieldsSchema = z.object({ code: z.string().trim().min(2).max(40), type: z.enum(["PERCENT", "FIXED"]), value: z.number().positive(), minOrderValue: z.number().nonnegative().nullable().optional(), maxUses: z.number().int().positive().nullable().optional(), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().nullable().optional(), active: z.boolean().optional() });
const validateCouponRules = (coupon: {
  type?: "PERCENT" | "FIXED" | undefined;
  value?: number | undefined;
  startsAt?: Date | undefined;
  endsAt?: Date | null | undefined;
}, context: z.RefinementCtx) => {
  if (coupon.type === "PERCENT" && coupon.value !== undefined && coupon.value > 100) {
    context.addIssue({ code: "custom", path: ["value"], message: "O desconto percentual não pode exceder 100%" });
  }
  if (coupon.startsAt && coupon.endsAt && coupon.endsAt < coupon.startsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "O término precisa ser posterior ao início" });
  }
};
const couponSchema = couponFieldsSchema.superRefine(validateCouponRules);
const couponPatchSchema = couponFieldsSchema.partial().superRefine(validateCouponRules);
const kycSchema = z.object({ approvalStatus: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]), kycReviewNote: z.string().max(500).optional() });
const quickSaleVerificationReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().min(3).max(500).optional(),
}).superRefine((input, context) => {
  if (input.status === "REJECTED" && !input.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "Informe o motivo da rejeição" });
  }
});
const withdrawalSchema = z.object({ amount: z.number().positive().max(1_000_000) });
const withdrawalStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PAID"]),
  note: z.string().trim().min(3).max(500).optional(),
  providerRef: z.string().trim().min(3).max(120).optional(),
}).superRefine((input, context) => {
  if (input.status === "PAID" && !input.providerRef) {
    context.addIssue({ code: "custom", path: ["providerRef"], message: "Informe a referencia do comprovante Pix" });
  }
  if (input.status === "REJECTED" && !input.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "Informe o motivo da rejeicao" });
  }
});
const dateRangeSchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });
const quickSalePayoutSchema = z.object({ reference: z.string().trim().min(3).max(120) });
const returnResolutionSchema = z.object({
  decision: z.enum(["APPROVE", "DENY"]),
  note: z.string().trim().min(3).max(500),
});

export const adminRoutes = Router();
adminRoutes.use(authRequired, adminRequired);

adminRoutes.get("/kyc/:sellerId/document", asyncHandler(async (req, res) => {
  const seller = await prisma.sellerProfile.findUnique({ where: { id: String(req.params.sellerId) }, select: { document: true, storeName: true } });
  if (!seller?.document) throw new AppError(404, "Documento de KYC nao encontrado");
  const filename = path.basename(seller.document);
  const filePath = path.resolve(privateKycDirectory, filename);
  if (!filePath.startsWith(path.resolve(privateKycDirectory) + path.sep) || !fs.existsSync(filePath)) throw new AppError(404, "Documento de KYC nao encontrado");
  res.setHeader("Content-Disposition", `attachment; filename="kyc-${String(req.params.sellerId)}${path.extname(filename)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.type(path.extname(filename) === ".pdf" ? "application/pdf" : "application/octet-stream");
  res.sendFile(filePath);
}));
const quickSaleRepository = new QuickSaleRepository();
const adminReturnService = new AdminReturnService();

adminRoutes.get("/returns", asyncHandler(async (_req, res) => {
  res.json(await adminReturnService.listPending());
}));

adminRoutes.patch("/returns/:orderId", validateBody(returnResolutionSchema), asyncHandler(async (req, res) => {
  const result = await adminReturnService.resolve(String(req.params.orderId), req.user!.sub, req.body);
  notifyAdminDashboard(req, "RETURN_RESOLVED");
  res.json(result);
}));

adminRoutes.get("/quick-sale-payouts", asyncHandler(async (_req, res) => {
  const eligible = await quickSaleRepository.findEligiblePayouts(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  res.json(eligible.map((order) => ({
    ...order,
    sellerNet: Number(order.subtotal) - Number(order.discount) - Number(order.platformFee),
  })));
}));

adminRoutes.patch("/quick-sale-payouts/:orderId", validateBody(quickSalePayoutSchema), asyncHandler(async (req, res) => {
  const result = await quickSaleRepository.markPayoutPaid(String(req.params.orderId), req.body.reference);
  if (result.count !== 1) throw new AppError(409, "Repasse indisponivel ou ja processado");
  await prisma.auditLog.create({
    data: {
      userId: req.user!.sub,
      action: "QUICK_SALE_PAYOUT_PAID",
      entityType: "Order",
      entityId: String(req.params.orderId),
      metadata: { reference: req.body.reference },
    },
  });
  notifyAdminDashboard(req, "QUICK_SALE_PAYOUT_PAID");
  res.json({ paid: true });
}));

adminRoutes.get("/overview", asyncHandler(async (_req, res) => {
  const paidOrderWhere: Prisma.OrderWhereInput = { payment: { status: "APPROVED" }, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } };
  const [pendingKyc, quickSaleVerifications, products, orders, coupons, paidOrders, paidOrderCount, feeOrders, sellers, sellerSales, supportChats, withdrawals, subscriptionPayments, reservedWithdrawals, pendingWithdrawals] = await Promise.all([
    prisma.sellerProfile.findMany({ where: { approvalStatus: "PENDING" }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { kycSubmittedAt: "asc" } }),
    prisma.quickSaleVerification.findMany({
      where: { status: "PENDING" },
      select: {
        userId: true,
        legalName: true,
        cpfLastFour: true,
        submittedAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { submittedAt: "asc" },
      take: 100,
    }),
    prisma.product.findMany({ include: { seller: { select: { storeName: true } }, ownerUser: { select: { name: true } }, category: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.order.findMany({ include: { customer: { select: { name: true, email: true } }, seller: { select: { storeName: true } }, directSeller: { select: { name: true } }, payment: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.order.aggregate({ where: paidOrderWhere, _sum: { total: true, platformFee: true } }),
    prisma.order.count({ where: paidOrderWhere }),
    prisma.order.findMany({ where: paidOrderWhere, select: { id: true, platformFee: true, total: true, createdAt: true, seller: { select: { storeName: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.sellerProfile.findMany({ include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { products: true, orders: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.order.groupBy({ by: ["sellerId"], where: paidOrderWhere, _sum: { total: true, platformFee: true }, _count: { id: true } }),
    prisma.chat.findMany({ where: { status: "OPEN" }, include: { buyer: { select: { name: true, email: true } }, seller: { select: { storeName: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.withdrawal.findMany({ where: { sellerId: null }, orderBy: { requestedAt: "desc" }, take: 30 }),
    prisma.proSubscriptionPayment.aggregate({ where: { status: "APPROVED", currency: "BRL" }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { sellerId: null, status: { in: ["REQUESTED", "APPROVED", "PAID"] } }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({ where: { sellerId: null, status: { in: ["REQUESTED", "APPROVED"] } }, _sum: { amount: true } }),
  ]);
  const chartOrders = await prisma.order.findMany({ where: paidOrderWhere, select: { total: true, platformFee: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const salesChart = chartOrders.reduce<Record<string, { sales: number; fees: number }>>((chart, order) => { const key = order.createdAt.toISOString().slice(0, 10); const current = chart[key] ?? { sales: 0, fees: 0 }; chart[key] = { sales: current.sales + Number(order.total), fees: current.fees + Number(order.platformFee) }; return chart; }, {});
  const reserved = Number(reservedWithdrawals._sum.amount ?? 0);
  const pending = Number(pendingWithdrawals._sum.amount ?? 0);
  const sellerSalesMap = Object.fromEntries(sellerSales.map((sale) => [sale.sellerId, { total: sale._sum.total ?? 0, platformFee: sale._sum.platformFee ?? 0, orders: sale._count.id }]));
  const platformFees = Number(paidOrders._sum?.platformFee ?? 0);
  const subscriptionRevenue = Number(subscriptionPayments._sum.amount ?? 0);
  const platformRevenue = platformFees + subscriptionRevenue;
  res.json({ pendingKyc, quickSaleVerifications, products, coupons, orders, sellers: sellers.map((seller) => ({ ...seller, sales: sellerSalesMap[seller.id] ?? { total: 0, platformFee: 0, orders: 0 } })), supportChats, withdrawals, finance: { grossSales: paidOrders._sum?.total ?? 0, platformFees, subscriptionRevenue, platformRevenue, availableFees: Math.max(0, platformRevenue - reserved), pendingFees: pending, paidOrders: paidOrderCount, recentFees: feeOrders, salesChart } });
}));
adminRoutes.get("/seller-withdrawals", asyncHandler(async (_req, res) => {
  const withdrawals = await prisma.withdrawal.findMany({
    where: { sellerId: { not: null }, status: { in: ["REQUESTED", "APPROVED"] } },
    include: { seller: { select: { storeName: true, user: { select: { name: true, email: true } } } } },
    orderBy: { requestedAt: "asc" },
    take: 100,
  });
  res.json(withdrawals);
}));
adminRoutes.patch("/kyc/:sellerId", validateBody(kycSchema), asyncHandler(async (req, res) => {
  const result = await prisma.sellerProfile.update({ where: { id: String(req.params.sellerId) }, data: { approvalStatus: req.body.approvalStatus, kycReviewNote: req.body.kycReviewNote, kycReviewedAt: new Date() }, include: { user: { select: { id: true } } } });
  await prisma.auditLog.create({ data: { userId: req.user!.sub, action: `KYC_${req.body.approvalStatus}`, entityType: "SellerProfile", entityId: result.id, metadata: { note: req.body.kycReviewNote } } });
  await prisma.notification.create({ data: { userId: result.user.id, type: "KYC_UPDATED", title: "Analise da loja atualizada", body: req.body.kycReviewNote ?? `Status: ${req.body.approvalStatus}`, data: { status: req.body.approvalStatus } } });
  notifyAdminDashboard(req, "KYC_UPDATED");
  res.json(result);
}));
adminRoutes.patch("/quick-sale-verifications/:userId", validateBody(quickSaleVerificationReviewSchema), asyncHandler(async (req, res) => {
  const userId = String(req.params.userId);
  const reviewedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const result = await tx.quickSaleVerification.updateMany({
      where: { userId, status: "PENDING" },
      data: { status: req.body.status, reviewNote: req.body.note, reviewedAt },
    });
    if (result.count !== 1) throw new AppError(409, "Esta verificação já foi analisada ou não existe");
    await tx.auditLog.create({
      data: {
        userId: req.user!.sub,
        action: `QUICK_SALE_VERIFICATION_${req.body.status}`,
        entityType: "QuickSaleVerification",
        entityId: userId,
        metadata: { note: req.body.note },
      },
    });
  });
  notifyAdminDashboard(req, "QUICK_SALE_VERIFICATION_UPDATED");
  res.json({ status: req.body.status, reviewedAt });
}));

adminRoutes.get("/coupons", asyncHandler(async (_req, res) => {
  res.json(await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }));
}));
adminRoutes.post("/coupons", validateBody(couponSchema), asyncHandler(async (req, res) => {
  const coupon = await prisma.$transaction(async (tx) => {
    const created = await tx.coupon.create({ data: { ...req.body, code: req.body.code.toUpperCase() } });
    await tx.auditLog.create({
      data: {
        userId: req.user!.sub,
        action: "COUPON_CREATED",
        entityType: "Coupon",
        entityId: created.id,
        metadata: { code: created.code },
      },
    });
    return created;
  });
  notifyAdminDashboard(req, "COUPON_CREATED");
  res.status(201).json(coupon);
}));
adminRoutes.patch("/coupons/:id", validateBody(couponPatchSchema), asyncHandler(async (req, res) => {
  const coupon = await prisma.$transaction(async (tx) => {
    const updated = await tx.coupon.update({
      where: { id: String(req.params.id) },
      data: { ...req.body, ...(req.body.code ? { code: req.body.code.toUpperCase() } : {}) },
    });
    await tx.auditLog.create({
      data: {
        userId: req.user!.sub,
        action: "COUPON_UPDATED",
        entityType: "Coupon",
        entityId: updated.id,
        metadata: { changes: req.body },
      },
    });
    return updated;
  });
  notifyAdminDashboard(req, "COUPON_UPDATED");
  res.json(coupon);
}));
adminRoutes.post("/withdrawals", validateBody(withdrawalSchema), asyncHandler(async (req, res) => {
  const admin = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { email: true } });
  if (!admin || admin.email.toLowerCase() !== env.ADMIN_WITHDRAWAL_EMAIL.toLowerCase()) throw new AppError(403, "Este administrador nao pode solicitar saques");
  const result = await prisma.$transaction(async (tx) => {
    const [paidOrders, subscriptionPayments, withdrawals] = await Promise.all([
      tx.order.aggregate({ where: { payment: { status: "APPROVED" }, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } }, _sum: { platformFee: true } }),
      tx.proSubscriptionPayment.aggregate({ where: { status: "APPROVED", currency: "BRL" }, _sum: { amount: true } }),
      tx.withdrawal.aggregate({ where: { sellerId: null, status: { in: ["REQUESTED", "APPROVED", "PAID"] } }, _sum: { amount: true } }),
    ]);
    const reserved = Number(withdrawals._sum.amount ?? 0);
    const available = Math.max(0, Number(paidOrders._sum.platformFee ?? 0) + Number(subscriptionPayments._sum.amount ?? 0) - reserved);
    if (req.body.amount > available) {
      throw new AppError(409, `Saldo disponivel para saque: R$ ${available.toFixed(2)}`);
    }
    return tx.withdrawal.create({ data: { amount: req.body.amount } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  notifyAdminDashboard(req, "WITHDRAWAL_REQUESTED");
  res.status(201).json(result);
}));
adminRoutes.patch("/withdrawals/:id", validateBody(withdrawalStatusSchema), asyncHandler(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.withdrawal.findUnique({ where: { id: String(req.params.id) } });
    if (!current) throw new AppError(404, "Saque nao encontrado");
    const canApproveOrReject = current.status === "REQUESTED" && ["APPROVED", "REJECTED"].includes(req.body.status);
    const canPayOrReject = current.status === "APPROVED" && ["PAID", "REJECTED"].includes(req.body.status);
    if (!canApproveOrReject && !canPayOrReject) throw new AppError(409, "Transicao de status de saque invalida");

    const update = await tx.withdrawal.updateMany({
      where: { id: current.id, status: current.status },
      data: {
        status: req.body.status,
        note: req.body.note,
        providerRef: req.body.providerRef,
        ...(req.body.status === "PAID" || req.body.status === "REJECTED" ? { processedAt: new Date(), pixKey: null } : {}),
      },
    });
    if (update.count !== 1) throw new AppError(409, "Saque atualizado por outro administrador");
    const withdrawal = await tx.withdrawal.findUniqueOrThrow({ where: { id: current.id } });
    await tx.auditLog.create({
      data: {
        userId: req.user!.sub,
        action: `WITHDRAWAL_${req.body.status}`,
        entityType: "Withdrawal",
        entityId: withdrawal.id,
        metadata: { amount: withdrawal.amount, providerRef: withdrawal.providerRef, note: withdrawal.note },
      },
    });
    return withdrawal;
  });
  notifyAdminDashboard(req, "WITHDRAWAL_UPDATED");
  res.json(result);
}));

adminRoutes.get("/orders", asyncHandler(async (req, res) => {
  const parsed = dateRangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Periodo invalido" });
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status as "PENDING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED" | "RETURN_REQUESTED" : undefined;
  const sellerId = typeof req.query.sellerId === "string" && req.query.sellerId ? req.query.sellerId : undefined;
  const customer = typeof req.query.customer === "string" && req.query.customer ? req.query.customer : undefined;
  const orders = await prisma.order.findMany({ where: { ...(status ? { status } : {}), ...(sellerId ? { sellerId } : {}), ...(customer ? { customer: { OR: [{ name: { contains: customer, mode: "insensitive" } }, { email: { contains: customer, mode: "insensitive" } }] } } : {}), ...(parsed.data.from || parsed.data.to ? { createdAt: { ...(parsed.data.from ? { gte: parsed.data.from } : {}), ...(parsed.data.to ? { lte: parsed.data.to } : {}) } } : {}) }, include: { customer: { select: { name: true, email: true } }, seller: { select: { id: true, storeName: true } }, directSeller: { select: { name: true } }, payment: true }, orderBy: { createdAt: "desc" }, take: 200 });
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
  const orders = await prisma.order.findMany({ where: { ...(status ? { status } : {}), ...(sellerId ? { sellerId } : {}), ...(customer ? { customer: { OR: [{ name: { contains: customer, mode: "insensitive" } }, { email: { contains: customer, mode: "insensitive" } }] } } : {}), ...(parsed.data.from || parsed.data.to ? { createdAt: { ...(parsed.data.from ? { gte: parsed.data.from } : {}), ...(parsed.data.to ? { lte: parsed.data.to } : {}) } } : {}) }, select: { id: true, createdAt: true, status: true, total: true, customer: { select: { name: true, email: true } }, seller: { select: { storeName: true } }, directSeller: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 1000 });
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = ["id,data,status,total,cliente,email,loja", ...orders.map((order) => [order.id, new Date(order.createdAt).toLocaleDateString("pt-BR"), order.status, order.total, order.customer.name, order.customer.email, order.seller?.storeName ?? order.directSeller?.name ?? "Venda rápida"].map(escape).join(","))];
  res.type("text/csv; charset=utf-8").setHeader("Content-Disposition", "attachment; filename=pedidos-vitrine.csv").send(`\ufeff${rows.join("\n")}`);
}));
