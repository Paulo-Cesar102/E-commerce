import { createHmac } from "node:crypto";
import { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { QuickSaleRepository } from "../repository/QuickSaleRepository.js";
import { FileStorageService } from "./FileStorageService.js";
import { SellerPlanService } from "./SellerPlanService.js";

export const QUICK_SALE_COMMISSION_PERCENT = 5;

export function calculateQuickSaleCommission(subtotal: number) {
  return Math.round(subtotal * QUICK_SALE_COMMISSION_PERCENT) / 100;
}

type QuickSaleInput = {
  categoryId: string;
  condition: "NEW" | "USED";
  name: string;
  description: string;
  price: number;
  originPostalCode: string;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
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
    const [activeCount, listings, orders, verification] = await Promise.all([
      this.repository.countActiveListings(userId),
      this.repository.findMine(userId),
      this.repository.findMySales(userId),
      this.repository.findVerification(userId),
    ]);
    return {
      hasPro: unlimited,
      activeCount,
      activeLimit: unlimited ? null : 1,
      listings,
      verification,
      orders: orders.map((order) => ({
        ...order,
        sellerNet: Number(order.subtotal) - Number(order.discount) - Number(order.platformFee),
      })),
    };
  }

  async assertVerified(userId: string) {
    const verification = await this.repository.findVerification(userId);
    if (verification?.status !== "APPROVED") {
      throw new AppError(403, "Envie seu CPF e aguarde a análise manual antes de anunciar");
    }
  }

  async submitVerification(userId: string, input: { legalName: string; cpf: string }) {
    const current = await this.repository.findVerification(userId);
    if (current?.status === "APPROVED") {
      throw new AppError(409, "Sua verificação para Venda rápida já foi aprovada");
    }
    const cpf = input.cpf.replace(/\D/g, "");
    const cpfHash = createHmac("sha256", env.QUICK_SALE_CPF_HASH_SECRET ?? env.JWT_SECRET)
      .update(`quick-sale-cpf:${cpf}`)
      .digest("hex");

    try {
      return await this.repository.submitVerification({
        userId,
        legalName: input.legalName.trim(),
        cpfHash,
        cpfLastFour: cpf.slice(-4),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(409, "Este CPF já está associado a outra conta");
      }
      throw error;
    }
  }

  async create(userId: string, input: QuickSaleInput) {
    try {
      await this.assertVerified(userId);
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
    if (status === "ACTIVE") await this.assertVerified(userId);
    const unlimited = await this.sellerPlans.hasProPlanForUser(userId);
    return this.repository.setListingStatus(productId, userId, status, unlimited);
  }

  async updateSaleOrderStatus(
    userId: string,
    orderId: string,
    status: "SHIPPED" | "DELIVERED",
    trackingCodes?: string[],
  ) {
    return this.repository.transaction(async (tx) => {
      const order = await this.repository.findOwnedSaleOrder(tx, orderId, userId);
      if (!order) throw new AppError(404, "Venda rapida nao encontrada");
      if (order.payment?.status !== "APPROVED") throw new AppError(409, "A venda ainda nao foi paga");
      if (status === "SHIPPED") {
        if (order.status !== "PAID") throw new AppError(409, "Apenas vendas pagas podem ser enviadas");
        if (trackingCodes?.length !== order.shipments.length) {
          throw new AppError(400, `Informe um codigo de rastreio para cada pacote (${order.shipments.length})`);
        }
      } else if (order.status !== "SHIPPED") {
        throw new AppError(409, "A venda precisa estar enviada antes de ser marcada como entregue");
      }
      return this.repository.transitionSaleOrder(tx, {
        orderId,
        fromStatus: status === "SHIPPED" ? "PAID" : "SHIPPED",
        toStatus: status,
        userId,
        ...(trackingCodes ? { trackingCodes } : {}),
      });
    });
  }
}
