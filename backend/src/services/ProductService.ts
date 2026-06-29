import prisma from "../../prisma/prisma.js";
import { AppError } from "../errors/AppError.js";

type ProductQuery = {
  q?: string;
  categoryId?: string;
  sellerId?: string;
  sort: "rating" | "new" | "price_asc" | "price_desc";
  page: number;
  limit: number;
};

type ProductInput = {
  categoryId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images?: { url: string; alt?: string }[];
  options?: { type: string; value: string }[];
};

export class ProductService {
  async list({ q, categoryId, sellerId, sort, page, limit }: ProductQuery) {
    const where = {
      status: "ACTIVE" as const,
      ...(categoryId ? { categoryId } : {}),
      ...(sellerId ? { sellerId } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };
    const orderBy =
      sort === "new"
        ? [{ createdAt: "desc" as const }]
        : sort === "price_asc"
          ? [{ price: "asc" as const }]
          : sort === "price_desc"
            ? [{ price: "desc" as const }]
            : [{ averageRating: "desc" as const }, { ratingCount: "desc" as const }, { createdAt: "desc" as const }];

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

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const product = await prisma.product.findFirst({
      where: { id, status: "ACTIVE" },
      include: {
        category: true,
        seller: true,
        images: { orderBy: { position: "asc" } },
        options: true,
        reviews: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    if (!product) {
      throw new AppError(404, "Produto nao encontrado");
    }

    const related = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        categoryId: product.categoryId,
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

    return { product, related };
  }

  async categories() {
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

  async store(sellerId: string) {
    const seller = await prisma.sellerProfile.findUnique({
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

    if (!seller) {
      throw new AppError(404, "Loja nao encontrada");
    }

    const categories = await prisma.category.findMany({
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

    return { ...seller, categories };
  }

  async create(userId: string, input: ProductInput) {
    const seller = await this.getSeller(userId);
    await this.ensureCategory(input.categoryId);

    return prisma.product.create({
      data: {
        sellerId: seller.id,
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

  async update(userId: string, productId: string, input: Partial<ProductInput> & { status?: "ACTIVE" | "INACTIVE" }) {
    const seller = await this.getSeller(userId);
    const product = await prisma.product.findFirst({ where: { id: productId, sellerId: seller.id } });
    if (!product) {
      throw new AppError(404, "Produto nao encontrado");
    }

    if (input.categoryId) {
      await this.ensureCategory(input.categoryId);
    }

    const data = {
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.images
        ? {
            images: {
              deleteMany: {},
              create: input.images.map((image, position) => ({ ...image, position })),
            },
          }
        : {}),
      ...(input.options
        ? {
            options: {
              deleteMany: {},
              create: input.options,
            },
          }
        : {}),
    };

    return prisma.product.update({
      where: { id: productId },
      data,
      include: { images: true, options: true },
    });
  }

  async delete(userId: string, productId: string) {
    const seller = await this.getSeller(userId);
    const result = await prisma.product.updateMany({
      where: { id: productId, sellerId: seller.id },
      data: { status: "INACTIVE" },
    });

    if (result.count === 0) {
      throw new AppError(404, "Produto nao encontrado");
    }
  }

  async review(userId: string, productId: string, input: { orderId: string; rating: number; comment?: string }) {
    const orderItem = await prisma.orderItem.findFirst({
      where: { orderId: input.orderId, productId, order: { customerId: userId, status: "DELIVERED" } },
    });

    if (!orderItem) {
      throw new AppError(403, "Avaliacao liberada apenas para compra entregue");
    }

    return prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          userId,
          productId,
          orderId: input.orderId,
          rating: input.rating,
          ...(input.comment ? { comment: input.comment } : {}),
        },
      });
      const aggregate = await tx.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.product.update({
        where: { id: productId },
        data: {
          averageRating: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count.rating,
        },
      });
      return review;
    });
  }

  private async getSeller(userId: string) {
    const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (!seller) {
      throw new AppError(403, "Vendedor nao encontrado");
    }

    return seller;
  }

  private async ensureCategory(categoryId: string) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, active: true } });
    if (!category) {
      throw new AppError(400, "Categoria invalida");
    }
  }
}
