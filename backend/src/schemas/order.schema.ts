import { z } from "zod";

export const checkoutSchema = z.object({
  addressId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).optional(),
  couponCode: z.string().trim().min(1).max(40).optional(),
});

export const cancelOrderSchema = z.object({ reason: z.string().min(3).max(500) });
export const returnOrderSchema = z.object({ reason: z.string().min(3).max(500) });

export const paymentWebhookSchema = z.object({
  data: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
}).passthrough();

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PREPARING", "SHIPPED", "DELIVERED", "CANCELED", "REFUNDED"]),
  trackingCodes: z.array(z.string().trim().min(5).max(40)).min(1).optional(),
}).superRefine((value, context) => {
  if (value.status === "SHIPPED" && !value.trackingCodes?.length) {
    context.addIssue({ code: "custom", path: ["trackingCodes"], message: "Informe o codigo de rastreio de cada pacote" });
  }
  if (value.trackingCodes && new Set(value.trackingCodes).size !== value.trackingCodes.length) {
    context.addIssue({ code: "custom", path: ["trackingCodes"], message: "Os codigos de rastreio devem ser diferentes" });
  }
});
