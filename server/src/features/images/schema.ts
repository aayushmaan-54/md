import { z } from "zod";

export const imageIdParamSchema = z.object({
  id: z.uuid("Invalid image id"),
});

export type ImageIdParam = z.infer<typeof imageIdParamSchema>;
