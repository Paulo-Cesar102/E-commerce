import prisma from "../../prisma/prisma.js";

export class SellerDashboardRepository {
  findSellerByUserId(userId: string) {
    return prisma.sellerProfile.findUnique({ where: { userId } });
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
        include: { customer: { select: { id: true, name: true, email: true } }, items: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.category.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
    ]);
  }

  updateSettings(sellerId: string, input: { storeName: string; description?: string; postalCode: string }) {
    return prisma.sellerProfile.update({
      where: { id: sellerId },
      data: {
        storeName: input.storeName,
        postalCode: input.postalCode,
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
  }
}
