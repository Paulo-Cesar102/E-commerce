import prisma from "../../prisma/prisma.js";
import { AppError } from "../errors/AppError.js";

export class ChatService {
  async list(userId: string) {
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

  async create(userId: string, sellerId: string, orderId?: string) {
    if (orderId) {
      const existing = await prisma.chat.findUnique({ where: { orderId } });
      if (existing) {
        return existing;
      }
    }

    return prisma.chat.create({
      data: { buyerId: userId, sellerId, ...(orderId ? { orderId } : {}) },
    });
  }

  async sendMessage(userId: string, chatId: string, content: string) {
    await this.ensureAccess(userId, chatId);

    const message = await prisma.chatMessage.create({
      data: { chatId, senderId: userId, content },
    });

    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
    return message;
  }

  async ensureAccess(userId: string, chatId: string) {
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ buyerId: userId }, { seller: { userId } }],
      },
      select: { id: true },
    });

    if (!chat) {
      throw new AppError(404, "Chat nao encontrado");
    }

    return chat;
  }
}
