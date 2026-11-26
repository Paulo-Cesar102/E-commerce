import { z } from "zod";

export const createQuickSaleSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(4000),
  price: z.coerce.number().positive(),
  originPostalCode: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().regex(/^\d{8}$/)),
  images: z.array(z.object({ url: z.url(), alt: z.string().max(200).optional() })).min(1).max(6),
});

export const quickSaleListingStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const quickSaleOrderStatusSchema = z.object({
  status: z.enum(["SHIPPED", "DELIVERED"]),
  trackingCode: z.string().trim().min(5).max(40).optional(),
}).superRefine((value, context) => {
  if (value.status === "SHIPPED" && !value.trackingCode) {
    context.addIssue({ code: "custom", path: ["trackingCode"], message: "Informe o codigo de rastreio" });
  }
});
