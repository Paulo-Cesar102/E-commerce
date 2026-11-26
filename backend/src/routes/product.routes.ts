import { Router } from "express";
import { authRequired, sellerRequired, sellerVerificationRequired } from "../middlewares/auth.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";
import { createProductSchema, productQuerySchema, reviewSchema, updateProductSchema } from "../schemas/product.schema.js";
import { ProductService } from "../services/ProductService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadProductImages, verifyUploadedImageContent } from "../middlewares/upload.js";
import { FileStorageService } from "../services/FileStorageService.js";

export const productRoutes = Router();
const productService = new ProductService();

productRoutes.get("/", validateQuery(productQuerySchema), asyncHandler(async (req, res) => {
  res.json(await productService.list(req.validatedQuery as never));
}));

productRoutes.get("/categories", asyncHandler(async (_req, res) => {
  res.json(await productService.categories());
}));

productRoutes.get("/stores/:sellerId", asyncHandler(async (req, res) => {
  res.json(await productService.store(String(req.params.sellerId)));
}));

productRoutes.post("/uploads", authRequired, sellerRequired, sellerVerificationRequired, uploadProductImages, verifyUploadedImageContent, asyncHandler(async (req, res) => {
  const files = req.files as Express.Multer.File[];
  const storage = new FileStorageService();
  res.status(201).json({ images: await storage.uploadProductFiles(files, `${req.protocol}://${req.get("host")}`) });
}));

productRoutes.get("/:id", asyncHandler(async (req, res) => {
  res.json(await productService.findById(String(req.params.id)));
}));

productRoutes.post("/", authRequired, sellerRequired, sellerVerificationRequired, validateBody(createProductSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await productService.create(req.user!.sub, req.body));
}));

productRoutes.patch("/:id", authRequired, sellerRequired, validateBody(updateProductSchema), sellerVerificationRequired, asyncHandler(async (req, res) => {
  res.json(await productService.update(req.user!.sub, String(req.params.id), req.body));
}));

productRoutes.delete("/:id", authRequired, sellerRequired, asyncHandler(async (req, res) => {
  await productService.delete(req.user!.sub, String(req.params.id));
  res.status(204).send();
}));

productRoutes.post("/:id/reviews", authRequired, validateBody(reviewSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await productService.review(req.user!.sub, String(req.params.id), req.body));
}));
