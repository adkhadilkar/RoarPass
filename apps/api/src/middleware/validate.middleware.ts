import type { Request, Response, NextFunction } from "express";
import { z, type ZodSchema } from "zod";

/**
 * Request body validation middleware factory.
 * Returns a 422 with structured errors on invalid input.
 * Satisfies: input validation NFR, OWASP A03.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(422).json({
        error: "VALIDATION_ERROR",
        details: result.error.flatten(),
      });
      return;
    }
    req.body = result.data; // replace with parsed/coerced data
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(422).json({
        error: "VALIDATION_ERROR",
        details: result.error.flatten(),
      });
      return;
    }
    (req as Request & { parsedQuery: T }).parsedQuery = result.data;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(422).json({
        error: "VALIDATION_ERROR",
        details: result.error.flatten(),
      });
      return;
    }
    next();
  };
}