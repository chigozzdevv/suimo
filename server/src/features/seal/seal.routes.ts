import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { getAllowlistedKeyServers } from '@mysten/seal'
import { loadEnv } from '@/config/env.js'

export async function registerSealRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>()
  r.get('/seal/key-servers', async () => {
    const env = loadEnv()
    const network = (env.WALRUS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'
    try {
      const ids = getAllowlistedKeyServers(network)
      const toHex = (id: unknown): string => {
        if (!id) return ''
        if (typeof id === 'string') return id.startsWith('0x') ? id : `0x${id}`
        try {
          const u8 = id instanceof Uint8Array ? id : new Uint8Array(id as any)
          return '0x' + Buffer.from(u8).toString('hex')
        } catch {
          return ''
        }
      }
      const objectIds = Array.isArray(ids) ? ids.map(toHex).filter(Boolean) : []
      return { objectIds }
    } catch {
      return { objectIds: [] }
    }
  })
}
