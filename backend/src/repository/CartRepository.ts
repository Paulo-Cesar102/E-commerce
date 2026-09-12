import prisma from "../../prisma/prisma.js";

export class CartRepository {
  getCartWithItems(cartId: string) {
    return prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } }, variant: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  getOrCreateCart(userId: string) {
    return prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  findActiveProduct(productId: string) {
    return prisma.product.findFirst({ where: { id: productId, status: "ACTIVE" } });
  }
  findActiveVariant(productId: string, variantId: string) { return prisma.productVariant.findFirst({ where: { id: variantId, productId, active: true } }); }

  async upsertItem(cartId: string, productId: string, quantity: number, variantId?: string) {
    const existing = await prisma.cartItem.findFirst({ where: { cartId, productId, variantId: variantId ?? null } });
    return existing ? prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: { increment: quantity }, selected: true } }) : prisma.cartItem.create({ data: { cartId, productId, quantity, ...(variantId ? { variantId } : {}) } });
  }

  findOwnedItem(userId: string, itemId: string) {
    return prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { product: true, variant: true },
    });
  }

  updateItem(itemId: string, data: { quantity?: number; selected?: boolean }) {
    return prisma.cartItem.update({ where: { id: itemId }, data });
  }

  deleteItem(itemId: string) {
    return prisma.cartItem.delete({ where: { id: itemId } });
  }
}
