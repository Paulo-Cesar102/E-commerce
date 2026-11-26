import { AppError } from "../errors/AppError.js";
import { QuickSaleRepository } from "../repository/QuickSaleRepository.js";
import { FileStorageService } from "./FileStorageService.js";
import { SellerPlanService } from "./SellerPlanService.js";

export const QUICK_SALE_COMMISSION_PERCENT = 5;

export function calculateQuickSaleCommission(subtotal: number) {
  return Math.round(subtotal * QUICK_SALE_COMMISSION_PERCENT) / 100;
}

type QuickSaleInput = {
  categoryId: string;
  name: string;
  description: string;
  price: number;
  originPostalCode: string;
  images: { url: string; alt?: string }[];
};

export class QuickSaleService {
  constructor(
    private readonly repository = new QuickSaleRepository(),
    private readonly sellerPlans = new SellerPlanService(),
    private readonly fileStorage = new FileStorageService(),
  ) {}

  async getMine(userId: string) {
    const unlimited = await this.sellerPlans.hasProPlanForUser(userId);
    const [activeCount, listings, orders] = await Promise.all([
      this.repository.countActiveListings(userId),
      this.repository.findMine(userId),
      this.repository.findMySales(userId),
    ]);
    return {
      hasPro: unlimited,
      activeCount,
      activeLimit: unlimited ? null : 1,
      listings,
      orders: orders.map((order) => ({
        ...order,
        sellerNet: Number(order.subtotal) - Number(order.discount) - Number(order.platformFee),
      })),
    };
  }

  async create(userId: string, input: QuickSaleInput) {
    try {
      if (!(await this.repository.findActiveCategory(input.categoryId))) {
        throw new AppError(400, "Categoria invalida");
      }
      const unlimited = await this.sellerPlans.hasProPlanForUser(userId);
      return await this.repository.createListing(userId, input, unlimited);
    } catch (error) {
      await this.fileStorage.deleteUploadedFiles(input.images.map((image) => image.url));
      throw error;
    }
  }

  async updateListingStatus(userId: string, productId: string, status: "ACTIVE" | "INACTIVE") {
    const unlimited = await this.sellerPlans.hasProPlanForUser(userId);
    return this.repository.setListingStatus(productId, userId, status, unlimited);
  }

  async updateSaleOrderStatus(
    userId: string,
    orderId: string,
    status: "SHIPPED" | "DELIVERED",
    trackingCode?: string,
  ) {
    return this.repository.transaction(async (tx) => {
      const order = await this.repository.findOwnedSaleOrder(tx, orderId, userId);
      if (!order) throw new AppError(404, "Venda rapida nao encontrada");
      if (order.payment?.status !== "APPROVED") throw new AppError(409, "A venda ainda nao foi paga");
      if (status === "SHIPPED") {
        if (order.status !== "PAID") throw new AppError(409, "Apenas vendas pagas podem ser enviadas");
        if (!trackingCode) throw new AppError(400, "Informe o codigo de rastreio");
      } else if (order.status !== "SHIPPED") {
        throw new AppError(409, "A venda precisa estar enviada antes de ser marcada como entregue");
      }
      return this.repository.transitionSaleOrder(tx, {
        orderId,
        fromStatus: status === "SHIPPED" ? "PAID" : "SHIPPED",
        toStatus: status,
        userId,
        ...(trackingCode ? { trackingCode } : {}),
      });
    });
  }
}
