import type { Request, Response, NextFunction, RequestHandler } from "express";

type Issue = { path: (string | number)[]; message: string };
type Schema = {
  safeParse: (data: unknown) =>
    | { success: true; data: unknown }
    | { success: false; error: { issues: Issue[] } };
};

// Validate request bodies against the generated Zod schemas (from the OpenAPI
// spec). Returns 400 with a readable message when the body is invalid, so bad
// numeric values (negative amounts, discount > 100, guest count < 1, ...)
// never reach the database.
export function validateBody(schema: Schema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      return res.status(400).json({ error: `بيانات غير صالحة — ${issues}` });
    }
    return next();
  };
}
