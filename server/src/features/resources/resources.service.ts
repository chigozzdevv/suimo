import { randomUUID } from 'node:crypto';
import { getDb } from '@/config/db.js';
import type { ResourceDoc } from '@/features/resources/resources.model.js';
import { isDomainVerified } from '@/features/providers/sites.model.js';
import { getFaviconUrlForDomain, generatePlaceholderSvgDataUrl } from '@/utils/image-utils.js';
import { findConnectorById } from '@/features/connectors/connectors.model.js';

export async function createResourceForProvider(providerId: string, input: Omit<ResourceDoc, '_id' | 'provider_id' | 'updated_at' | 'verified'>) {
  const db = await getDb();
  if (input.type === 'site') {
    if (!input.domain) {
      throw new Error('DOMAIN_REQUIRED_FOR_SITE_RESOURCE');
    }
    const ok = await isDomainVerified(providerId, input.domain);
    if (!ok) {
      throw new Error('SITE_DOMAIN_NOT_VERIFIED');
    }
    if (!input.walrus_blob_id && !input.walrus_quilt_id) {
      // Enforce a connector for origin fetches
      if (!input.connector_id) {
        throw new Error('CONNECTOR_REQUIRED_FOR_SITE_FETCH');
      }
      const connector = await findConnectorById(input.connector_id);
      if (!connector) {
        throw new Error('CONNECTOR_NOT_FOUND');
      }
    }
  }
  const doc: ResourceDoc = {
    _id: 'res_' + randomUUID(),
    provider_id: providerId,
    title: input.title,
    type: input.type,
    format: input.format,
    domain: input.domain,
    path: input.path,
    category: input.category,
    tags: input.tags,
    summary: input.summary,
    sample_preview: (input as any).sample_preview,
    schema: input.schema,
    size_bytes: input.size_bytes,
    price_per_kb: input.price_per_kb,
    price_flat: input.price_flat,
    visibility: input.visibility,
    modes: input.modes,
    policy: { visibility: input.visibility as any, allow: (input as any).allow_agent_ids, deny_paths: (input as any).deny_paths, modes: input.modes as any },
    updated_at: new Date().toISOString(),
    connector_id: input.connector_id,
    image_url: (input as any).image_url,
    walrus_blob_id: input.walrus_blob_id,
    walrus_quilt_id: input.walrus_quilt_id,
    cipher_meta: input.cipher_meta,
    seal_policy_id: input.seal_policy_id,
    verified: true,
  };

  if (!doc.image_url) {
    if (doc.type === 'site' && doc.domain) {
      doc.image_url = getFaviconUrlForDomain(doc.domain);
    } else {
      doc.image_url = generatePlaceholderSvgDataUrl(doc.title);
    }
  }
  await db.collection<ResourceDoc>('resources').insertOne(doc as any);
  return doc;
}

export async function listResourcesByProvider(providerId: string, limit = 50) {
  const db = await getDb();
  return db
    .collection<ResourceDoc>('resources')
    .find({ provider_id: providerId } as any)
    .sort({ updated_at: -1 } as any)
    .limit(limit)
    .toArray();
}

export async function listPublicResources(limit = 24) {
  const db = await getDb();
  return db
    .collection<ResourceDoc>('resources')
    .find({ $or: [{ visibility: { $exists: false } }, { visibility: 'public' }] } as any)
    .project({
      _id: 1,
      provider_id: 1,
      title: 1,
      type: 1,
      format: 1,
      domain: 1,
      category: 1,
      summary: 1,
      tags: 1,
      sample_preview: 1,
      price_per_kb: 1,
      price_flat: 1,
      verified: 1,
      updated_at: 1,
      image_url: 1,
    } as any)
    .sort({ updated_at: -1 } as any)
    .limit(limit)
    .toArray();
}

export async function listPublicResourcesByTags(tags: string[], limit = 24) {
  const db = await getDb();
  const safeTags = Array.from(new Set((tags || []).filter(Boolean))).slice(0, 10);
  const filter: any = { $or: [{ visibility: { $exists: false } }, { visibility: 'public' }] };
  if (safeTags.length) {
    filter.tags = { $in: safeTags };
  }
  return db
    .collection<ResourceDoc>('resources')
    .find(filter)
    .project({
      _id: 1,
      provider_id: 1,
      title: 1,
      type: 1,
      format: 1,
      domain: 1,
      category: 1,
      summary: 1,
      tags: 1,
      sample_preview: 1,
      price_per_kb: 1,
      price_flat: 1,
      verified: 1,
      updated_at: 1,
      image_url: 1,
    } as any)
    .sort({ updated_at: -1 } as any)
    .limit(limit)
    .toArray();
}

export async function listPublicResourcesWithCategory(category: string, limit = 24) {
  const db = await getDb();
  return db
    .collection<ResourceDoc>('resources')
    .find({ category, $or: [{ visibility: { $exists: false } }, { visibility: 'public' }] } as any)
    .project({
      _id: 1,
      provider_id: 1,
      title: 1,
      type: 1,
      format: 1,
      domain: 1,
      category: 1,
      summary: 1,
      tags: 1,
      sample_preview: 1,
      price_per_kb: 1,
      price_flat: 1,
      verified: 1,
      updated_at: 1,
      image_url: 1,
    } as any)
    .sort({ updated_at: -1 } as any)
    .limit(limit)
    .toArray();
}

export async function searchPublicResources(query: string, opts?: { category?: string; format?: string[]; limit?: number }) {
  const db = await getDb();
  const tokens = Array.from(new Set(String(query).split(/[^a-zA-Z0-9]+/).filter(t => t.length > 1))).slice(0, 6);
  const orForToken = (t: string) => ({
    $or: [
      { title: { $regex: t, $options: 'i' } },
      { summary: { $regex: t, $options: 'i' } },
      { sample_preview: { $regex: t, $options: 'i' } },
      { domain: { $regex: t, $options: 'i' } },
      { tags: { $in: [new RegExp(t, 'i')] } },
    ],
  });
  const base: any = { $or: [{ visibility: { $exists: false } }, { visibility: 'public' }] };
  if (opts?.category) base.category = opts.category;
  const strict: any = tokens.length > 0
    ? { ...base, $and: tokens.map((t) => orForToken(t)) }
    : { ...base };
  if (opts?.format?.length) strict.format = { $in: opts.format };
  const limit = Math.min(Math.max(opts?.limit ?? 24, 1), 100);
  let list = await db.collection<ResourceDoc>('resources').find(strict).limit(limit).toArray();
  if (list.length === 0 && tokens.length > 0) {
    const anyPairs = tokens.flatMap((t) => (orForToken(t) as any).$or);
    const loose: any = { ...base, $or: anyPairs };
    if (opts?.format?.length) loose.format = { $in: opts.format };
    list = await db.collection<ResourceDoc>('resources').find(loose).limit(limit).toArray();
  }
  return list.map((r: any) => ({
    _id: r._id,
    provider_id: r.provider_id,
    title: r.title,
    type: r.type,
    format: r.format,
    domain: r.domain,
    category: r.category,
    summary: r.summary,
    tags: r.tags,
    sample_preview: r.sample_preview,
    price_per_kb: r.price_per_kb,
    price_flat: r.price_flat,
    verified: r.verified,
    updated_at: r.updated_at,
    image_url: r.image_url,
  }));
}
