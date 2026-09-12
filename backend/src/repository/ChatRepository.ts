import prisma from "../../prisma/prisma.js";

export class ChatRepository {
  listByUser(userId: string) {
    return prisma.chat.findMany({
      where: {
        OR: [{ buyerId: userId }, { seller: { userId } }],
      },
      include: {
        buyer: { select: { id: true, name: true } },
        seller: true,
        order: true,
        messages: { orderBy: { createdAt: "asc" }, take: 50 },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  findByOrder(orderId: string) {
    return prisma.chat.findUnique({ where: { orderId } });
  }

  findSellerById(sellerId: string) {
    return prisma.sellerProfile.findUnique({ where: { id: sellerId }, select: { id: true } });
  }

  findOrderForChat(orderId: string, buyerId: string, sellerId: string) {
    return prisma.order.findFirst({
      where: {
        id: orderId,
        customerId: buyerId,
        sellerId,
      },
      select: { id: true },
    });
  }

  create(data: { buyerId: string; sellerId: string; orderId?: string }) {
    return prisma.chat.create({ data });
  }

  findAccessible(userId: string, chatId: string, isAdmin = false) {
    return prisma.chat.findFirst({
      where: {
        id: chatId,
        ...(isAdmin ? {} : { OR: [{ buyerId: userId }, { seller: { userId } }] }),
      },
      select: { id: true },
    });
  }

  findById(chatId: string) {
    return prisma.chat.findUnique({ where: { id: chatId }, include: { buyer: { select: { id: true, name: true, email: true } }, seller: { select: { id: true, storeName: true } }, messages: { orderBy: { createdAt: "asc" }, take: 100 }, order: true } });
  }

  close(chatId: string) {
    return prisma.chat.update({ where: { id: chatId }, data: { status: "CLOSED" } });
  }

  createMessage(data: { chatId: string; senderId: string; content: string }) {
    return prisma.chatMessage.create({ data });
  }

  touch(chatId: string) {
    return prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
  }
}
