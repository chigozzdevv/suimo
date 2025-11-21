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

function platformKeypair() {
  const env = loadEnv()
  const raw = process.env.SUI_PLATFORM_PRIVATE_KEY || env.SUI_PLATFORM_PRIVATE_KEY
  if (!raw) throw new Error('SUI_PLATFORM_PRIVATE_KEY missing')

  try {
    if (raw.startsWith('suiprivkey')) {
      const { secretKey } = decodeSuiPrivateKey(raw)
      return Ed25519Keypair.fromSecretKey(secretKey)
    }
    const cleaned = raw.includes(':') ? raw.split(':').pop()! : raw
    const buf = cleaned.startsWith('0x') ? new Uint8Array(Buffer.from(cleaned.slice(2), 'hex')) : fromB64(cleaned)
    return Ed25519Keypair.fromSecretKey(buf)
  } catch (e) {
    throw new Error('Invalid SUI_PLATFORM_PRIVATE_KEY format')
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
  const walType = process.env.WAL_COIN_TYPE || loadEnv().WAL_COIN_TYPE
  let wal = 0
  if (walType) {
    const dec = Number(process.env.WAL_DECIMALS || loadEnv().WAL_DECIMALS || 9)
    const b = await c.getBalance({ owner: address, coinType: walType })
    wal = Number(b.totalBalance || '0') / Math.pow(10, dec)
  }
  const sui = Number(suiBal.totalBalance || '0') / 1e9
  return { sui, wal }
}

export async function transferWal(toAddress: string, amountUi: number | string): Promise<string> {
  const env = loadEnv()
  const coinType = process.env.WAL_COIN_TYPE || env.WAL_COIN_TYPE
  const decimals = Number(process.env.WAL_DECIMALS || env.WAL_DECIMALS || 9)
  if (!coinType) throw new Error('WAL_COIN_TYPE missing')
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

export async function fundAgentOnSignup(userId: string) {
  const env = loadEnv()
  const on = (v?: string) => !!v && ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
  if (!on(process.env.FUND_AGENT_ON_SIGNUP || env.FUND_AGENT_ON_SIGNUP)) return
  const { findWalletKey } = await import('@/features/wallets/keys.model.js')
  const { creditWallet } = await import('@/features/wallets/wallets.model.js')
  const payerKey = await findWalletKey(userId, 'payer', 'sui')
  if (!payerKey?.public_key) return
  const to = payerKey.public_key
  const suiAmt = Number(process.env.FUND_SUI_ON_SIGNUP || env.FUND_SUI_ON_SIGNUP || 0.02)
  if (suiAmt > 0) await topUpSui(to, suiAmt)
  const walAmt = Number(process.env.FUND_WAL_ON_SIGNUP || env.FUND_WAL_ON_SIGNUP || 0)
  if (walAmt > 0) {
    await transferWal(to, walAmt)
    await creditWallet(userId, 'payer', walAmt, 'signup_bonus', 'initial_airdrop_wal')
  }
}
