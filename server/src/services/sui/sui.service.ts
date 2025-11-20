import { loadEnv } from '@/config/env.js'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { fromB64 } from '@mysten/sui/utils'

function client() {
  const env = loadEnv()
  const url = process.env.SUI_RPC_URL || env.SUI_RPC_URL || getFullnodeUrl('testnet')
  return new SuiClient({ url })
}

function platformKeypair() {
  const env = loadEnv()
  const b64 = process.env.SUI_PLATFORM_PRIVATE_KEY || env.SUI_PLATFORM_PRIVATE_KEY
  if (!b64) throw new Error('SUI_PLATFORM_PRIVATE_KEY missing')
  return Ed25519Keypair.fromSecretKey(fromB64(b64))
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
  const usdcType = process.env.SUI_USDC_TYPE || loadEnv().SUI_USDC_TYPE
  let usdc = 0
  if (usdcType) {
    const dec = Number(process.env.SUI_USDC_DECIMALS || loadEnv().SUI_USDC_DECIMALS || 6)
    const b = await c.getBalance({ owner: address, coinType: usdcType })
    usdc = Number(b.totalBalance || '0') / Math.pow(10, dec)
  }
  const sui = Number(suiBal.totalBalance || '0') / 1e9
  return { sui, usdc }
}

export async function transferUsdc(toAddress: string, amountUi: number | string): Promise<string> {
  const env = loadEnv()
  const coinType = process.env.SUI_USDC_TYPE || env.SUI_USDC_TYPE
  const decimals = Number(process.env.SUI_USDC_DECIMALS || env.SUI_USDC_DECIMALS || 6)
  if (!coinType) throw new Error('SUI_USDC_TYPE missing')
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
  const usdcAmt = Number(process.env.FUND_USDC_ON_SIGNUP || env.FUND_USDC_ON_SIGNUP || 0)
  if (suiAmt > 0) await topUpSui(to, suiAmt)
  if (usdcAmt > 0) {
    await transferUsdc(to, usdcAmt)
    await creditWallet(userId, 'payer', usdcAmt, 'signup_bonus', 'initial_airdrop')
  }
}
