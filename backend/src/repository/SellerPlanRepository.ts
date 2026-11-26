import prisma from "../../prisma/prisma.js";

export class SellerPlanRepository {
  findByUserId(userId: string) {
    return prisma.sellerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        plan: true,
        planExpiresAt: true,
        subscriptionStatus: true,
        mercadoPagoSubscriptionId: true,
        subscriptionExternalReference: true,
        subscriptionCheckoutUrl: true,
        whatsappPhone: true,
        city: true,
        state: true,
        user: { select: { email: true } },
      },
    });
  }

  findByProfileId(sellerId: string) {
    return prisma.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { plan: true, planExpiresAt: true },
    });
  }

  findLocalStoreDetails(sellerId: string) {
    return prisma.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { whatsappPhone: true, city: true, state: true },
    });
  }

  findByExternalReference(reference: string) {
    return prisma.sellerProfile.findUnique({
      where: { subscriptionExternalReference: reference },
      select: { id: true, mercadoPagoSubscriptionId: true },
    });
  }

  updateById(sellerId: string, data: Parameters<typeof prisma.sellerProfile.update>[0]["data"]) {
    return prisma.sellerProfile.update({ where: { id: sellerId }, data });
  }

  countProducts(sellerId: string, status?: "ACTIVE") {
    return prisma.product.count({
      where: { sellerId, ...(status ? { status } : {}) },
    });
  }

  findSellersByIds(sellerIds: string[]) {
    return prisma.sellerProfile.findMany({
      where: { id: { in: sellerIds } },
      select: {
        id: true,
        plan: true,
        planExpiresAt: true,
      },
    });
  }
}
