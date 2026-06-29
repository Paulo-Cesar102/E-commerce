import { Router } from "express";
import { validateBody } from "../middlewares/validate.js";
import { loginSchema, refreshSchema, registerSchema } from "../schemas/auth.schema.js";
import { AuthService } from "../services/AuthService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRoutes = Router();
const authService = new AuthService();

authRoutes.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await authService.register(req.body));
  }),
);

authRoutes.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    res.json(await authService.login(req.body.email, req.body.password));
  }),
);

authRoutes.post(
  "/refresh",
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    res.json(await authService.refresh(req.body.refreshToken));
  }),
);
