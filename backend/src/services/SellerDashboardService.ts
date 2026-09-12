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
    const [financialTotals, withdrawals] = await this.sellerDashboardRepository.financialData(seller.id);
    const pendingWithdrawals = withdrawals.filter((item) => ["REQUESTED", "APPROVED"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount), 0);

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
      finance: { grossSales: financialTotals._sum.total ?? 0, platformFees: financialTotals._sum.platformFee ?? 0, available: Math.max(0, Number(financialTotals._sum.total ?? 0) - Number(financialTotals._sum.platformFee ?? 0) - pendingWithdrawals), pending: pendingWithdrawals, paidOrders: financialTotals._count.id, withdrawals },
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
