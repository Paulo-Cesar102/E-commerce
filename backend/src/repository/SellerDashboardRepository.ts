import { Prisma } from "../../generated/prisma/index.js";
import prisma from "../../prisma/prisma.js";

export class SellerDashboardRepository {
  findSellerByUserId(userId: string) {
    return prisma.sellerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        storeName: true,
        description: true,
        postalCode: true,
        whatsappPhone: true,
        city: true,
        state: true,
      },
    });
  }

  summaryData(sellerId: string) {
    return prisma.$transaction([
      prisma.order.findMany({
        where: { sellerId, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.product.findMany({ where: { sellerId }, include: { category: true, images: { take: 1 }, variants: { where: { active: true } } } }),
      prisma.order.findMany({
        where: { sellerId },
        include: { customer: { select: { id: true, name: true, email: true } }, items: true, shipments: { orderBy: { packageNumber: "asc" } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.category.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
    ]);
  }

  financialData(sellerId: string) {
    return prisma.$transaction([
      prisma.order.aggregate({ where: { sellerId, payment: { status: "APPROVED" }, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } }, _sum: { total: true, platformFee: true }, _count: { id: true } }),
      prisma.withdrawal.findMany({ where: { sellerId }, orderBy: { requestedAt: "desc" }, take: 30 }),
      prisma.withdrawal.aggregate({ where: { sellerId, status: { in: ["REQUESTED", "APPROVED", "PAID"] } }, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { sellerId, status: { in: ["REQUESTED", "APPROVED"] } }, _sum: { amount: true } }),
    ]);
  }

  updateSettings(sellerId: string, input: { storeName: string; description?: string; postalCode: string; whatsappPhone: string; city: string; state: string }) {
    return prisma.sellerProfile.update({
      where: { id: sellerId },
      data: {
        storeName: input.storeName,
        postalCode: input.postalCode,
        whatsappPhone: input.whatsappPhone,
        city: input.city,
        state: input.state,
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
  }

  reserveWithdrawal(sellerId: string, amount: number, pixKey: string) {
    return prisma.$transaction(async (tx) => {
      const [financialTotals, pendingWithdrawals] = await Promise.all([
        tx.order.aggregate({ where: { sellerId, payment: { status: "APPROVED" }, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } }, _sum: { total: true, platformFee: true } }),
        tx.withdrawal.aggregate({ where: { sellerId, status: { in: ["REQUESTED", "APPROVED", "PAID"] } }, _sum: { amount: true } }),
      ]);
      const available = Math.max(
        0,
        Number(financialTotals._sum.total ?? 0)
        - Number(financialTotals._sum.platformFee ?? 0)
        - Number(pendingWithdrawals._sum.amount ?? 0),
      );
      if (amount > available) return { available, withdrawal: null };
      const withdrawal = await tx.withdrawal.create({ data: { amount, sellerId, pixKey } });
      return { available, withdrawal };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
