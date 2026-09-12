import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
  role: z.enum(["CUSTOMER", "SELLER"]).default("CUSTOMER"),
  storeName: z.string().min(2).optional(),
  acceptTerms: z.literal(true),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20).optional() });
export const requestPasswordResetSchema = z.object({ email: z.email() });
export const resetPasswordSchema = z.object({ token: z.string().min(32), password: z.string().min(10) });
export const verifyEmailSchema = z.object({ token: z.string().min(32) });
