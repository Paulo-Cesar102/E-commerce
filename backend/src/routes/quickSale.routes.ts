import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { uploadProductImages, verifyUploadedImageContent } from "../middlewares/upload.js";
import { validateBody } from "../middlewares/validate.js";
import { createQuickSaleSchema, quickSaleListingStatusSchema, quickSaleOrderStatusSchema, quickSaleVerificationSchema } from "../schemas/quickSale.schema.js";
import { FileStorageService } from "../services/FileStorageService.js";
import { QuickSaleService } from "../services/QuickSaleService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const quickSaleRoutes = Router();
const quickSaleService = new QuickSaleService();

quickSaleRoutes.get("/mine", authRequired, asyncHandler(async (req, res) => {
  res.json(await quickSaleService.getMine(req.user!.sub));
}));

quickSaleRoutes.post("/verification", authRequired, validateBody(quickSaleVerificationSchema), asyncHandler(async (req, res) => {
  const verification = await quickSaleService.submitVerification(req.user!.sub, req.body);
  req.app.locals.io?.to("admin:dashboard").emit("admin:refresh", { type: "QUICK_SALE_VERIFICATION_SUBMITTED" });
  res.status(202).json(verification);
}));

quickSaleRoutes.post("/uploads", authRequired, asyncHandler(async (req, _res, next) => {
  await quickSaleService.assertVerified(req.user!.sub);
  next();
}), uploadProductImages, verifyUploadedImageContent, asyncHandler(async (req, res) => {
  const files = req.files as Express.Multer.File[];
  const storage = new FileStorageService();
  res.status(201).json({ images: await storage.uploadProductFiles(files, `${req.protocol}://${req.get("host")}`) });
}));

quickSaleRoutes.post("/", authRequired, validateBody(createQuickSaleSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await quickSaleService.create(req.user!.sub, req.body));
}));

quickSaleRoutes.patch("/orders/:id/status", authRequired, validateBody(quickSaleOrderStatusSchema), asyncHandler(async (req, res) => {
  res.json(await quickSaleService.updateSaleOrderStatus(
    req.user!.sub,
    String(req.params.id),
    req.body.status,
    req.body.trackingCodes,
  ));
}));

quickSaleRoutes.patch("/:id", authRequired, validateBody(quickSaleListingStatusSchema), asyncHandler(async (req, res) => {
  res.json(await quickSaleService.updateListingStatus(req.user!.sub, String(req.params.id), req.body.status));
}));
