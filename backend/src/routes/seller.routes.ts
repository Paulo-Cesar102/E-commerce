import { Router } from "express";
import { authRequired, sellerRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { sellerSettingsSchema } from "../schemas/seller.schema.js";
import { SellerDashboardService } from "../services/SellerDashboardService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../../prisma/prisma.js";
import { z } from "zod";
import { uploadSellerKycDocument, verifySellerKycDocument } from "../middlewares/kycUpload.js";
import { AppError } from "../errors/AppError.js";

export const sellerRoutes = Router();
const dashboardService = new SellerDashboardService();

const kycSubmissionSchema = z.object({ legalName: z.string().trim().min(3).max(160) });
sellerRoutes.post("/kyc/document", authRequired, uploadSellerKycDocument, verifySellerKycDocument, asyncHandler(async (req, res) => {
  if (req.user!.role !== "SELLER") throw new AppError(403, "Somente vendedores podem enviar documentos");
  const filename = res.locals.kycDocumentFilename as string;
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: req.user!.sub }, select: { document: true } });
  if (!profile) { await verifySellerKycDocument.remove(filename); throw new AppError(404, "Perfil de vendedor nao encontrado"); }
  await prisma.sellerProfile.update({ where: { userId: req.user!.sub }, data: { document: filename, kycSubmittedAt: null, kycReviewNote: null } });
  if (profile.document && profile.document !== filename) await verifySellerKycDocument.remove(profile.document);
  res.status(201).json({ documentUploaded: true });
}));

sellerRoutes.post("/kyc", authRequired, validateBody(kycSubmissionSchema), asyncHandler(async (req, res) => {
  if (req.user!.role !== "SELLER") throw new AppError(403, "Somente vendedores podem enviar documentos");
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: req.user!.sub }, select: { document: true } });
  if (!profile?.document) throw new AppError(400, "Envie o documento da loja antes de protocolar a analise");
  const updated = await prisma.sellerProfile.update({ where: { userId: req.user!.sub }, data: { legalName: req.body.legalName, approvalStatus: "PENDING", kycSubmittedAt: new Date(), kycReviewedAt: null, kycReviewNote: null }, select: { approvalStatus: true, kycSubmittedAt: true } });
  await prisma.auditLog.create({ data: { userId: req.user!.sub, action: "SELLER_KYC_SUBMITTED", entityType: "SellerProfile", entityId: req.user!.sub } });
  req.app.locals.io?.to("admin:dashboard").emit("admin:refresh", { type: "KYC_SUBMITTED" });
  res.status(202).json(updated);
}));

sellerRoutes.get("/kyc/status", authRequired, asyncHandler(async (req, res) => {
  if (req.user!.role !== "SELLER") throw new AppError(403, "Somente vendedores podem consultar este envio");
  const profile = await prisma.sellerProfile.findUnique({ where: { userId: req.user!.sub }, select: { approvalStatus: true, legalName: true, kycSubmittedAt: true, kycReviewedAt: true, kycReviewNote: true, document: true } });
  if (!profile) throw new AppError(404, "Perfil de vendedor nao encontrado");
  res.json({ ...profile, documentUploaded: Boolean(profile.document), document: undefined });
}));

sellerRoutes.use(authRequired, sellerRequired);

sellerRoutes.get("/dashboard", asyncHandler(async (req, res) => {
  res.json(await dashboardService.summary(req.user!.sub));
}));

sellerRoutes.patch("/settings", validateBody(sellerSettingsSchema), asyncHandler(async (req, res) => {
  res.json(await dashboardService.updateSettings(req.user!.sub, req.body));
}));

sellerRoutes.post("/withdrawals", validateBody(z.object({
  amount: z.number().positive().max(1_000_000),
  pixKey: z.string().trim().min(3).max(120),
})), asyncHandler(async (req, res) => {
  const withdrawal = await dashboardService.requestWithdrawal(req.user!.sub, req.body.amount, req.body.pixKey);
  req.app.locals.io?.to("admin:dashboard").emit("admin:refresh", { type: "SELLER_WITHDRAWAL_REQUESTED" });
  res.status(201).json(withdrawal);
}));
