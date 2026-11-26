import { Router } from "express";
import { z } from "zod";
import prisma from "../../prisma/prisma.js";
import { authRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { Prisma } from "../../generated/prisma/index.js";
import { verifySellerKycDocument } from "../middlewares/kycUpload.js";

const consentSchema = z.object({ type: z.string().min(2).max(80), version: z.string().min(1).max(30), granted: z.boolean() });
export const privacyRoutes = Router();
privacyRoutes.use(authRequired);

privacyRoutes.get("/consents", asyncHandler(async (req, res) => {
  res.json(await prisma.userConsent.findMany({ where: { userId: req.user!.sub }, orderBy: { grantedAt: "desc" } }));
}));

privacyRoutes.post("/consents", validateBody(consentSchema), asyncHandler(async (req, res) => {
  const consent = await prisma.$transaction(async (tx) => {
    const updated = await tx.userConsent.upsert({
      where: { userId_type_version: { userId: req.user!.sub, type: req.body.type, version: req.body.version } },
      update: { revokedAt: req.body.granted ? null : new Date() },
      create: { userId: req.user!.sub, type: req.body.type, version: req.body.version, ...(req.body.granted ? {} : { revokedAt: new Date() }) },
    });
    if (req.body.type === "QUICK_SALE_CPF_REVIEW" && !req.body.granted) {
      await tx.quickSaleVerification.deleteMany({ where: { userId: req.user!.sub } });
    }
    return updated;
  });
  await prisma.auditLog.create({ data: { userId: req.user!.sub, action: req.body.granted ? "CONSENT_GRANTED" : "CONSENT_REVOKED", entityType: "UserConsent", entityId: consent.id } });
  res.json(consent);
}));

privacyRoutes.get("/export", asyncHandler(async (req, res) => {
  const userId = req.user!.sub;
  const data = await prisma.user.findUnique({ where: { id: userId }, include: { addresses: true, orders: { include: { items: true, payment: true, shipments: { orderBy: { packageNumber: "asc" } } } }, wishlistItems: { include: { product: true } }, consents: true, quickSaleVerification: { select: { legalName: true, cpfLastFour: true, status: true, submittedAt: true, reviewedAt: true, reviewNote: true } } } });
  res.json(data);
}));

privacyRoutes.delete("/account", asyncHandler(async (req, res) => {
  const userId = req.user!.sub;
  const sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId }, select: { id: true, document: true } });
  const privateKycDocument = sellerProfile?.document;
  await prisma.$transaction(async (tx) => {
    const orderFilter = { OR: [{ customerId: userId }, { directSellerUserId: userId }, { seller: { userId } }] };
    const ordersToAnonymize = await tx.order.findMany({ where: orderFilter, select: { id: true, customerId: true, directSellerUserId: true, sellerId: true } });
    const redemptions = await tx.couponRedemption.findMany({ where: { userId }, select: { couponId: true } });
    const redemptionsByCoupon = new Map<string, number>();
    for (const redemption of redemptions) redemptionsByCoupon.set(redemption.couponId, (redemptionsByCoupon.get(redemption.couponId) ?? 0) + 1);
    for (const [couponId, count] of redemptionsByCoupon) {
      await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { decrement: count } } });
    }
    await tx.couponRedemption.deleteMany({ where: { userId } });
    await tx.cartItem.deleteMany({ where: { cart: { userId } } });
    await tx.cart.deleteMany({ where: { userId } });
    await tx.wishlistItem.deleteMany({ where: { userId } });
    await tx.review.deleteMany({ where: { userId } });
    await tx.quickSaleVerification.deleteMany({ where: { userId } });
    await tx.userConsent.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.emailVerificationToken.deleteMany({ where: { userId } });
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.address.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.chatMessage.deleteMany({ where: { OR: [{ senderId: userId }, { chat: { OR: [{ buyerId: userId }, { seller: { userId } }] } }] } });
    await tx.chat.deleteMany({ where: { OR: [{ buyerId: userId }, { seller: { userId } }] } });
    for (const order of ordersToAnonymize) {
      const neutralId = `deleted-${order.id}`;
      if (order.customerId === userId) await tx.order.update({ where: { id: order.id }, data: { customer: { update: { name: "Conta excluida", email: `${neutralId}@invalid.local`, password: "!ACCOUNT_DELETED!", emailVerifiedAt: null } } } });
      if (order.directSellerUserId === userId) await tx.order.update({ where: { id: order.id }, data: { directSeller: { disconnect: true } } });
      if (order.sellerId && sellerProfile?.id === order.sellerId) await tx.sellerProfile.update({ where: { id: order.sellerId }, data: { user: { update: { name: "Conta excluida", email: `${neutralId}-seller@invalid.local`, password: "!ACCOUNT_DELETED!", emailVerifiedAt: null } } } });
    }
    await tx.order.updateMany({ where: orderFilter, data: { shippingAddress: { redacted: true }, mercadoPagoPreference: null, correiosTrackingCode: null, quickSalePayoutReference: null } });
    await tx.orderEvent.updateMany({ where: { order: orderFilter }, data: { userId: null, metadata: Prisma.DbNull } });
    await tx.paymentTransaction.updateMany({ where: { order: orderFilter }, data: { rawPayload: Prisma.DbNull } });
    await tx.paymentAttempt.updateMany({ where: { paymentTransaction: { order: orderFilter } }, data: { payload: Prisma.DbNull } });
    await tx.paymentWebhookEvent.updateMany({ where: { paymentTransaction: { order: orderFilter } }, data: { payload: { redacted: true } } });
    await tx.product.updateMany({ where: { ownerUserId: userId, listingType: "QUICK_SALE" }, data: { status: "INACTIVE", stock: 0 } });
    await tx.sellerProfile.updateMany({
      where: { userId },
      data: { storeName: "Loja desativada", description: null, postalCode: null, whatsappPhone: null, city: null, state: null, legalName: null, document: null, kycSubmittedAt: null, kycReviewedAt: null, kycReviewNote: null, approvalStatus: "SUSPENDED", subscriptionCheckoutUrl: null },
    });
    await tx.user.update({ where: { id: userId }, data: { name: "Conta excluída", email: `deleted-${userId}@invalid.local`, password: "!ACCOUNT_DELETED!", emailVerifiedAt: null } });
    await tx.auditLog.create({ data: { action: "ACCOUNT_DELETED", entityType: "User", entityId: userId } });
  });
  if (sellerProfile?.document) await verifySellerKycDocument.remove(privateKycDocument!);
  res.clearCookie("vitrine_refresh", { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: "/auth" }).status(204).send();
}));
