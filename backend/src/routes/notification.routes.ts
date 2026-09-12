import { Router } from "express";
import prisma from "../../prisma/prisma.js";
import { authRequired } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const notificationRoutes = Router();
notificationRoutes.use(authRequired);

notificationRoutes.get("/", asyncHandler(async (req, res) => {
  res.json(await prisma.notification.findMany({ where: { userId: req.user!.sub }, orderBy: { createdAt: "desc" }, take: 50 }));
}));

notificationRoutes.patch("/:id/read", asyncHandler(async (req, res) => {
  res.json(await prisma.notification.updateMany({ where: { id: String(req.params.id), userId: req.user!.sub }, data: { readAt: new Date() } }));
}));

notificationRoutes.post("/read-all", asyncHandler(async (req, res) => {
  res.json(await prisma.notification.updateMany({ where: { userId: req.user!.sub, readAt: null }, data: { readAt: new Date() } }));
}));