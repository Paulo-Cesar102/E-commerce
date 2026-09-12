import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { AuthRepository } from "../repository/AuthRepository.js";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: "CUSTOMER" | "SELLER";
  storeName?: string;
  acceptTerms: true;
};

export class AuthService {
  constructor(private readonly authRepository = new AuthRepository()) {}

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

    await this.authRepository.createRefreshToken({
      userId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
    });

    return refreshToken;
  }

  async register(input: RegisterInput) {
    const exists = await this.authRepository.findUserByEmail(input.email);
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

    const user = await this.authRepository.createUser(data);

    return {
      user,
      accessToken: this.signAccessToken(user),
      refreshToken: await this.createRefreshToken(user.id),
    };
  }

  async login(email: string, password: string) {
    const user = await this.authRepository.findUserByEmail(email);
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
    const stored = await this.authRepository.findRefreshToken(this.hashToken(refreshToken));

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError(401, "Refresh token invalido");
    }

    const revoked = await this.authRepository.revokeActiveRefreshToken(stored.id);
    if (revoked.count !== 1) {
      throw new AppError(401, "Refresh token invalido");
    }

    const user = stored.user;
    return {
      accessToken: this.signAccessToken({ id: user.id, role: user.role }),
      refreshToken: await this.createRefreshToken(user.id),
    };
  }

  async logout(refreshToken: string) {
    const stored = await this.authRepository.findRefreshToken(this.hashToken(refreshToken));
    if (stored && !stored.revokedAt) await this.authRepository.revokeRefreshToken(stored.id);
  }
  async requestPasswordReset(email: string) {
    const user = await this.authRepository.findUserByEmail(email);
    if (!user) return { requested: true };
    const token = crypto.randomBytes(32).toString("hex"); const expiresAt = new Date(Date.now() + 60 * 60_000);
    await this.authRepository.createPasswordResetToken({ userId: user.id, tokenHash: this.hashToken(token), expiresAt });
    return { requested: true, ...(env.NODE_ENV === "development" ? { token } : {}) };
  }
  async resetPassword(token: string, password: string) {
    const reset = await this.authRepository.findPasswordResetToken(this.hashToken(token));
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) throw new AppError(400, "Token de recuperacao invalido ou expirado");
    await this.authRepository.updatePassword(reset.userId, await bcrypt.hash(password, 12));
    await this.authRepository.consumePasswordResetToken(reset.id);
  }
}
