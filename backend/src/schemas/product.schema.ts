import { z } from "zod";

const optionSchema = z.object({
  type: z.enum(["size", "color", "flavor"]),
  value: z.string().min(1),
});
const variantSchema = z.object({ sku: z.string().min(1).max(80), attributes: z.record(z.string(), z.string()), price: z.coerce.number().positive().optional(), stock: z.coerce.number().int().min(0) });

export const productQuerySchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  sort: z.enum(["rating", "new", "price_asc", "price_desc"]).default("rating"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().min(10),
  price: z.coerce.number().positive(),
  stock: z.coerce.number().int().min(0),
  images: z.array(z.object({ url: z.url(), alt: z.string().optional() })).default([]),
  options: z.array(optionSchema).default([]),
  variants: z.array(variantSchema).default([]),
});

export const updateProductSchema = createProductSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const reviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(800).optional(),
});
