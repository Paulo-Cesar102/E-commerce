import prisma from "../../prisma/prisma.js";
import type { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../errors/AppError.js";

export class QuickSaleRepository {
  countActiveListings(userId: string, exceptProductId?: string) {
    return prisma.product.count({
      where: {
        ownerUserId: userId,
        listingType: "QUICK_SALE",
        status: "ACTIVE",
        ...(exceptProductId ? { id: { not: exceptProductId } } : {}),
      },
    });
  }

  findActiveCategory(categoryId: string) {
    return prisma.category.findFirst({ where: { id: categoryId, active: true }, select: { id: true } });
  }

  async createListing(userId: string, input: {
    categoryId: string;
    name: string;
    description: string;
    price: number;
    originPostalCode: string;
    weightGrams: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    images: { url: string; alt?: string }[];
  }, unlimited: boolean) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
      if (!unlimited && await tx.product.count({
        where: { ownerUserId: userId, listingType: "QUICK_SALE", status: "ACTIVE" },
      }) >= 1) {
        throw new AppError(403, "O plano gratuito permite um anuncio ativo por vez. Desative outro anuncio ou use o Pro.");
      }
      return tx.product.create({
        data: {
          listingType: "QUICK_SALE",
          ownerUserId: userId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description,
          price: input.price,
          stock: 1,
          originPostalCode: input.originPostalCode,
          weightGrams: input.weightGrams,
          lengthCm: input.lengthCm,
          widthCm: input.widthCm,
          heightCm: input.heightCm,
          images: { create: input.images.map((image, position) => ({ ...image, position })) },
        },
        include: { category: true, images: { orderBy: { position: "asc" } } },
      });
    });
  }

  findOwnListing(productId: string, userId: string) {
    return prisma.product.findFirst({
      where: { id: productId, ownerUserId: userId, listingType: "QUICK_SALE" },
      select: { id: true, status: true, stock: true },
    });
  }

  async setListingStatus(productId: string, userId: string, status: "ACTIVE" | "INACTIVE", unlimited: boolean) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
      const listing = await tx.product.findFirst({
        where: { id: productId, ownerUserId: userId, listingType: "QUICK_SALE" },
        select: { id: true, status: true, stock: true },
      });
      if (!listing) throw new AppError(404, "Anuncio nao encontrado");
      if (listing.stock < 1) throw new AppError(409, "Este item esta reservado ou ja foi vendido");
      if (status === "ACTIVE" && !unlimited && listing.status !== "ACTIVE" && await tx.product.count({
        where: { ownerUserId: userId, listingType: "QUICK_SALE", status: "ACTIVE", id: { not: productId } },
      }) >= 1) {
        throw new AppError(403, "O plano gratuito permite um anuncio ativo por vez. Desative outro anuncio ou use o Pro.");
      }
      return tx.product.update({ where: { id: productId }, data: { status } });
    });
  }

  findMine(userId: string) {
    return prisma.product.findMany({
      where: { ownerUserId: userId, listingType: "QUICK_SALE" },
      include: { category: true, images: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  }

  findMySales(userId: string) {
    return prisma.order.findMany({
      where: { directSellerUserId: userId },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } } },
        payment: true,
        shipments: { orderBy: { packageNumber: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(callback);
  }

  findOwnedSaleOrder(tx: Prisma.TransactionClient, orderId: string, userId: string) {
    return tx.order.findFirst({
      where: { id: orderId, directSellerUserId: userId },
      include: { payment: true, items: true, shipments: { orderBy: { packageNumber: "asc" } } },
    });
  }

  transitionSaleOrder(tx: Prisma.TransactionClient, input: {
    orderId: string;
    fromStatus: "PAID" | "SHIPPED";
    toStatus: "SHIPPED" | "DELIVERED";
    userId: string;
    trackingCodes?: string[];
  }) {
    return this.transitionSaleOrderInTransaction(tx, input);
  }

  private async transitionSaleOrderInTransaction(tx: Prisma.TransactionClient, input: {
    orderId: string;
    fromStatus: "PAID" | "SHIPPED";
    toStatus: "SHIPPED" | "DELIVERED";
    userId: string;
    trackingCodes?: string[];
  }) {
    const updated = await tx.order.updateMany({
      where: { id: input.orderId, directSellerUserId: input.userId, status: input.fromStatus },
      data: {
        status: input.toStatus,
        ...(input.trackingCodes?.[0] ? { correiosTrackingCode: input.trackingCodes[0] } : {}),
      },
    });
    if (updated.count !== 1) throw new AppError(409, "A venda foi atualizada por outra solicitacao");
    if (input.toStatus === "SHIPPED") {
      await Promise.all((input.trackingCodes ?? []).map((trackingCode, index) => tx.shipment.update({
        where: { orderId_packageNumber: { orderId: input.orderId, packageNumber: index + 1 } },
        data: { status: "SHIPPED", trackingCode },
      })));
    } else {
      await tx.shipment.updateMany({ where: { orderId: input.orderId }, data: { status: "DELIVERED" } });
    }
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: "QUICK_SALE_STATUS_CHANGE",
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        userId: input.userId,
      },
    });
    return tx.order.findUnique({
      where: { id: input.orderId },
      include: { items: true, payment: true, shipments: { orderBy: { packageNumber: "asc" } } },
    });
  }

  findEligiblePayouts(before: Date) {
    return prisma.order.findMany({
      where: {
        directSellerUserId: { not: null },
        quickSalePayoutStatus: "PENDING",
        status: "DELIVERED",
        updatedAt: { lt: before },
        payment: { status: "APPROVED" },
      },
      include: {
        directSeller: { select: { id: true, name: true, email: true } },
        customer: { select: { name: true } },
        items: { select: { productName: true, quantity: true, unitPrice: true } },
      },
      orderBy: { updatedAt: "asc" },
    });
  }

  async markPayoutPaid(orderId: string, reference: string) {
    return prisma.order.updateMany({
      where: {
        id: orderId,
        quickSalePayoutStatus: "PENDING",
        status: "DELIVERED",
        payment: { status: "APPROVED" },
        updatedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      data: {
        quickSalePayoutStatus: "PAID",
        quickSalePayoutReference: reference,
        quickSalePayoutPaidAt: new Date(),
      },
    });
  }
}
