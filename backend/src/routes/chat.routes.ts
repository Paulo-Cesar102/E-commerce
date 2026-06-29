import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { createChatSchema, messageSchema } from "../schemas/chat.schema.js";
import { ChatService } from "../services/ChatService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const chatRoutes = Router();
const chatService = new ChatService();

chatRoutes.use(authRequired);

chatRoutes.get("/", asyncHandler(async (req, res) => {
  res.json(await chatService.list(req.user!.sub));
}));

chatRoutes.post("/", validateBody(createChatSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await chatService.create(req.user!.sub, req.body.sellerId, req.body.orderId));
}));

chatRoutes.post("/:id/messages", validateBody(messageSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await chatService.sendMessage(req.user!.sub, String(req.params.id), req.body.content));
}));
