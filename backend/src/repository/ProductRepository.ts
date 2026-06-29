import prisma from "../../prisma/prisma.js";
import type { Prisma } from "../../generated/prisma/index.js";

type ProductInput = {
  categoryId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images?: { url: string; alt?: string }[];
  options?: { type: string; value: string }[];
};

type ProductWhere = Prisma.ProductWhereInput;
type ProductOrderBy = Prisma.ProductOrderByWithRelationInput[];

export class ProductRepository {
  async list(where: ProductWhere, orderBy: ProductOrderBy, page: number, limit: number) {
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          images: { orderBy: { position: "asc" } },
          reviews: { select: { rating: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  findActiveById(id: string) {
    return prisma.product.findFirst({
      where: { id, status: "ACTIVE" },
      include: {
        category: true,
        seller: true,
        images: { orderBy: { position: "asc" } },
        options: true,
        reviews: { include: { user: { select: { id: true, name: true } } } },
      },
    });
  }

  findRelated(productId: string, categoryId: string) {
    return prisma.product.findMany({
      where: {
        id: { not: productId },
        categoryId,
        status: "ACTIVE",
      },
      include: {
        category: true,
        seller: true,
        reviews: { select: { rating: true } },
        images: { take: 1, orderBy: { position: "asc" } },
      },
      orderBy: [{ averageRating: "desc" }, { ratingCount: "desc" }],
      take: 6,
    });
  }

  findCategories() {
    return prisma.category.findMany({
      where: { active: true },
      include: {
        _count: { select: { products: { where: { status: "ACTIVE" } } } },
        products: {
          where: { status: "ACTIVE", images: { some: {} } },
          select: { images: { take: 1, orderBy: { position: "asc" } } },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });
  }

  findStore(sellerId: string) {
    return prisma.sellerProfile.findUnique({
      where: { id: sellerId },
      include: {
        products: {
          where: { status: "ACTIVE" },
          include: {
            category: true,
            images: { orderBy: { position: "asc" } },
            reviews: { select: { rating: true } },
          },
          orderBy: [{ averageRating: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }],
        },
      },
    });
  }

  findStoreCategories(sellerId: string) {
    return prisma.category.findMany({
      where: {
        active: true,
        products: { some: { sellerId, status: "ACTIVE" } },
      },
      include: {
        _count: {
          select: { products: { where: { sellerId, status: "ACTIVE" } } },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  findSellerByUserId(userId: string) {
    return prisma.sellerProfile.findUnique({ where: { userId } });
  }

  findActiveCategory(categoryId: string) {
    return prisma.category.findFirst({ where: { id: categoryId, active: true } });
  }

  createProduct(sellerId: string, input: ProductInput) {
    return prisma.product.create({
      data: {
        sellerId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        price: input.price,
        stock: input.stock,
        images: { create: input.images?.map((image, position) => ({ ...image, position })) ?? [] },
        options: { create: input.options ?? [] },
      },
      include: { images: true, options: true },
    });
  }

  findSellerProduct(productId: string, sellerId: string) {
    return prisma.product.findFirst({
      where: { id: productId, sellerId },
      include: { images: true },
    });
  }

  updateProduct(productId: string, data: Parameters<typeof prisma.product.update>[0]["data"]) {
    return prisma.product.update({
      where: { id: productId },
      data,
      include: { images: true, options: true },
    });
  }

  deactivateProduct(productId: string, sellerId: string) {
    return prisma.product.updateMany({
      where: { id: productId, sellerId },
      data: { status: "INACTIVE" },
    });
  }

  findDeliveredOrderItem(userId: string, productId: string, orderId: string) {
    return prisma.orderItem.findFirst({
      where: { orderId, productId, order: { customerId: userId, status: "DELIVERED" } },
    });
  }

  createReviewAndRefreshRating(input: { userId: string; productId: string; orderId: string; rating: number; comment?: string }) {
    return prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          userId: input.userId,
          productId: input.productId,
          orderId: input.orderId,
          rating: input.rating,
          ...(input.comment ? { comment: input.comment } : {}),
        },
      });
      const aggregate = await tx.review.aggregate({
        where: { productId: input.productId },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.product.update({
        where: { id: input.productId },
        data: {
          averageRating: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count.rating,
        },
      });
      return review;
    });
  }
}
