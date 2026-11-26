import { AppError } from "../errors/AppError.js";
import { ProductRepository } from "../repository/ProductRepository.js";
import { FileStorageService } from "./FileStorageService.js";
import { SellerPlanService } from "./SellerPlanService.js";

type ProductQuery = {
  q?: string;
  categoryId?: string;
  sellerId?: string;
  listingType?: "QUICK_SALE";
  localOnly?: boolean;
  city?: string;
  state?: string;
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
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  images?: { url: string; alt?: string }[];
  options?: { type: string; value: string }[];
  variants?: { sku: string; attributes: Record<string, string>; price?: number; stock: number }[];
};

export class ProductService {
  constructor(
    private readonly productRepository = new ProductRepository(),
    private readonly fileStorage = new FileStorageService(),
    private readonly sellerPlans = new SellerPlanService(),
  ) {}

  async list({ q, categoryId, sellerId, listingType, localOnly, city, state, sort, page, limit }: ProductQuery) {
    const now = new Date();
    const proSeller = {
      seller: {
        is: {
          plan: "PRO" as const,
          OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }],
        },
      },
    };
    const localLocation = {
      ...(city ? { city: { equals: city, mode: "insensitive" as const } } : {}),
      ...(state ? { state: { equals: state, mode: "insensitive" as const } } : {}),
    };
    const localFreeSeller = city || state
      ? {
          seller: {
            is: {
              plan: "FREE" as const,
              ...localLocation,
            },
          },
        }
      : null;
    const quickSaleListing = { listingType: "QUICK_SALE" as const, stock: { gt: 0 } };
    const localStoreListing = {
      listingType: "STORE" as const,
      seller: {
        is: {
          plan: "FREE" as const,
          ...localLocation,
        },
      },
    };
    const where = {
      status: "ACTIVE" as const,
      ...(categoryId ? { categoryId } : {}),
      ...(sellerId ? { sellerId, listingType: "STORE" as const } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(localOnly
        ? localStoreListing
        : sellerId
          ? {}
          : listingType === "QUICK_SALE"
            ? quickSaleListing
            : { OR: localFreeSeller ? [proSeller, localFreeSeller, quickSaleListing] : [proSeller, quickSaleListing] }),
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

    return { items: items.map((item) => this.withEffectivePlan(item)), total, page, limit };
  }

  async findById(id: string) {
    const product = await this.productRepository.findActiveById(id);

    if (!product) {
      throw new AppError(404, "Produto nao encontrado");
    }

    const related = product.seller
      ? await this.productRepository.findRelated(
          product.id,
          product.categoryId,
          !this.isPro(product.seller.plan, product.seller.planExpiresAt) ? product.seller.city ?? undefined : undefined,
          !this.isPro(product.seller.plan, product.seller.planExpiresAt) ? product.seller.state ?? undefined : undefined,
        )
      : [];

    return {
      product: this.withEffectivePlan(product),
      related: related.map((item) => this.withEffectivePlan(item)),
    };
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
    const plan = this.isPro(seller.plan, seller.planExpiresAt) ? "PRO" : "FREE";
    return {
      ...seller,
      plan,
      products: seller.products.map((product) => ({
        ...product,
        seller: {
          id: seller.id,
          storeName: seller.storeName,
          plan,
          city: seller.city,
          state: seller.state,
          whatsappPhone: seller.whatsappPhone,
        },
      })),
      categories,
    };
  }

  async create(userId: string, input: ProductInput) {
    const seller = await this.getSeller(userId);
    await this.sellerPlans.assertCanCreateProduct(seller.id);
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

    if (product.status === "INACTIVE" && input.status === "ACTIVE") {
      await this.sellerPlans.assertCanCreateProduct(seller.id);
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
      ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams } : {}),
      ...(input.lengthCm !== undefined ? { lengthCm: input.lengthCm } : {}),
      ...(input.widthCm !== undefined ? { widthCm: input.widthCm } : {}),
      ...(input.heightCm !== undefined ? { heightCm: input.heightCm } : {}),
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

  private isPro(plan: string, expiresAt: Date | null) {
    return plan === "PRO" && (!expiresAt || expiresAt > new Date());
  }

  private withEffectivePlan<T extends { seller?: { plan: string; planExpiresAt: Date | null } | null }>(item: T) {
    if (!item.seller) return item;
    return {
      ...item,
      seller: {
        ...item.seller,
        plan: this.isPro(item.seller.plan, item.seller.planExpiresAt) ? "PRO" : "FREE",
        planExpiresAt: undefined,
      },
    };
  }
}
