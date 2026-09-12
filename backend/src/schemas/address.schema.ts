import { z } from "zod";

export const addressSchema = z.object({
  recipient: z.string().min(2).max(120),
  document: z.string().min(11).max(18).optional(),
  postalCode: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().length(8)),
  street: z.string().min(2).max(160),
  number: z.string().min(1).max(20),
  complement: z.string().max(100).optional(),
  district: z.string().min(2).max(100),
  city: z.string().min(2).max(100),
  state: z.string().length(2).transform((value) => value.toUpperCase()),
  isDefault: z.boolean().optional(),
});
