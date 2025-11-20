import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { findUserByEmail, insertUser, updateUserPassword, insertResetToken, findValidResetToken, markResetUsed, createOrReplaceChallenge, findValidChallenge, markChallengeUsed, upsertWalletLink, findWalletLinkByAddress, findUserById } from '@/features/auth/auth.model.js';
import { loadEnv } from '@/config/env.js';
import nacl from 'tweetnacl';
import argon2 from 'argon2';
import { SignJWT } from 'jose';
import { initUserWallets } from '@/features/wallets/wallets.service.js';
import { getOrCreateProvider } from '@/features/providers/providers.service.js';

type AuthBundle = {
  token: string;
  user: {
    _id: string;
    name: string;
    email: string;
    roles: string[];
  };
};

async function buildAuthBundle(userId: string): Promise<AuthBundle> {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  const env = loadEnv();
  if (!env.JWT_SECRET) throw new Error('SERVER_MISCONFIG');
  const token = await new SignJWT({ sub: user._id, name: user.name, email: user.email, roles: user.roles })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(env.JWT_SECRET));
  return {
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      roles: user.roles,
    },
  };
}

export async function signupService(name: string, email: string, password: string) {
  const existing = await findUserByEmail(email);
  if (existing) return { ok: false as const, error: 'EMAIL_EXISTS' };
  const hash = await argon2.hash(password);
  const userId = 'u_' + randomUUID();
  await insertUser({ _id: userId, name, email, password_hash: hash, roles: ['user'], created_at: new Date().toISOString() });
  await initUserWallets(userId);
  await getOrCreateProvider(userId);
  try {
    const auth = await buildAuthBundle(userId);
    return { ok: true as const, auth };
  } catch (err: any) {
    if (err?.message === 'SERVER_MISCONFIG') return { ok: false as const, error: 'SERVER_MISCONFIG' };
    throw err;
  }
}

export async function loginService(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return { ok: false as const, error: 'INVALID_CREDENTIALS' };
  const ok = await argon2.verify(user.password_hash, password);
  if (!ok) return { ok: false as const, error: 'INVALID_CREDENTIALS' };
  await getOrCreateProvider(user._id);
  try {
    const auth = await buildAuthBundle(user._id);
    return { ok: true as const, auth };
  } catch (err: any) {
    if (err?.message === 'SERVER_MISCONFIG') return { ok: false as const, error: 'SERVER_MISCONFIG' };
    throw err;
  }
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmail(email).catch(() => null);
  if (!user) return; // do not leak existence
  const token = randomBytes(32).toString('base64url');
  const token_hash = createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await insertResetToken({ _id: 'pr_' + randomUUID(), user_id: user._id, token_hash, expires_at: expires, used: false, created_at: new Date().toISOString() });
  //will integrate email service here later / forgot password intentionally omitted
  return { issued: true } as const;
}

export async function performPasswordReset(token: string, newPassword: string) {
  const token_hash = createHash('sha256').update(token).digest('hex');
  const doc = await findValidResetToken(token_hash);
  if (!doc) return { ok: false as const, error: 'INVALID_OR_EXPIRED' };
  const hash = await argon2.hash(newPassword);
  await updateUserPassword(doc.user_id, hash);
  await markResetUsed(doc._id);
  return { ok: true as const };
}

export async function changeUserPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await findUserById(userId);
  if (!user) return { ok: false as const, error: 'USER_NOT_FOUND' };
  const valid = await argon2.verify(user.password_hash, currentPassword);
  if (!valid) return { ok: false as const, error: 'INVALID_CURRENT_PASSWORD' };
  const hash = await argon2.hash(newPassword);
  await updateUserPassword(userId, hash);
  return { ok: true as const };
}

