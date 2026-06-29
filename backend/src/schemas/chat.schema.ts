import { z } from "zod";

export const createChatSchema = z.object({
  sellerId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
});

export const messageSchema = z.object({
  content: z.string().min(1).max(1000),
});
