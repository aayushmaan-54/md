import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";
import type { ValidationTargets } from "hono";

export const validate = <
  T extends ZodType,
  Target extends keyof ValidationTargets,
>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) throw result.error;
  });
