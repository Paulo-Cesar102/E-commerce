import prisma from "../../prisma/prisma.js";
import type { Prisma } from "../../generated/prisma/index.js";

export type PrismaTransaction = Prisma.TransactionClient;

export class OrderRepository {
  listMine(userId: string) {
    return prisma.order.findMany({
      where: { customerId: userId },
      include: { items: { include: { product: { include: { images: { take: 1 } } }, variant: true } }, payment: true, shipment: true, events: { orderBy: { createdAt: "desc" } } },
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
          include: { product: { include: { seller: true, images: { take: 1, orderBy: { position: "asc" } } } }, variant: true },
        },
      },
    });
  }

  findCouponForCheckout(tx: PrismaTransaction, code: string, userId: string) {
    return tx.coupon.findUnique({
      where: { code: code.toUpperCase() },
      include: { redemptions: { where: { userId }, select: { id: true } } },
    });
  }

  reserveCoupon(tx: PrismaTransaction, couponId: string, userId: string, orderId: string, maxUses: number | null) {
    return tx.coupon.updateMany({
      where: { id: couponId, ...(maxUses === null ? {} : { usedCount: { lt: maxUses } }) },
      data: { usedCount: { increment: 1 } },
    }).then(async (result) => {
      if (result.count === 1) await tx.couponRedemption.create({ data: { couponId, userId, orderId } });
      return result;
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
      subtotal: number;
      shippingCost: number;
      discount: number;
      platformFee: number;
      total: number;
      shippingMethod: string;
      shippingAddress: object;
      shipment: { provider: string; service: string; quotedDays: number; rawPayload?: object };
      deliveryEstimateDate: Date;
      items: { productId: string; variantId?: string | null; quantity: number; unitPrice: Prisma.Decimal | string | number; productName: string; productSku?: string; imageUrl?: string }[];
    },
  ) {
    return tx.order.create({
      data: {
        customerId: input.customerId,
        sellerId: input.sellerId,
        subtotal: input.subtotal, shippingCost: input.shippingCost, discount: input.discount, platformFee: input.platformFee, total: input.total,
        shippingMethod: input.shippingMethod, shippingAddress: input.shippingAddress,
        deliveryEstimateDate: input.deliveryEstimateDate,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productName: item.productName,
            ...(item.productSku ? { productSku: item.productSku } : {}),
            ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
          })),
        },
        payment: { create: { status: "PENDING" } },
        shipment: { create: input.shipment },
        events: { create: { type: "CREATED", toStatus: "PENDING_PAYMENT" } },
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

  async registerWebhookEvent(tx: PrismaTransaction, paymentTransactionId: string, eventId: string, payload: object) {
    try {
      await tx.paymentWebhookEvent.create({ data: { provider: "MERCADO_PAGO", eventId, payload, paymentTransactionId } });
      return true;
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return false;
      throw error;
    }
  }

  markWebhookProcessed(tx: PrismaTransaction, provider: string, eventId: string) { return tx.paymentWebhookEvent.update({ where: { provider_eventId: { provider, eventId } }, data: { processedAt: new Date() } }); }

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
      include: { items: true, payment: true },
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
        ...(data.correiosTrackingCode ? { shipment: { update: { trackingCode: data.correiosTrackingCode, ...(data.status === "SHIPPED" ? { status: "SHIPPED" } : {}) } } } : {}),
      },
      include: { items: true, payment: true },
    });
  }

  findCustomerOrderWithPayment(tx: PrismaTransaction, customerId: string, orderId: string) {
    return tx.order.findFirst({ where: { id: orderId, customerId }, include: { items: true, payment: true } });
  }

  findExpiredPendingPayments(before: Date) {
    return prisma.order.findMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: before } }, select: { id: true } });
  }

  async transitionOrder(tx: PrismaTransaction, input: { orderId: string; fromStatus: "PENDING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED" | "RETURN_REQUESTED"; toStatus: "PENDING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED" | "RETURN_REQUESTED"; userId?: string; type: string; metadata?: object; trackingCode?: string }) {
    const result = await tx.order.updateMany({ where: { id: input.orderId, status: input.fromStatus }, data: { status: input.toStatus, ...(input.trackingCode ? { correiosTrackingCode: input.trackingCode } : {}) } });
    if (result.count !== 1) throw new Error("ORDER_TRANSITION_CONFLICT");
    await tx.orderEvent.create({ data: { orderId: input.orderId, type: input.type, fromStatus: input.fromStatus, toStatus: input.toStatus, ...(input.userId ? { userId: input.userId } : {}), ...(input.metadata ? { metadata: input.metadata } : {}) } });
    return tx.order.findUnique({ where: { id: input.orderId }, include: { items: true, payment: true, shipment: true } });
  }

  findOrderItems(orderId: string) {
    return prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  }
}
