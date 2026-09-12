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
  createPasswordResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }) { return prisma.passwordResetToken.create({ data }); }
  findPasswordResetToken(tokenHash: string) { return prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } }); }
  consumePasswordResetToken(id: string) { return prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } }); }
  updatePassword(userId: string, password: string) { return prisma.user.update({ where: { id: userId }, data: { password } }); }
  markEmailVerified(userId: string) { return prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }); }
  createEmailVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }) { return prisma.emailVerificationToken.create({ data }); }
  findEmailVerificationToken(tokenHash: string) { return prisma.emailVerificationToken.findUnique({ where: { tokenHash }, include: { user: true } }); }
  consumeEmailVerificationToken(id: string, userId: string) { return prisma.$transaction([prisma.emailVerificationToken.update({ where: { id }, data: { usedAt: new Date() } }), prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })]); }
}
