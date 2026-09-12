import { AppError } from "../errors/AppError.js";
import { SellerDashboardRepository } from "../repository/SellerDashboardRepository.js";

export class SellerDashboardService {
  constructor(private readonly sellerDashboardRepository = new SellerDashboardRepository()) {}

  async summary(userId: string) {
    const seller = await this.sellerDashboardRepository.findSellerByUserId(userId);
    if (!seller) {
      throw new AppError(403, "Vendedor nao encontrado");
    }

    const [paidOrders, products, recentOrders, categories] = await this.sellerDashboardRepository.summaryData(seller.id);

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

  async updateSettings(userId: string, input: { storeName: string; description?: string; postalCode: string }) {
    const seller = await this.sellerDashboardRepository.findSellerByUserId(userId);
    if (!seller) {
      throw new AppError(403, "Vendedor nao encontrado");
    }

    return this.sellerDashboardRepository.updateSettings(seller.id, input);
  }
}
