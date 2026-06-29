import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import prisma from "../../prisma/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: "CUSTOMER" | "SELLER";
  storeName?: string;
};

export class AuthService {
  private hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private signAccessToken(user: { id: string; role: "CUSTOMER" | "SELLER" | "ADMIN" }) {
    return jwt.sign({ role: user.role }, env.JWT_SECRET, {
      subject: user.id,
      expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>,
    });
  }

  private async createRefreshToken(userId: string) {
    const refreshToken = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return refreshToken;
  }

  async register(input: RegisterInput) {
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) {
      throw new AppError(409, "Email ja cadastrado");
    }

    const password = await bcrypt.hash(input.password, 12);
    const data = {
      name: input.name,
      email: input.email,
      password,
      role: input.role,
      ...(input.role === "SELLER"
        ? { sellerProfile: { create: { storeName: input.storeName ?? input.name } } }
        : {}),
    };

    const user = await prisma.user.create({
      data,
      select: { id: true, name: true, email: true, role: true },
    });

    return {
      user,
      accessToken: this.signAccessToken(user),
      refreshToken: await this.createRefreshToken(user.id),
    };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(401, "Credenciais invalidas");
    }

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken: this.signAccessToken({ id: user.id, role: user.role }),
      refreshToken: await this.createRefreshToken(user.id),
    };
  }

  async refresh(refreshToken: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError(401, "Refresh token invalido");
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = stored.user;
    return {
      accessToken: this.signAccessToken({ id: user.id, role: user.role }),
      refreshToken: await this.createRefreshToken(user.id),
    };
  }
}
