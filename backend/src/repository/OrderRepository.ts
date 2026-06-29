import prisma from "../../prisma/prisma.js";
import type { Prisma } from "../../generated/prisma/index.js";

export type PrismaTransaction = Prisma.TransactionClient;

export class OrderRepository {
  listMine(userId: string) {
    return prisma.order.findMany({
      where: { customerId: userId },
      include: { items: { include: { product: { include: { images: { take: 1 } } } } }, payment: true },
      orderBy: { createdAt: "desc" },
    });
  }

  findCheckoutCart(userId: string, itemIds?: string[]) {
    return prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          where: {
            selected: true,
            ...(itemIds ? { id: { in: itemIds } } : {}),
          },
          include: { product: true },
        },
      },
    });
  }

  transaction<T>(callback: (tx: PrismaTransaction) => Promise<T>) {
    return prisma.$transaction(callback);
  }

  createOrder(
    tx: PrismaTransaction,
    input: {
      customerId: string;
      sellerId: string;
      total: number;
      deliveryEstimateDate: Date;
      items: { productId: string; quantity: number; unitPrice: Prisma.Decimal | string | number }[];
    },
  ) {
    return tx.order.create({
      data: {
        customerId: input.customerId,
        sellerId: input.sellerId,
        total: input.total,
        deliveryEstimateDate: input.deliveryEstimateDate,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
        payment: { create: { status: "PENDING" } },
      },
      include: { items: { include: { product: true } }, payment: true },
    });
  }

  deleteCartItems(tx: PrismaTransaction, itemIds: string[]) {
    return tx.cartItem.deleteMany({ where: { id: { in: itemIds } } });
  }

  cancelOrders(tx: PrismaTransaction, orderIds: string[]) {
    return tx.order.updateMany({
      where: { id: { in: orderIds }, status: "PENDING_PAYMENT" },
      data: { status: "CANCELED" },
    });
  }

  updateOrderPayment(orderId: string, input: { mercadoPagoPreference: string | null; providerRef: string }) {
    return prisma.order.update({
      where: { id: orderId },
      data: {
        mercadoPagoPreference: input.mercadoPagoPreference,
        payment: {
          update: {
            providerRef: input.providerRef,
          },
        },
      },
      include: { payment: true, items: true },
    });
  }

  findOrderWithItemsAndPayment(tx: PrismaTransaction, orderId: string) {
    return tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
  }

  updatePaymentFromWebhook(
    tx: PrismaTransaction,
    input: {
      orderId: string;
      orderStatus: "PAID" | "CANCELED" | "REFUNDED";
      paymentStatus: "APPROVED" | "REJECTED" | "CANCELED" | "REFUNDED";
      providerRef?: string;
      rawPayload?: unknown;
    },
  ) {
    const paymentUpdate = {
      status: input.paymentStatus,
      ...(input.providerRef ? { providerRef: input.providerRef } : {}),
      ...(input.rawPayload === undefined ? {} : { rawPayload: input.rawPayload as object }),
    };

    return tx.order.update({
      where: { id: input.orderId },
      data: {
        status: input.orderStatus,
        payment: { update: paymentUpdate },
      },
      include: { payment: true, items: true },
    });
  }

  findSellerByUserId(userId: string) {
    return prisma.sellerProfile.findUnique({ where: { userId } });
  }

  findSellerOrderWithItems(tx: PrismaTransaction, sellerId: string, orderId: string) {
    return tx.order.findFirst({
      where: { id: orderId, sellerId },
      include: { items: true },
    });
  }

  updateSellerOrderStatus(
    tx: PrismaTransaction,
    orderId: string,
    data: { status: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED"; correiosTrackingCode?: string },
  ) {
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: data.status,
        ...(data.correiosTrackingCode ? { correiosTrackingCode: data.correiosTrackingCode } : {}),
      },
      include: { items: true },
    });
  }

  findOrderItems(orderId: string) {
    return prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  }
}
