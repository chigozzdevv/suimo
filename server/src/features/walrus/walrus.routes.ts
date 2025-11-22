import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { WalrusClient, blobIdFromInt } from '@mysten/walrus'
import { SuiClient, SuiHTTPTransport, getFullnodeUrl } from '@mysten/sui/client'
import { loadEnv } from '@/config/env.js'
import { requireUser } from '@/middleware/auth.js'
import { providerSigner } from '@/services/walrus/walrus.service.js'
import { Agent, fetch as undiciFetch } from 'undici'

function pickFallbackRpc(primary?: string) {
  const publicNode = 'https://sui-testnet-rpc.publicnode.com'
  const chainbase = 'https://testnet-rpc.sui.chainbase.online'
  if (!primary) return publicNode
  return primary.includes('chainbase') ? publicNode : chainbase
}

function isConnectTimeoutError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase()
  return (
    msg.includes('connect timeout') ||
    msg.includes('timeout:') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  )
}

function makeSuiClient(rpc: string) {
  const agent = new Agent({ connectTimeout: 30_000, headersTimeout: 120_000, bodyTimeout: 0 })
  const transport = new SuiHTTPTransport({
    url: rpc,
    fetch: (input: any, init?: any) =>
      undiciFetch(input as any, { ...(init as any), dispatcher: agent } as any) as any,
  })
  return new SuiClient({ transport })
}

export async function registerWalrusRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>()

  r.post('/walrus/quote', {
    schema: {
      body: z.object({
        size_bytes: z.number().int().positive(),
        epochs: z.number().int().positive().max(53).default(1),
        deletable: z.boolean().optional(),
      })
    },
    preHandler: requireUser,
  }, async (req) => {
    const { size_bytes, epochs, deletable } = req.body as any
    const env = loadEnv()
    const network = env.WALRUS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
    let rpc = process.env.SUI_RPC_URL || env.SUI_RPC_URL || getFullnodeUrl('testnet')
    let sui = makeSuiClient(rpc)
    try { await sui.getProtocolConfig() } catch (e) {
      if (isConnectTimeoutError(e)) { rpc = pickFallbackRpc(rpc); sui = makeSuiClient(rpc) }
    }
    const walrus = new WalrusClient({ network, suiClient: sui as any })
    const { storageCost, writeCost, totalCost } = await walrus.storageCost(Number(size_bytes), Number(epochs))
    const dec = Number(process.env.WAL_DECIMALS || env.WAL_DECIMALS || 9)
    const toUi = (x: bigint) => Number(x) / Math.pow(10, dec)

    // Precise SUI gas estimate via dry-run of the register tx (sender = provider)
    let sui_est: number | null = null
    try {
      const userId = (req as any).userId as string
      const signer = await providerSigner(userId, 'payer')
      const owner = signer.toSuiAddress()
        ; (req as any).log?.info?.({ owner, network, rpc }, 'walrus_quote_owner')
      const fakeBlobId = blobIdFromInt(1n)
      const rootHash = new Uint8Array([1])
      const tx = walrus.registerBlobTransaction({
        size: Number(size_bytes),
        epochs: Number(epochs),
        blobId: fakeBlobId as any,
        rootHash,
        deletable: Boolean(deletable ?? true),
        owner,
      })
        ; (tx as any).setSenderIfNotSet(owner)
      const bytes = await (tx as any).build({ client: sui, onlyTransactionKind: true })
      const dry = await sui.dryRunTransactionBlock({ transactionBlock: bytes })
      const comp = BigInt(dry.effects.gasUsed.computationCost)
      const storage = BigInt(dry.effects.gasUsed.storageCost)
      const rebate = BigInt(dry.effects.gasUsed.storageRebate)
      const mist = comp + storage - rebate
      sui_est = Number(mist) / 1e9
    } catch (e: any) {
      // If wallet lacks enough WAL to build tx, keep SUI as null (UI shows ~)
      sui_est = null
    }
    return {
      encoded_bytes: undefined,
      epochs,
      wal_est: Number(toUi(totalCost).toFixed(6)),
      wal_breakdown: {
        storage: Number(toUi(storageCost).toFixed(6)),
        write: Number(toUi(writeCost).toFixed(6)),
      },
      sui_est,
    }
  })

  r.post('/walrus/extend-quote', {
    schema: {
      body: z.object({
        size_bytes: z.number().int().positive(),
        add_epochs: z.number().int().positive().max(53),
      })
    },
    preHandler: requireUser,
  }, async (req) => {
    const { size_bytes, add_epochs } = req.body as any
    const env = loadEnv()
    const network = env.WALRUS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
    let rpc = process.env.SUI_RPC_URL || env.SUI_RPC_URL || getFullnodeUrl('testnet')
    let sui = makeSuiClient(rpc)
    try { await sui.getProtocolConfig() } catch (e) {
      if (isConnectTimeoutError(e)) { rpc = pickFallbackRpc(rpc); sui = makeSuiClient(rpc) }
    }
    const walrus = new WalrusClient({ network, suiClient: sui as any })
    const { storageCost, totalCost, writeCost } = await walrus.storageCost(Number(size_bytes), Number(add_epochs))
    const dec = Number(process.env.WAL_DECIMALS || env.WAL_DECIMALS || 9)
    const toUi = (x: bigint) => Number(x) / Math.pow(10, dec)
    return {
      encoded_bytes: undefined,
      add_epochs,
      wal_est: Number(toUi(totalCost).toFixed(6)),
      wal_breakdown: {
        storage: Number(toUi(storageCost).toFixed(6)),
        write: Number(toUi(writeCost).toFixed(6)),
      },
      sui_est: null,
    }
  })

  r.post('/walrus/extend', {
    schema: {
      body: z.object({
        resource_id: z.string(),
        add_epochs: z.number().int().positive().max(53),
      })
    },
    preHandler: requireUser,
  }, async (req, reply) => {
    const { resource_id, add_epochs } = req.body as any
    const env = loadEnv()
    const network = env.WALRUS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
    let rpc = process.env.SUI_RPC_URL || env.SUI_RPC_URL || getFullnodeUrl('testnet')
    let sui = makeSuiClient(rpc)
    try { await sui.getProtocolConfig() } catch (e) {
      if (isConnectTimeoutError(e)) { rpc = pickFallbackRpc(rpc); sui = makeSuiClient(rpc) }
    }

    const walrus = new WalrusClient({ network, suiClient: sui as any })
    const userId = (req as any).userId as string
    const signer = await providerSigner(userId, 'payer')

    // Get resource to find blob object ID
    const { findResourceById } = await import('@/features/resources/resources.model.js')
    const resource = await findResourceById(resource_id)
    if (!resource) return reply.code(404).send({ error: 'Resource not found' })
    if (resource.provider_id !== userId) return reply.code(403).send({ error: 'Not your resource' })

    const blobObjectId = (resource as any).walrus_blob_object_id
    if (!blobObjectId) return reply.code(400).send({ error: 'Resource has no Walrus blob' })

    const owner = signer.toSuiAddress()

    try {
      await walrus.executeExtendBlobTransaction({
        signer: signer as any,
        blobObjectId,
        owner,
        epochs: add_epochs,
      })
      return { ok: true }
    } catch (e: any) {
      const msg = String(e?.message || 'EXTEND_FAILED')
      if (msg.includes('INSUFFICIENT') || msg.includes('Not enough coins')) {
        return reply.code(402).send({ error: 'INSUFFICIENT_WAL_OR_SUI' })
      }
      throw e
    }
  })
}
