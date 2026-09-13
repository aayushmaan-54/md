import { z } from "zod";

export const imageIdParamSchema = z.object({
  id: z.uuid("Invalid image id"),
});
