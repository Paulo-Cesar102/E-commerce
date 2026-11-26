import prisma from "../../prisma/prisma.js";
import type { Prisma } from "../../generated/prisma/index.js";

export type PrismaTransaction = Prisma.TransactionClient;

export class OrderRepository {
  listMine(userId: string) {
    return prisma.order.findMany({
      where: { customerId: userId },
      include: {
        items: { include: { product: { include: { images: { take: 1 } } }, variant: true } },
        payment: true,
        shipments: { orderBy: { packageNumber: "asc" } },
        seller: { select: { id: true, storeName: true } },
        events: { orderBy: { createdAt: "desc" } },
        directSeller: { select: { id: true, name: true } },
      },
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
          include: {
            product: {
              include: {
                seller: true,
                ownerUser: { select: { id: true } },
                images: { take: 1, orderBy: { position: "asc" } },
              },
            },
            variant: true,
          },
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

  async releaseCouponReservations(tx: PrismaTransaction, orderIds: string[]) {
    const redemptions = await tx.couponRedemption.findMany({
      where: { orderId: { in: orderIds } },
      select: { couponId: true, id: true },
    });
    if (!redemptions.length) return;

    await tx.couponRedemption.deleteMany({ where: { id: { in: redemptions.map((item) => item.id) } } });
    const couponIds = [...new Set(redemptions.map((item) => item.couponId))];
    await Promise.all(couponIds.map((couponId) => tx.coupon.update({
      where: { id: couponId },
      data: { usedCount: { decrement: 1 } },
    })));
  }

  transaction<T>(callback: (tx: PrismaTransaction) => Promise<T>) {
    return prisma.$transaction(callback);
  }

  createOrder(
    tx: PrismaTransaction,
    input: {
      checkoutId: string;
      customerId: string;
      sellerId?: string;
      directSellerUserId?: string;
      subtotal: number;
      shippingCost: number;
      discount: number;
      platformFee: number;
      total: number;
      shippingMethod: string;
      shippingAddress: object;
      shipments: { provider: string; service: string; quotedDays: number; packageNumber: number; packageLabel?: string; rawPayload?: object }[];
      deliveryEstimateDate: Date;
      quickSalePayout?: boolean;
      items: { productId: string; variantId?: string | null; quantity: number; unitPrice: Prisma.Decimal | string | number; productName: string; productSku?: string; imageUrl?: string }[];
    },
  ) {
    return tx.order.create({
      data: {
        checkoutId: input.checkoutId,
        customerId: input.customerId,
        ...(input.sellerId ? { sellerId: input.sellerId } : {}),
        ...(input.directSellerUserId ? { directSellerUserId: input.directSellerUserId } : {}),
        subtotal: input.subtotal, shippingCost: input.shippingCost, discount: input.discount, platformFee: input.platformFee, total: input.total,
        ...(input.quickSalePayout ? { quickSalePayoutStatus: "PENDING" as const } : {}),
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
        shipments: { create: input.shipments },
        events: { create: { type: "CREATED", toStatus: "PENDING_PAYMENT" } },
      },
      include: { items: { include: { product: true } }, payment: true, shipments: { orderBy: { packageNumber: "asc" } } },
    });
  }

  deleteCartItems(tx: PrismaTransaction, itemIds: string[]) {
    return tx.cartItem.deleteMany({ where: { id: { in: itemIds } } });
  }

  async cancelOrders(tx: PrismaTransaction, orderIds: string[]) {
    const result = await tx.order.updateMany({
      where: { id: { in: orderIds }, status: "PENDING_PAYMENT" },
      data: { status: "CANCELED" },
    });
    await tx.order.updateMany({
      where: { id: { in: orderIds }, directSellerUserId: { not: null }, quickSalePayoutStatus: "PENDING" },
      data: { quickSalePayoutStatus: "VOIDED" },
    });
    return result;
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

  updateCheckoutPayment(checkoutId: string, input: { mercadoPagoPreference: string | null; providerRef: string }) {
    return prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({ where: { checkoutId }, select: { id: true } });
      await Promise.all(orders.map((order) => tx.order.update({
        where: { id: order.id },
        data: {
          mercadoPagoPreference: input.mercadoPagoPreference,
          payment: { update: { providerRef: input.providerRef } },
        },
      })));
      return tx.order.findMany({
        where: { checkoutId },
        include: { payment: true, items: true, shipments: { orderBy: { packageNumber: "asc" } } },
        orderBy: { createdAt: "asc" },
      });
    });
  }

  findCheckoutWithItemsAndPayment(tx: PrismaTransaction, checkoutId: string) {
    return tx.order.findMany({
      where: { checkoutId },
      include: { items: true, payment: true },
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
      quickSalePayoutStatus?: "VOIDED";
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
        ...(input.quickSalePayoutStatus ? { quickSalePayoutStatus: input.quickSalePayoutStatus } : {}),
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
      include: { items: true, payment: true, shipments: { orderBy: { packageNumber: "asc" } } },
    });
  }

  updateSellerOrderStatus(
    tx: PrismaTransaction,
    orderId: string,
    data: { status: "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED"; trackingCodes?: string[] },
  ) {
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: data.status,
        ...(data.trackingCodes?.[0] ? { correiosTrackingCode: data.trackingCodes[0] } : {}),
        ...(data.trackingCodes?.length
          ? {
              shipments: {
                update: data.trackingCodes.map((trackingCode, index) => ({
                  where: { orderId_packageNumber: { orderId, packageNumber: index + 1 } },
                  data: { trackingCode, ...(data.status === "SHIPPED" ? { status: "SHIPPED" } : {}) },
                })),
              },
            }
          : {}),
      },
      include: { items: true, payment: true, shipments: { orderBy: { packageNumber: "asc" } } },
    });
  }

  findCustomerOrderWithPayment(tx: PrismaTransaction, customerId: string, orderId: string) {
    return tx.order.findFirst({ where: { id: orderId, customerId }, include: { items: true, payment: true } });
  }

  hasDeniedReturnRequest(tx: PrismaTransaction, orderId: string) {
    return tx.orderEvent.findFirst({
      where: { orderId, type: "RETURN_DENIED" },
      select: { id: true },
    });
  }

  findExpiredPendingPayments(before: Date) {
    return prisma.order.findMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: before } }, select: { id: true } });
  }

  async transitionOrder(tx: PrismaTransaction, input: { orderId: string; fromStatus: "PENDING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED" | "RETURN_REQUESTED"; toStatus: "PENDING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELED" | "REFUNDED" | "RETURN_REQUESTED"; userId?: string; type: string; metadata?: object; trackingCodes?: string[] }) {
    const result = await tx.order.updateMany({
      where: { id: input.orderId, status: input.fromStatus },
      data: {
        status: input.toStatus,
        ...(input.trackingCodes?.[0] ? { correiosTrackingCode: input.trackingCodes[0] } : {}),
      },
    });
    if (result.count !== 1) throw new Error("ORDER_TRANSITION_CONFLICT");
    if (input.toStatus === "SHIPPED" && input.trackingCodes) {
      await Promise.all(input.trackingCodes.map((trackingCode, index) => tx.shipment.update({
        where: { orderId_packageNumber: { orderId: input.orderId, packageNumber: index + 1 } },
        data: { trackingCode, status: "SHIPPED" },
      })));
    }
    if (input.toStatus === "DELIVERED") {
      await tx.shipment.updateMany({ where: { orderId: input.orderId }, data: { status: "DELIVERED" } });
    }
    await tx.orderEvent.create({ data: { orderId: input.orderId, type: input.type, fromStatus: input.fromStatus, toStatus: input.toStatus, ...(input.userId ? { userId: input.userId } : {}), ...(input.metadata ? { metadata: input.metadata } : {}) } });
    return tx.order.findUnique({ where: { id: input.orderId }, include: { items: true, payment: true, shipments: { orderBy: { packageNumber: "asc" } } } });
  }

  findOrderItems(orderId: string) {
    return prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  }

  async markQuickSaleProductsSold(tx: PrismaTransaction, orderId: string) {
    const items = await tx.orderItem.findMany({
      where: { orderId, product: { listingType: "QUICK_SALE" } },
      select: { productId: true },
    });
    if (items.length) {
      await tx.product.updateMany({
        where: { id: { in: items.map((item) => item.productId) }, listingType: "QUICK_SALE" },
        data: { status: "INACTIVE", stock: 0 },
      });
    }
  }

  voidQuickSalePayout(tx: PrismaTransaction, orderId: string) {
    return tx.order.updateMany({
      where: { id: orderId, quickSalePayoutStatus: "PENDING" },
      data: { quickSalePayoutStatus: "VOIDED" },
    });
  }
}
