import prisma from "../../prisma/prisma.js";
import { AppError } from "../errors/AppError.js";

export class CartService {
  async get(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    return prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async add(userId: string, productId: string, quantity: number) {
    const product = await prisma.product.findFirst({ where: { id: productId, status: "ACTIVE" } });
    if (!product || product.stock < quantity) {
      throw new AppError(400, "Produto indisponivel");
    }

    const cart = await this.getOrCreateCart(userId);
    return prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: { increment: quantity }, selected: true },
      create: { cartId: cart.id, productId, quantity },
    });
  }

  async update(userId: string, itemId: string, data: { quantity?: number; selected?: boolean }) {
    const item = await this.findOwnedItem(userId, itemId);
    return prisma.cartItem.update({
      where: { id: item.id },
      data,
    });
  }

  async remove(userId: string, itemId: string) {
    const item = await this.findOwnedItem(userId, itemId);
    await prisma.cartItem.delete({ where: { id: item.id } });
  }

  private async getOrCreateCart(userId: string) {
    return prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  private async findOwnedItem(userId: string, itemId: string) {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
    });

    if (!item) {
      throw new AppError(404, "Item do carrinho nao encontrado");
    }

    return item;
  }
}
