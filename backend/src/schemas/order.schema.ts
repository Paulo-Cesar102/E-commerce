import { z } from "zod";

export const checkoutSchema = z.object({
  addressId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).optional(),
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
  correiosTrackingCode: z.string().optional(),
});
