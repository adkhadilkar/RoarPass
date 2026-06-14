import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { createApiError, HTTP_STATUS } from "../utils/errors";

/**
 * Factory middleware that validates a part of the request against a Zod schema.
 * Usage: router.post('/path', validate('body', MySchema), handler)
 */
export function validate<T>(
  target: "body" | "query" | "params",
  schema: ZodSchema<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const details = result.error.flatten();
      res.status(HTTP_STATUS.VALIDATION).json(
        createApiError("VALIDATION_ERROR", "Request validation failed", req, {
          fields: details.fieldErrors,
          form: details.formErrors,
        })
      );
      return;
    }

    // Replace the raw input with the parsed/coerced output
    (req as any)[`_parsed_${target}`] = result.data;
    next();
  };
}

/**
 * Helper to retrieve the parsed value set by the validate() middleware.
 */
export function getParsed<T>(
  req: Request,
  target: "body" | "query" | "params"
): T {
  return (req as any)[`_parsed_${target}`] as T;
}