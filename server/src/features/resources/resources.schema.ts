import { z } from 'zod';

const createResourceBase = z.object({
  title: z.string().min(2),
  type: z.enum(['site', 'dataset', 'file']),
  format: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  category: z.string().max(64).optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
  schema: z.array(z.string()).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  price_per_kb: z.number().nonnegative().optional(),
  price_flat: z.number().nonnegative().optional(),
  visibility: z.enum(['public', 'restricted']).default('public'),
  modes: z.array(z.enum(['raw', 'summary'])).default(['raw']),
  connector_id: z.string().optional(),
  sample_preview: z.string().optional(),
  allow_agent_ids: z.array(z.string()).optional(),
  deny_paths: z.array(z.string()).optional(),
  walrus_blob_id: z.string().optional(),
  walrus_quilt_id: z.string().optional(),
  walrus_blob_object_id: z.string().optional(),
  cipher_meta: z.object({ algo: z.string(), size_bytes: z.number().int().nonnegative(), content_type: z.string().optional() }).optional(),
  seal_policy_id: z.string().optional(),
});

export const createResourceInput = createResourceBase
  .superRefine((val, ctx) => {
    if (val.type === 'site' && (!val.domain || val.domain.trim().length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'domain is required for site resources', path: ['domain'] });
    }
  });

export const updateResourceInput = createResourceBase.partial();

export const getResourceQuery = z.object({ id: z.string().min(1) });
