import { z } from "zod";

export const sellerSettingsSchema = z.object({
  storeName: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  postalCode: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().length(8)),
  whatsappPhone: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().min(10).max(13)),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
});
