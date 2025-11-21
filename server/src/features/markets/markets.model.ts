import { getDb } from '@/config/db.js'
import { randomUUID } from 'node:crypto'

export type MarketDoc = {
  _id: string
  slug: string
  title: string
  description?: string
  tags?: string[]
  resource_ids?: string[]
  created_at: string
  updated_at: string
}

export async function listMarkets(limit = 24): Promise<MarketDoc[]> {
  const db = await getDb()
  const items = await db
    .collection<MarketDoc>('markets')
    .find({} as any)
    .project({ _id: 1, slug: 1, title: 1, description: 1, tags: 1, updated_at: 1 } as any)
    .sort({ updated_at: -1 } as any)
    .limit(limit)
    .toArray()
  return items as any
}

export async function getMarketBySlug(slug: string): Promise<MarketDoc | null> {
  const db = await getDb()
  const doc = await db.collection<MarketDoc>('markets').findOne({ slug } as any)
  return doc || null
}

export async function insertMarket(doc: Omit<MarketDoc, '_id' | 'created_at' | 'updated_at'>) {
  const db = await getDb()
  const now = new Date().toISOString()
  const full: MarketDoc = { ...(doc as any), _id: 'mkt_' + randomUUID(), created_at: now, updated_at: now }
  await db.collection<MarketDoc>('markets').insertOne(full as any)
  return full
}

export async function updateMarket(slug: string, patch: Partial<Omit<MarketDoc, '_id' | 'created_at'>>) {
  const db = await getDb()
  const upd = { ...patch, updated_at: new Date().toISOString() }
  await db.collection<MarketDoc>('markets').updateOne({ slug } as any, { $set: upd } as any)
  return db.collection<MarketDoc>('markets').findOne({ slug } as any)
}