export async function createWalletChallenge(address: string, chain: 'sui') {
  const nonce = randomBytes(16).toString('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await createOrReplaceChallenge({ _id: 'wc_' + randomUUID(), chain, address, nonce, expires_at: expiresAt, used: false, created_at: new Date().toISOString() });
  const msg = `Suimo Auth\nAddress:${address}\nNonce:${nonce}`;
  return { nonce, expiresAt, message: msg };
}

function parseSuiSerializedSignature(sig: string): { scheme: number; signature: Uint8Array; pubkey: Uint8Array } {
  const bytes = Uint8Array.from(Buffer.from(sig, 'base64'));
  if (bytes.length < 1 + 64 + 32) throw new Error('BAD_SIGNATURE');
  const scheme = bytes[0];
  const signature = bytes.slice(1, 65);
  const pubkey = bytes.slice(65);
  return { scheme, signature, pubkey };
}

function normalizeAddr(input: string): string {
  let s = input.toLowerCase();
  if (s.startsWith('0x')) s = s.slice(2);
  s = s.replace(/^0+/, '');
  return '0x' + s;
}

function pubkeyToSuiAddress(scheme: number, pubkey: Uint8Array): string {
  const pre = Buffer.concat([Buffer.from([scheme]), Buffer.from(pubkey)]);
  const full = createHash('blake2b512').update(pre).digest();
  const hex = Buffer.from(full.slice(0, 32)).toString('hex');
  const trimmed = hex.replace(/^0+/, '');
  return '0x' + trimmed;
}

export async function verifyWalletLink(userId: string, address: string, chain: 'sui', signature: string, nonce: string) {
  const ch = await findValidChallenge(chain, address, nonce);
  if (!ch) return { ok: false as const, error: 'INVALID_CHALLENGE' };
  const msg = new TextEncoder().encode(`Suimo Auth\nAddress:${address}\nNonce:${nonce}`);
  const parsed = parseSuiSerializedSignature(signature);
  if (parsed.scheme !== 0x00) return { ok: false as const, error: 'UNSUPPORTED_SCHEME' };
  const valid = nacl.sign.detached.verify(msg, parsed.signature, parsed.pubkey);
  if (!valid) return { ok: false as const, error: 'INVALID_SIGNATURE' };
  const computed = pubkeyToSuiAddress(parsed.scheme, parsed.pubkey);
  if (normalizeAddr(computed) !== normalizeAddr(address)) return { ok: false as const, error: 'ADDRESS_MISMATCH' };
  const existing = await findWalletLinkByAddress(chain, address);
  if (existing && existing.user_id !== userId) return { ok: false as const, error: 'ADDRESS_IN_USE' };
  await upsertWalletLink({ _id: existing?._id || 'wl_' + randomUUID(), user_id: userId, chain, address, created_at: existing?.created_at || new Date().toISOString(), last_verified_at: new Date().toISOString() });
  await markChallengeUsed(ch._id);
  return { ok: true as const };
}

export async function walletLogin(address: string, chain: 'sui', signature: string, nonce: string) {
  const ch = await findValidChallenge(chain, address, nonce);
  if (!ch) return { ok: false as const, error: 'INVALID_CHALLENGE' };
  const msg = new TextEncoder().encode(`Suimo Auth\nAddress:${address}\nNonce:${nonce}`);
  const parsed = parseSuiSerializedSignature(signature);
  if (parsed.scheme !== 0x00) return { ok: false as const, error: 'UNSUPPORTED_SCHEME' };
  const valid = nacl.sign.detached.verify(msg, parsed.signature, parsed.pubkey);
  if (!valid) return { ok: false as const, error: 'INVALID_SIGNATURE' };
  const computed = pubkeyToSuiAddress(parsed.scheme, parsed.pubkey);
  if (normalizeAddr(computed) !== normalizeAddr(address)) return { ok: false as const, error: 'ADDRESS_MISMATCH' };
  const link = await findWalletLinkByAddress(chain, address);
  if (!link) {
    const userId = 'u_' + randomUUID();
    const shortAddr = address.slice(0, 8);
    await insertUser({
      _id: userId,
      name: `Wallet ${shortAddr}`,
      email: `${address}@wallet.local`,
      password_hash: '',
      roles: ['user'],
      created_at: new Date().toISOString(),
    });
    await initUserWallets(userId);
    await getOrCreateProvider(userId);
    await upsertWalletLink({
      _id: 'wl_' + randomUUID(),
      user_id: userId,
      chain,
      address,
      created_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
    });
    await markChallengeUsed(ch._id);
    try {
      const auth = await buildAuthBundle(userId);
      return { ok: true as const, auth };
    } catch (err: any) {
      if (err?.message === 'SERVER_MISCONFIG') return { ok: false as const, error: 'SERVER_MISCONFIG' };
      throw err;
    }
  }
  await markChallengeUsed(ch._id);
  await getOrCreateProvider(link.user_id);
  try {
    const auth = await buildAuthBundle(link.user_id);
    return { ok: true as const, auth };
  } catch (err: any) {
    if (err?.message === 'SERVER_MISCONFIG') return { ok: false as const, error: 'SERVER_MISCONFIG' };
    throw err;
  }
}
