import { getDb } from '@/config/db.js'
import argon2 from 'argon2'

export type WalletPinDoc = {
  _id: string
  user_id: string
  hash: string
  failed_attempts: number
  locked_until?: string
  created_at: string
  updated_at: string
}

const MAX_ATTEMPTS = Number(process.env.PIN_MAX_ATTEMPTS || 5)
const LOCK_MINUTES = Number(process.env.PIN_LOCK_MINUTES || 15)

export async function getPin(userId: string): Promise<WalletPinDoc | null> {
  const db = await getDb()
  return db.collection<WalletPinDoc>('wallet_pins').findOne({ user_id: userId } as any)
}

export async function hasPin(userId: string): Promise<boolean> {
  const pin = await getPin(userId)
  return !!pin?.hash
}

export async function setNewPin(userId: string, pin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN_FORMAT_INVALID')
  const db = await getDb()
  const existing = await getPin(userId)
  if (existing?.hash) throw new Error('PIN_ALREADY_SET')
  const hash = await argon2.hash(pin, { type: argon2.argon2id })
  const now = new Date().toISOString()
  await db.collection<WalletPinDoc>('wallet_pins').updateOne(
    { user_id: userId } as any,
    { $set: { user_id: userId, hash, failed_attempts: 0, locked_until: undefined, updated_at: now }, $setOnInsert: { _id: crypto.randomUUID(), created_at: now } },
    { upsert: true }
  )
}

export async function changePin(userId: string, currentPin: string, newPin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(newPin)) throw new Error('PIN_FORMAT_INVALID')
  const db = await getDb()
  const doc = await getPin(userId)
  if (!doc?.hash) throw new Error('PIN_NOT_SET')
  if (await isLocked(doc)) throw new Error('PIN_LOCKED')
  const ok = await argon2.verify(doc.hash, currentPin)
  if (!ok) {
    await registerFailedAttempt(doc)
    throw new Error('PIN_INVALID')
  }
  const hash = await argon2.hash(newPin, { type: argon2.argon2id })
  const now = new Date().toISOString()
  await db.collection<WalletPinDoc>('wallet_pins').updateOne({ _id: doc._id } as any, { $set: { hash, failed_attempts: 0, locked_until: undefined, updated_at: now } })
}

export async function verifyPin(userId: string, pin: string): Promise<'ok' | 'locked' | 'invalid' | 'not_set'> {
  const doc = await getPin(userId)
  if (!doc?.hash) return 'not_set'
  if (await isLocked(doc)) return 'locked'
  const ok = await argon2.verify(doc.hash, pin)
  if (ok) {
    await resetAttempts(doc)
    return 'ok'
  }
  await registerFailedAttempt(doc)
  return 'invalid'
}

export function remainingAttempts(doc: WalletPinDoc): number {
  return Math.max(0, MAX_ATTEMPTS - (doc.failed_attempts || 0))
}

async function isLocked(doc: WalletPinDoc): Promise<boolean> {
  if (!doc.locked_until) return false
  return new Date(doc.locked_until).getTime() > Date.now()
}

async function resetAttempts(doc: WalletPinDoc): Promise<void> {
  const db = await getDb()
  await db.collection<WalletPinDoc>('wallet_pins').updateOne({ _id: doc._id } as any, { $set: { failed_attempts: 0, locked_until: undefined } })
}

async function registerFailedAttempt(doc: WalletPinDoc): Promise<void> {
  const db = await getDb()
  const next = (doc.failed_attempts || 0) + 1
  let locked_until: string | undefined
  if (next >= MAX_ATTEMPTS) {
    locked_until = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
  }
  await db.collection<WalletPinDoc>('wallet_pins').updateOne(
    { _id: doc._id } as any,
    { $set: { failed_attempts: next, locked_until } }
  )
}
