import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import prisma from "../../prisma/prisma.js";

type JwtPayload = {
  sub: string;
  role: "CUSTOMER" | "SELLER" | "ADMIN";
};

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authRequired: RequestHandler = (req, _res, next) => {
  const [, token] = req.headers.authorization?.split(" ") ?? [];

  if (!token) {
    throw new AppError(401, "Token ausente");
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw new AppError(401, "Token invalido");
  }
};

export const sellerRequired: RequestHandler = async (req, _res, next) => {
  if (!req.user || !["SELLER", "ADMIN"].includes(req.user.role)) {
    throw new AppError(403, "Acesso permitido apenas para vendedor");
  }

  if (req.user.role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: req.user.sub }, select: { approvalStatus: true } });
    if (!seller) throw new AppError(403, "Conta de vendedor nao encontrada");
    if (seller.approvalStatus !== "APPROVED") throw new AppError(403, `Conta aguardando aprovacao administrativa (${seller.approvalStatus})`);
  }

  next();
};

export const adminRequired: RequestHandler = (req, _res, next) => {
  if (!req.user || req.user.role !== "ADMIN") throw new AppError(403, "Acesso permitido apenas para administradores");
  next();
};
