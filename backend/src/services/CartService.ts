import { AppError } from "../errors/AppError.js";
import { CartRepository } from "../repository/CartRepository.js";

export class CartService {
  constructor(private readonly cartRepository = new CartRepository()) {}

  async get(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    return this.cartRepository.getCartWithItems(cart.id);
  }

  async add(userId: string, productId: string, quantity: number, variantId?: string) {
    const product = await this.cartRepository.findActiveProduct(productId);
    const variant = variantId ? await this.cartRepository.findActiveVariant(productId, variantId) : null;
    if (!product || (variantId && (!variant || variant.stock < quantity)) || (!variantId && product.stock < quantity)) {
      throw new AppError(400, "Produto indisponivel");
    }

    const cart = await this.getOrCreateCart(userId);
    return this.cartRepository.upsertItem(cart.id, productId, quantity, variantId);
  }

  async update(userId: string, itemId: string, data: { quantity?: number; selected?: boolean }) {
    const item = await this.findOwnedItem(userId, itemId);
    if (data.quantity !== undefined && data.quantity > (item.variant?.stock ?? item.product.stock)) {
      throw new AppError(400, "Quantidade maior que o estoque disponivel");
    }
    return this.cartRepository.updateItem(item.id, data);
  }

  async remove(userId: string, itemId: string) {
    const item = await this.findOwnedItem(userId, itemId);
    await this.cartRepository.deleteItem(item.id);
  }

  private async getOrCreateCart(userId: string) {
    return this.cartRepository.getOrCreateCart(userId);
  }

  private async findOwnedItem(userId: string, itemId: string) {
    const item = await this.cartRepository.findOwnedItem(userId, itemId);

    if (!item) {
      throw new AppError(404, "Item do carrinho nao encontrado");
    }

    return item;
  }
}
