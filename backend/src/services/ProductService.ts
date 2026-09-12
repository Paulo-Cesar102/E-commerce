import { AppError } from "../errors/AppError.js";
import { ProductRepository } from "../repository/ProductRepository.js";
import { FileStorageService } from "./FileStorageService.js";

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
  variants?: { sku: string; attributes: Record<string, string>; price?: number; stock: number }[];
};

export class ProductService {
  constructor(
    private readonly productRepository = new ProductRepository(),
    private readonly fileStorage = new FileStorageService(),
  ) {}

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

    const { items, total } = await this.productRepository.list(where, orderBy, page, limit);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const product = await this.productRepository.findActiveById(id);

    if (!product) {
      throw new AppError(404, "Produto nao encontrado");
    }

    const related = await this.productRepository.findRelated(product.id, product.categoryId);

    return { product, related };
  }

  async categories() {
    return this.productRepository.findCategories();
  }

  async store(sellerId: string) {
    const seller = await this.productRepository.findStore(sellerId);

    if (!seller) {
      throw new AppError(404, "Loja nao encontrada");
    }

    const categories = await this.productRepository.findStoreCategories(sellerId);

    return { ...seller, categories };
  }

  async create(userId: string, input: ProductInput) {
    const seller = await this.getSeller(userId);
    await this.ensureCategory(input.categoryId);

    try {
      return await this.productRepository.createProduct(seller.id, input);
    } catch (error) {
      await this.fileStorage.deleteUploadedFiles(input.images?.map((image) => image.url) ?? []);
      throw error;
    }
  }

  async update(userId: string, productId: string, input: Partial<ProductInput> & { status?: "ACTIVE" | "INACTIVE" }) {
    const seller = await this.getSeller(userId);
    const product = await this.productRepository.findSellerProduct(productId, seller.id);
    if (!product) {
      throw new AppError(404, "Produto nao encontrado");
    }

    if (input.categoryId) {
      await this.ensureCategory(input.categoryId);
    }

    const previousImageUrls = product.images.map((image) => image.url);
    const nextImageUrls = input.images?.map((image) => image.url) ?? [];
    const removedImageUrls = input.images ? previousImageUrls.filter((url) => !nextImageUrls.includes(url)) : [];

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
      ...(input.variants
        ? {
            variants: {
              upsert: input.variants.map((variant) => ({
                where: { sku: variant.sku },
                update: { attributes: variant.attributes, ...(variant.price !== undefined ? { price: variant.price } : {}), stock: variant.stock, active: true },
                create: variant,
              })),
            },
          }
        : {}),
    };

    const updated = await this.productRepository.updateProduct(productId, data);
    await this.fileStorage.deleteUploadedFiles(removedImageUrls);

    return updated;
  }

  async delete(userId: string, productId: string) {
    const seller = await this.getSeller(userId);
    const result = await this.productRepository.deactivateProduct(productId, seller.id);

    if (result.count === 0) {
      throw new AppError(404, "Produto nao encontrado");
    }
  }

  async review(userId: string, productId: string, input: { orderId: string; rating: number; comment?: string }) {
    const orderItem = await this.productRepository.findDeliveredOrderItem(userId, productId, input.orderId);

    if (!orderItem) {
      throw new AppError(403, "Avaliacao liberada apenas para compra entregue");
    }

    return this.productRepository.createReviewAndRefreshRating({
      userId,
      productId,
      orderId: input.orderId,
      rating: input.rating,
      ...(input.comment ? { comment: input.comment } : {}),
    });
  }

  private async getSeller(userId: string) {
    const seller = await this.productRepository.findSellerByUserId(userId);
    if (!seller) {
      throw new AppError(403, "Vendedor nao encontrado");
    }

    return seller;
  }

  private async ensureCategory(categoryId: string) {
    const category = await this.productRepository.findActiveCategory(categoryId);
    if (!category) {
      throw new AppError(400, "Categoria invalida");
    }
  }
}
