import { z } from "zod";

export const sellerSettingsSchema = z.object({
  storeName: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
});
