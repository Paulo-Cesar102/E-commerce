import prisma from "../../prisma/prisma.js";
import type CreateUserDTO from "../dtos/CreateUserDTO.js";

type RegisterData = CreateUserDTO & {
  role: "CUSTOMER" | "SELLER";
  sellerProfile?: { create: { storeName: string } };
};

export class AuthRepository {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  createUser(data: RegisterData) {
    return prisma.user.create({
      data,
      select: { id: true, name: true, email: true, role: true },
    });
  }

  createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data });
  }

  findRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  revokeActiveRefreshToken(id: string) {
    return prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
