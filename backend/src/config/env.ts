import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().default("dev_access_secret_change_me"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),
  MERCADO_PAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
