import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        details: formatZodError(result.error),
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        details: formatZodError(result.error),
      });
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}

function formatZodError(error: ZodError) {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}