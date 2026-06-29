import { AppError } from "../errors/AppError.js";
import { ChatRepository } from "../repository/ChatRepository.js";

export class ChatService {
  constructor(private readonly chatRepository = new ChatRepository()) {}

  async list(userId: string) {
    return this.chatRepository.listByUser(userId);
  }

  async create(userId: string, sellerId: string, orderId?: string) {
    if (orderId) {
      const order = await this.chatRepository.findOrderForChat(orderId, userId, sellerId);
      if (!order) {
        throw new AppError(403, "Pedido nao pertence a este cliente e vendedor");
      }

      const existing = await this.chatRepository.findByOrder(orderId);
      if (existing) {
        return existing;
      }
    } else {
      const seller = await this.chatRepository.findSellerById(sellerId);
      if (!seller) {
        throw new AppError(404, "Vendedor nao encontrado");
      }
    }

    return this.chatRepository.create({ buyerId: userId, sellerId, ...(orderId ? { orderId } : {}) });
  }

  async sendMessage(userId: string, chatId: string, content: string) {
    if (typeof chatId !== "string" || !chatId) {
      throw new AppError(400, "Chat invalido");
    }

    const normalizedContent = typeof content === "string" ? content.trim() : "";
    if (normalizedContent.length < 1 || normalizedContent.length > 1000) {
      throw new AppError(400, "Mensagem deve ter entre 1 e 1000 caracteres");
    }

    await this.ensureAccess(userId, chatId);

    const message = await this.chatRepository.createMessage({ chatId, senderId: userId, content: normalizedContent });

    await this.chatRepository.touch(chatId);
    return message;
  }

  async ensureAccess(userId: string, chatId: string) {
    const chat = await this.chatRepository.findAccessible(userId, chatId);

    if (!chat) {
      throw new AppError(404, "Chat nao encontrado");
    }

    return chat;
  }
}
