import prisma from "../../prisma/prisma.js";
import { AppError } from "../errors/AppError.js";
import { CorreiosService } from "./CorreiosService.js";
import { MercadoPagoService } from "./MercadoPagoService.js";
import { StockService } from "./StockService.js";

export class OrderService {
  constructor(
    private readonly stockService = new StockService(),
    private readonly mercadoPago = new MercadoPagoService(),
    private readonly correios = new CorreiosService(),
  ) {}

  async listMine(userId: string) {
    return prisma.order.findMany({
      where: { customerId: userId },
      include: { items: { include: { product: { include: { images: { take: 1 } } } } }, payment: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async checkout(userId: string, input: { zipCode?: string; itemIds?: string[] }) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          where: {
            selected: true,
            ...(input.itemIds ? { id: { in: input.itemIds } } : {}),
          },
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new AppError(400, "Carrinho vazio");
    }

    const itemsBySeller = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const list = itemsBySeller.get(item.product.sellerId) ?? [];
      list.push(item);
      itemsBySeller.set(item.product.sellerId, list);
    }

    const deliveryEstimateDate = await this.correios.estimateDeliveryDate(input.zipCode);
    const orders = [];

    for (const [sellerId, items] of itemsBySeller) {
      const order = await prisma.$transaction(async (tx) => {
        await this.stockService.reserve(
          tx,
          items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        );

        const total = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
        const createdOrder = await tx.order.create({
          data: {
            customerId: userId,
            sellerId,
            total,
            deliveryEstimateDate,
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.product.price,
              })),
            },
            payment: { create: { status: "PENDING" } },
          },
          include: { items: { include: { product: true } }, payment: true },
        });

        await tx.cartItem.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });
        return createdOrder;
      });

      const preference = await this.mercadoPago.createPreference({
        orderId: order.id,
        items: order.items.map((item) => ({
          title: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        })),
      });

      orders.push(
        await prisma.order.update({
          where: { id: order.id },
          data: {
            mercadoPagoPreference: preference.initPoint ?? preference.sandboxInitPoint,
            payment: {
              update: {
                providerRef: preference.providerRef,
              },
            },
          },
          include: { payment: true, items: true },
        }),
      );
    }

    return orders;
  }

  async applyPaymentWebhook(input: { orderId: string; providerRef?: string; status: "APPROVED" | "REJECTED" | "CANCELED" | "REFUNDED"; rawPayload?: unknown }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { items: true, payment: true },
      });

      if (!order) {
        throw new AppError(404, "Pedido nao encontrado");
      }

      if (["REJECTED", "CANCELED", "REFUNDED"].includes(input.status) && order.status === "PENDING_PAYMENT") {
        await this.stockService.release(
          tx,
          order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        );
      }

      const paymentUpdate = {
        status: input.status,
        ...(input.providerRef ? { providerRef: input.providerRef } : {}),
        ...(input.rawPayload === undefined ? {} : { rawPayload: input.rawPayload as object }),
      };

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: input.status === "APPROVED" ? "PAID" : input.status === "REFUNDED" ? "REFUNDED" : "CANCELED",
          payment: { update: paymentUpdate },
        },
        include: { payment: true, items: true },
      });
    });
  }

  async updateSellerOrder(userId: string, orderId: string, status: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED", correiosTrackingCode?: string) {
    const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (!seller) {
      throw new AppError(403, "Vendedor nao encontrado");
    }

    const result = await prisma.order.updateMany({
      where: { id: orderId, sellerId: seller.id },
      data: { status, ...(correiosTrackingCode ? { correiosTrackingCode } : {}) },
    });

    if (result.count === 0) {
      throw new AppError(404, "Pedido nao encontrado");
    }

    return prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  }
}
