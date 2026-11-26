import { AppError } from "../errors/AppError.js";
import { SellerDashboardRepository } from "../repository/SellerDashboardRepository.js";
import { SellerPlanService } from "./SellerPlanService.js";

export class SellerDashboardService {
  constructor(
    private readonly sellerDashboardRepository = new SellerDashboardRepository(),
    private readonly sellerPlans = new SellerPlanService(),
  ) {}

  async summary(userId: string) {
    const [seller, verification] = await Promise.all([
      this.sellerDashboardRepository.findSellerByUserId(userId),
      this.sellerDashboardRepository.findQuickSaleVerificationStatus(userId),
    ]);
    if (!seller) {
      throw new AppError(403, "Vendedor nao encontrado");
    }

    const [paidOrders, products, recentOrders, categories] = await this.sellerDashboardRepository.summaryData(seller.id);
    const [financialTotals, withdrawals, reservedWithdrawals, pendingWithdrawals] = await this.sellerDashboardRepository.financialData(seller.id);

    const totalSales = paidOrders.length;
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const financialChart = paidOrders.reduce<Record<string, number>>((acc, order) => {
      const key = order.createdAt.toISOString().slice(0, 10);
      acc[key] = (acc[key] ?? 0) + Number(order.total);
      return acc;
    }, {});

    return {
      seller: { ...seller, quickSaleVerificationStatus: verification?.status ?? null },
      plan: await this.sellerPlans.getPlan(userId),
      totalSales,
      revenue,
      profit: revenue,
      finance: { grossSales: financialTotals._sum.total ?? 0, platformFees: financialTotals._sum.platformFee ?? 0, available: Math.max(0, Number(financialTotals._sum.total ?? 0) - Number(financialTotals._sum.platformFee ?? 0) - Number(reservedWithdrawals._sum.amount ?? 0)), pending: pendingWithdrawals._sum.amount ?? 0, paidOrders: financialTotals._count.id, withdrawals },
      financialChart: Object.entries(financialChart).map(([date, total]) => ({ date, total })),
      products,
      recentOrders,
      categories,
    };
  }

  async updateSettings(userId: string, input: { storeName: string; description?: string; postalCode: string; whatsappPhone: string; city: string; state: string }) {
    const seller = await this.sellerDashboardRepository.findSellerByUserId(userId);
    if (!seller) {
      throw new AppError(403, "Vendedor nao encontrado");
    }

    return this.sellerDashboardRepository.updateSettings(seller.id, input);
  }

  async requestWithdrawal(userId: string, amount: number, pixKey: string) {
    const seller = await this.sellerDashboardRepository.findSellerByUserId(userId);
    if (!seller) throw new AppError(403, "Vendedor nao encontrado");
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, "Valor de saque invalido");
    const normalizedPixKey = pixKey.trim();
    if (normalizedPixKey.length < 3 || normalizedPixKey.length > 120) {
      throw new AppError(400, "Informe uma chave Pix valida");
    }

    const result = await this.sellerDashboardRepository.reserveWithdrawal(seller.id, amount, normalizedPixKey);
    if (!result.withdrawal) {
      throw new AppError(409, `Saldo disponivel para saque: R$ ${result.available.toFixed(2)}`);
    }
    return result.withdrawal;
  }
}
