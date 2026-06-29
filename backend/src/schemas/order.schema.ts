import { z } from "zod";

export const checkoutSchema = z.object({
  zipCode: z.string().min(8).optional(),
  itemIds: z.array(z.string().uuid()).optional(),
});

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
