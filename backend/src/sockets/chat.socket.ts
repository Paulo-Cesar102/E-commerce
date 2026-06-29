import type { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ChatService } from "../services/ChatService.js";

const chatService = new ChatService();

export const registerChatSocket = (io: Server) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      next(new Error("Token ausente"));
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (typeof payload === "string" || !payload.sub) {
        throw new Error("Token invalido");
      }

      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Token invalido"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("chat:join", async (chatId: string) => {
      try {
        if (typeof chatId !== "string") {
          throw new Error("Chat invalido");
        }
        await chatService.ensureAccess(socket.data.userId, chatId);
        await socket.join(`chat:${chatId}`);
      } catch {
        socket.emit("chat:error", { message: "Acesso negado ao chat" });
      }
    });

    socket.on("chat:message", async (payload: { chatId: string; content: string }) => {
      try {
        if (!payload || typeof payload.chatId !== "string" || typeof payload.content !== "string") {
          throw new Error("Mensagem invalida");
        }
        const message = await chatService.sendMessage(socket.data.userId, payload.chatId, payload.content);
        io.to(`chat:${payload.chatId}`).emit("chat:message", message);
      } catch {
        socket.emit("chat:error", { message: "Nao foi possivel enviar a mensagem" });
      }
    });
  });
};
