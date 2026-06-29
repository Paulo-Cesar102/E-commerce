import { z } from "zod";

export const checkoutSchema = z.object({
  zipCode: z.string().min(8).optional(),
  itemIds: z.array(z.string().uuid()).optional(),
});

export const paymentWebhookSchema = z.object({
  orderId: z.string().uuid(),
  providerRef: z.string().optional(),
  status: z.enum(["APPROVED", "REJECTED", "CANCELED", "REFUNDED"]),
  rawPayload: z.unknown().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PREPARING", "SHIPPED", "DELIVERED", "CANCELED", "REFUNDED"]),
  correiosTrackingCode: z.string().optional(),
});
