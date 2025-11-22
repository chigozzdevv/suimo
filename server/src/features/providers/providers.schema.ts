import { z } from "zod";
import { createResourceInput as _createResourceInput } from "@/features/resources/resources.schema.js";

export const createResourceInput = _createResourceInput; // backward compatibility

export const siteVerifyInput = z.object({
  domain: z.string(),
  method: z.enum(["dns", "file"]),
});

export const uploadDatasetInput = z.object({
  encrypted_object_b64: z.string().min(1),
  deletable: z.boolean().optional(),
  epochs: z.number().int().positive().max(52).optional(),
});

export const siteVerifyCheckInput = z.object({
  domain: z.string(),
  method: z.enum(["dns", "file"]),
  token: z.string(),
});
