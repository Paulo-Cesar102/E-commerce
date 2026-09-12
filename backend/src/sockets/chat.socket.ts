import type { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ChatService } from "../services/ChatService.js";
import prisma from "../../prisma/prisma.js";

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
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Token invalido"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("admin:join", async () => {
      if (socket.data.role !== "ADMIN") {
        socket.emit("chat:error", { message: "Acesso administrativo negado" });
        return;
      }
      await socket.join("admin:dashboard");
    });

    socket.on("chat:join", async (chatId: string) => {
      try {
        if (typeof chatId !== "string") {
          throw new Error("Chat invalido");
        }
        await chatService.ensureAccess(socket.data.userId, chatId, socket.data.role === "ADMIN");
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
        const message = await chatService.sendMessage(socket.data.userId, payload.chatId, payload.content, socket.data.role === "ADMIN");
        io.to(`chat:${payload.chatId}`).emit("chat:message", message);
        const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
        if (admins.length) await prisma.notification.createMany({ data: admins.map((admin) => ({ userId: admin.id, type: "SUPPORT_MESSAGE", title: "Novo chamado de suporte", body: "Uma nova mensagem foi recebida.", data: { chatId: payload.chatId } })) });
        io.to("admin:dashboard").emit("admin:refresh", { type: "SUPPORT_MESSAGE", chatId: payload.chatId });
      } catch {
        socket.emit("chat:error", { message: "Nao foi possivel enviar a mensagem" });
      }
    });
  });
};
