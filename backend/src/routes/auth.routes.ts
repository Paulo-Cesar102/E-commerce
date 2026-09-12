import { Router } from "express";
import { validateBody } from "../middlewares/validate.js";
import { googleLoginSchema, loginSchema, refreshSchema, registerSchema, requestPasswordResetSchema, resetPasswordSchema } from "../schemas/auth.schema.js";
import { AuthService } from "../services/AuthService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { authRequired } from "../middlewares/auth.js";
import prisma from "../../prisma/prisma.js";

export const authRoutes = Router();
const authService = new AuthService();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { message: "Muitas tentativas. Tente novamente em 15 minutos." } });
const refreshCookie = "vitrine_refresh";
const cookieOptions = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax" as const, path: "/auth", maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 86_400_000 };
const readCookie = (header: string | undefined) => header?.split(";").map((part) => part.trim().split("=")).find(([key]) => key === refreshCookie)?.[1];

authRoutes.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const session = await authService.register(req.body);
    res.cookie(refreshCookie, session.refreshToken, cookieOptions).status(201).json({ user: session.user, accessToken: session.accessToken });
  }),
);

authRoutes.post(
  "/login",
  loginLimit, validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const session = await authService.login(req.body.email, req.body.password);
    res.cookie(refreshCookie, session.refreshToken, cookieOptions).json({ user: session.user, accessToken: session.accessToken });
  }),
);

authRoutes.get("/me", authRequired, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { id: true, name: true, email: true, role: true } });
  if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });
  res.json({ user });
}));

authRoutes.post(
  "/google",
  loginLimit,
  validateBody(googleLoginSchema),
  asyncHandler(async (req, res) => {
    const session = await authService.loginWithGoogle(req.body.credential);
    res.cookie(refreshCookie, session.refreshToken, cookieOptions).json({ user: session.user, accessToken: session.accessToken });
  }),
);

authRoutes.post(
  "/refresh",
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const token = req.body.refreshToken ?? readCookie(req.header("cookie"));
    if (!token) throw new Error("Refresh token ausente");
    const session = await authService.refresh(token);
    res.cookie(refreshCookie, session.refreshToken, cookieOptions).json({ accessToken: session.accessToken });
  }),
);

authRoutes.post("/logout", asyncHandler(async (req, res) => { const token = readCookie(req.header("cookie")); if (token) await authService.logout(token); res.clearCookie(refreshCookie, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: "/auth" }).status(204).send(); }));
authRoutes.post("/password-reset/request", loginLimit, validateBody(requestPasswordResetSchema), asyncHandler(async (req, res) => res.json(await authService.requestPasswordReset(req.body.email))));
authRoutes.post("/password-reset/confirm", loginLimit, validateBody(resetPasswordSchema), asyncHandler(async (req, res) => { await authService.resetPassword(req.body.token, req.body.password); res.status(204).send(); }));
