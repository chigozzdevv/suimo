import { loadEnv } from '@/config/env.js'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { fromB64 } from '@mysten/sui/utils'
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography'

function client() {
  const env = loadEnv()
  const url = process.env.SUI_RPC_URL || env.SUI_RPC_URL || getFullnodeUrl('testnet')
  return new SuiClient({ url })
}

function resolveWalCoinType(): string {
  const env = loadEnv()
  const configured = (process.env.WAL_COIN_TYPE || env.WAL_COIN_TYPE || '').trim()
  if (configured) return configured
  const network = env.WALRUS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
  return network === 'mainnet'
    ? '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL'
    : '0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL'
}

function resolveWalDecimals(): number {
  return Number(process.env.WAL_DECIMALS || loadEnv().WAL_DECIMALS || 9)
}

function platformKeypair() {
  const env = loadEnv()
  const raw = (process.env.SUI_PLATFORM_PRIVATE_KEY || env.SUI_PLATFORM_PRIVATE_KEY || '').trim()
  if (!raw) throw new Error('SUI_PLATFORM_PRIVATE_KEY missing')

  const to32 = (bytes: Uint8Array) => (bytes.length === 32 ? bytes : bytes.slice(0, 32))

  try {
    if (raw.toLowerCase().startsWith('suiprivkey')) {
      const { secretKey } = decodeSuiPrivateKey(raw)
      return Ed25519Keypair.fromSecretKey(to32(secretKey))
    }
    let cleaned = raw
    if (cleaned.includes(':')) cleaned = cleaned.split(':').pop()!.trim()
    let bytes: Uint8Array
    const hex = cleaned.startsWith('0x') ? cleaned.slice(2) : cleaned
    const isHex = /^[0-9a-fA-F]+$/.test(hex)
    if (isHex && (hex.length % 2 === 0)) {
      bytes = new Uint8Array(Buffer.from(hex, 'hex'))
    } else {
      bytes = fromB64(cleaned)
    }
    if (bytes.length !== 32) bytes = to32(bytes)
    return Ed25519Keypair.fromSecretKey(bytes)
  } catch (e: any) {
    throw new Error(`Invalid SUI_PLATFORM_PRIVATE_KEY format: ${e?.message || e}`)
  }
}

function toAtomic(amountUi: string | number, decimals: number): bigint {
  const s = String(amountUi)
  const [ints, frac = ''] = s.split('.')
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  const joined = `${ints}${fracPadded}`.replace(/^0+/, '') || '0'
  return BigInt(joined)
}

export async function getBalances(address: string) {
  const c = client()
  const suiBal = await c.getBalance({ owner: address })
  const walType = resolveWalCoinType()
  const dec = resolveWalDecimals()
  let wal = 0
  try {
    const b = await c.getBalance({ owner: address, coinType: walType })
    wal = Number(b.totalBalance || '0') / Math.pow(10, dec)
  } catch {}
  const sui = Number(suiBal.totalBalance || '0') / 1e9
  return { sui, wal }
}

export async function transferWal(toAddress: string, amountUi: number | string): Promise<string> {
  const coinType = resolveWalCoinType()
  const decimals = resolveWalDecimals()
  const kp = platformKeypair()
  const c = client()
  const owner = kp.getPublicKey().toSuiAddress()
  const coins = await c.getCoins({ owner, coinType, limit: 200 })
  const total = coins.data.reduce((acc, x) => acc + BigInt(x.balance), 0n)
  const need = toAtomic(amountUi, decimals)
  if (total < need) throw new Error('INSUFFICIENT_FUNDS')
  const tx = new Transaction()
  if (coins.data.length === 0) throw new Error('NO_COINS')
  let primary = tx.object(coins.data[0].coinObjectId)
  if (coins.data.length > 1) {
    const rest = coins.data.slice(1).map((c) => tx.object(c.coinObjectId))
    tx.mergeCoins(primary, rest)
  }
  const [pay] = tx.splitCoins(primary, [tx.pure.u64(Number(need))])
  tx.transferObjects([pay], tx.pure.address(toAddress))
  tx.setGasBudget(5_000_000)
  const res = await c.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true } })
  return res.digest
}

export async function topUpSui(toAddress: string, amountSui: number): Promise<string> {
  const kp = platformKeypair()
  const c = client()
  const tx = new Transaction()
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(Math.round(amountSui * 1e9))])
  tx.transferObjects([coin], tx.pure.address(toAddress))
  tx.setGasBudget(5_000_000)
  const res = await c.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true } })
  return res.digest
}

// signup funding removed per product decision
