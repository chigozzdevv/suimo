import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getDb } from "@/config/db.js";

const listQuery = z
  .object({ limit: z.coerce.number().int().positive().max(100).default(24) })
  .partial();

export async function listMarketsController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const q = listQuery.safeParse(req.query);
  const limit = q.success && q.data.limit ? q.data.limit : 24;
  const db = await getDb();
  const items = await db
    .collection<any>("resources")
    .aggregate([
      {
        $match: {
          category: { $exists: true, $ne: "" },
          $or: [{ visibility: { $exists: false } }, { visibility: "public" }],
        } as any,
      },
      {
        $group: {
          _id: "$category",
          updated_at: { $max: "$updated_at" },
          count: { $sum: 1 },
        } as any,
      },
      { $sort: { updated_at: -1 } as any },
      { $limit: limit },
    ] as any)
    .toArray();

  const humanize = (slug: string) =>
    slug.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const mapped = items.map((it: any) => ({
    _id: "cat_" + it._id,
    slug: it._id,
    title: humanize(String(it._id)),
    updated_at: it.updated_at,
  }));
  return reply.send({ items: mapped });
}

export async function getMarketController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const slug = String((req.params as any).slug);
  const db = await getDb();
  const resources = await db
    .collection<any>("resources")
    .find({
      category: slug,
      $or: [{ visibility: { $exists: false } }, { visibility: "public" }],
    } as any)
    .project({
      _id: 1,
      provider_id: 1,
      title: 1,
      type: 1,
      format: 1,
      domain: 1,
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
    .limit(48)
    .toArray();

  if (!resources.length)
    return reply.code(404).send({ error: "MARKET_NOT_FOUND" });

  const humanize = (s: string) =>
    s.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const tagCounts = new Map<string, number>();
  for (const r of resources) {
    const tags: string[] = Array.isArray(r.tags) ? r.tags : [];
    for (const t of tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);
  const market = {
    _id: "cat_" + slug,
    slug,
    title: humanize(slug),
    tags: topTags,
  };
  return reply.send({ market, resources });
}

export async function listMarketCategoriesController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const db = await getDb();
  const items = await db
    .collection<any>("resources")
    .aggregate([
      { $match: { category: { $exists: true, $ne: "" } } as any },
      { $group: { _id: "$category", count: { $sum: 1 } } as any },
      { $sort: { count: -1 } as any },
      { $limit: 100 },
    ] as any)
    .toArray();
  const categories = items.map((x: any) => String(x._id));
  return reply.send({ categories });
}
