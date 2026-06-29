import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { addCartItemSchema, updateCartItemSchema } from "../schemas/cart.schema.js";
import { CartService } from "../services/CartService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const cartRoutes = Router();
const cartService = new CartService();

cartRoutes.use(authRequired);

cartRoutes.get("/", asyncHandler(async (req, res) => {
  res.json(await cartService.get(req.user!.sub));
}));

cartRoutes.post("/items", validateBody(addCartItemSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await cartService.add(req.user!.sub, req.body.productId, req.body.quantity));
}));

cartRoutes.patch("/items/:id", validateBody(updateCartItemSchema), asyncHandler(async (req, res) => {
  res.json(await cartService.update(req.user!.sub, String(req.params.id), req.body));
}));

cartRoutes.delete("/items/:id", asyncHandler(async (req, res) => {
  await cartService.remove(req.user!.sub, String(req.params.id));
  res.status(204).send();
}));
