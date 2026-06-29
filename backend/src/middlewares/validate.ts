import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
    }
  }
}

export const validateBody =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };

export const validateQuery =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    req.validatedQuery = schema.parse(req.query);
    next();
  };
