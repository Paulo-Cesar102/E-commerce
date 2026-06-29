import prisma from "../../prisma/prisma.js";

export class CartRepository {
  getCartWithItems(cartId: string) {
    return prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } },
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

  upsertItem(cartId: string, productId: string, quantity: number) {
    return prisma.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      update: { quantity: { increment: quantity }, selected: true },
      create: { cartId, productId, quantity },
    });
  }

  findOwnedItem(userId: string, itemId: string) {
    return prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
    });
  }

  updateItem(itemId: string, data: { quantity?: number; selected?: boolean }) {
    return prisma.cartItem.update({ where: { id: itemId }, data });
  }

  deleteItem(itemId: string) {
    return prisma.cartItem.delete({ where: { id: itemId } });
  }
}
