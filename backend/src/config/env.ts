import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),
  TRUST_PROXY: z.coerce.boolean().default(false),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  MERCADO_PAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().optional(),
  CORREIOS_QUOTE_URL: z.url().optional(),
  CORREIOS_API_TOKEN: z.string().optional(),
  CHECKOUT_HOLD_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(5),
  ADMIN_WITHDRAWAL_EMAIL: z.email().default("pc00555c@gmail.com"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.url().optional(),
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === "production") {
  const required = ["CORS_ORIGIN", "MERCADO_PAGO_ACCESS_TOKEN", "MERCADO_PAGO_WEBHOOK_SECRET", "CORREIOS_QUOTE_URL", "CORREIOS_API_TOKEN"] as const;
  for (const key of required) if (!env[key]) throw new Error(`${key} e obrigatoria em producao`);
  if (!env.COOKIE_SECURE) throw new Error("COOKIE_SECURE deve ser true em producao");
  if (env.STORAGE_DRIVER !== "s3" || !env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_PUBLIC_URL) throw new Error("Storage S3/R2 deve estar configurado em producao");
}
