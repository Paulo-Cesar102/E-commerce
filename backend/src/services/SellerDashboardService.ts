import prisma from "../../prisma/prisma.js";
import { AppError } from "../errors/AppError.js";

export class SellerDashboardService {
  async summary(userId: string) {
    const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (!seller) {
      throw new AppError(403, "Vendedor nao encontrado");
    }

    const [paidOrders, products, recentOrders, categories] = await prisma.$transaction([
      prisma.order.findMany({
        where: { sellerId: seller.id, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.product.findMany({ where: { sellerId: seller.id }, include: { category: true, images: { take: 1 } } }),
      prisma.order.findMany({
        where: { sellerId: seller.id },
        include: { customer: { select: { id: true, name: true, email: true } }, items: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.category.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const totalSales = paidOrders.length;
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const financialChart = paidOrders.reduce<Record<string, number>>((acc, order) => {
      const key = order.createdAt.toISOString().slice(0, 10);
      acc[key] = (acc[key] ?? 0) + Number(order.total);
      return acc;
    }, {});

    return {
      seller,
      totalSales,
      revenue,
      profit: revenue,
      financialChart: Object.entries(financialChart).map(([date, total]) => ({ date, total })),
      products,
      recentOrders,
      categories,
    };
  }

  async updateSettings(userId: string, input: { storeName: string; description?: string }) {
    const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (!seller) {
      throw new AppError(403, "Vendedor nao encontrado");
    }

    return prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        storeName: input.storeName,
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
  }
}
