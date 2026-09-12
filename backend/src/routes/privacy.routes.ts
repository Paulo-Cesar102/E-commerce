import { Router } from "express";
import { z } from "zod";
import prisma from "../../prisma/prisma.js";
import { authRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const consentSchema = z.object({ type: z.string().min(2).max(80), version: z.string().min(1).max(30), granted: z.boolean() });
export const privacyRoutes = Router();
privacyRoutes.use(authRequired);

privacyRoutes.get("/consents", asyncHandler(async (req, res) => {
  res.json(await prisma.userConsent.findMany({ where: { userId: req.user!.sub }, orderBy: { grantedAt: "desc" } }));
}));

privacyRoutes.post("/consents", validateBody(consentSchema), asyncHandler(async (req, res) => {
  const consent = await prisma.userConsent.upsert({
    where: { userId_type_version: { userId: req.user!.sub, type: req.body.type, version: req.body.version } },
    update: { revokedAt: req.body.granted ? null : new Date() },
    create: { userId: req.user!.sub, type: req.body.type, version: req.body.version, ...(req.body.granted ? {} : { revokedAt: new Date() }) },
  });
  await prisma.auditLog.create({ data: { userId: req.user!.sub, action: req.body.granted ? "CONSENT_GRANTED" : "CONSENT_REVOKED", entityType: "UserConsent", entityId: consent.id } });
  res.json(consent);
}));

privacyRoutes.get("/export", asyncHandler(async (req, res) => {
  const userId = req.user!.sub;
  const data = await prisma.user.findUnique({ where: { id: userId }, include: { addresses: true, orders: { include: { items: true, payment: true, shipment: true } }, wishlistItems: { include: { product: true } }, consents: true } });
  res.json(data);
}));

privacyRoutes.delete("/account", asyncHandler(async (req, res) => {
  const userId = req.user!.sub;
  await prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({ where: { cart: { userId } } });
    await tx.cart.deleteMany({ where: { userId } });
    await tx.wishlistItem.deleteMany({ where: { userId } });
    await tx.userConsent.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { name: "Conta excluida", email: `deleted-${userId}@invalid.local`, password: "ACCOUNT_DELETED" } });
    await tx.auditLog.create({ data: { action: "ACCOUNT_DELETED", entityType: "User", entityId: userId } });
  });
  res.status(204).send();
}));