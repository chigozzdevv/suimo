import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { loadEnv } from '@/config/env.js';
import { WalrusClient } from '@mysten/walrus';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { findWalletKey } from '@/features/wallets/keys.model.js';
import { decryptSecret } from '@/services/crypto/keystore.js';

function getClients() {
  const env = loadEnv();
  const rpc = env.SUI_RPC_URL || getFullnodeUrl('testnet');
  const network = (env.WALRUS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet';
  const sui = new SuiClient({ url: rpc });
  const walrusExt = WalrusClient.experimental_asClientExtension({ network });
  const client = (sui as any).$extend(walrusExt);
  const walrus = (client as any).walrus as any;
  return { sui, walrus };
}

function platformSigner(): Ed25519Keypair {
  const env = loadEnv();
  const raw = process.env.SUI_PLATFORM_PRIVATE_KEY || env.SUI_PLATFORM_PRIVATE_KEY;
  if (!raw) throw new Error('SUI_PLATFORM_PRIVATE_KEY missing');
  if (raw.startsWith('suiprivkey')) {
    const { secretKey } = decodeSuiPrivateKey(raw);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const cleaned = raw.includes(':') ? raw.split(':').pop()! : raw;
  const buf = cleaned.startsWith('0x') ? new Uint8Array(Buffer.from(cleaned.slice(2), 'hex')) : fromB64(cleaned);
  return Ed25519Keypair.fromSecretKey(buf);
}

async function providerSigner(userId: string, role: 'payer' | 'payout' = 'payer'): Promise<Ed25519Keypair> {
  const key = await findWalletKey(userId, role, 'sui');
  if (!key) throw new Error('PROVIDER_WALLET_MISSING');
  const secret = decryptSecret(key.enc);
  return Ed25519Keypair.fromSecretKey(new Uint8Array(secret));
}

export async function putWalrusBlob(data: Uint8Array, opts?: { deletable?: boolean; epochs?: number; owner?: string }): Promise<{ id: string; objectId: string; size: number }>{
  const { walrus } = getClients();
  const signer = platformSigner();
  const res = await walrus.writeBlob({ blob: data, deletable: opts?.deletable ?? true, epochs: opts?.epochs ?? 3, signer: signer as any, owner: opts?.owner });
  const objectId = res.blobObject.id.id as string;
  return { id: res.blobId, objectId, size: data.byteLength };
}

export async function putWalrusBlobAsProvider(userId: string, data: Uint8Array, opts?: { deletable?: boolean; epochs?: number; owner?: string }): Promise<{ id: string; objectId: string; size: number }>{
  const { walrus } = getClients();
  const signer = await providerSigner(userId, 'payer');
  const res = await walrus.writeBlob({ blob: data, deletable: opts?.deletable ?? true, epochs: opts?.epochs ?? 3, signer: signer as any, owner: opts?.owner });
  const objectId = res.blobObject.id.id as string;
  return { id: res.blobId, objectId, size: data.byteLength };
}

export async function getWalrusBlob(id: string): Promise<Uint8Array> {
  const { walrus } = getClients();
  const buf = await walrus.readBlob({ blobId: id });
  return new Uint8Array(buf);
}

export async function getWalrusBlobChunks(id: string): Promise<{ chunks: string[]; bytes: number }> {
  const buf = await getWalrusBlob(id);
  const CHUNK_SIZE = 256 * 1024;
  const chunks: string[] = [];
  for (let i = 0; i < buf.length; i += CHUNK_SIZE) {
    chunks.push(Buffer.from(buf.slice(i, i + CHUNK_SIZE)).toString('base64'));
  }
  return { chunks, bytes: buf.length };
}

export async function deleteWalrusBlobObject(blobObjectId: string): Promise<void> {
  const { walrus } = getClients();
  const signer = platformSigner();
  await walrus.executeDeleteBlobTransaction({ signer: signer as any, blobObjectId });
}
