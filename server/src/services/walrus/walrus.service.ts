import { getFullnodeUrl, SuiClient, SuiHTTPTransport } from '@mysten/sui/client';
import { loadEnv } from '@/config/env.js';
import { WalrusClient } from '@mysten/walrus';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { findWalletKey } from '@/features/wallets/keys.model.js';
import { decryptSecret } from '@/services/crypto/keystore.js';
import { Agent, fetch as undiciFetch } from 'undici';

function getClients(rpcOverride?: string) {
  const env = loadEnv();
  const rpc = rpcOverride || env.SUI_RPC_URL || getFullnodeUrl('testnet');
  const network = (env.WALRUS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet';

  const uploadTimeout = parseInt(env.WALRUS_UPLOAD_TIMEOUT_MS || '180000', 10);
  const connectTimeout = parseInt(env.WALRUS_CONNECT_TIMEOUT_MS || '45000', 10);

  const agent = new Agent({ connectTimeout, headersTimeout: 120_000, bodyTimeout: 0 });
  const transport = new SuiHTTPTransport({
    url: rpc,
    fetch: (input: any, init?: any) =>
      undiciFetch(input as any, { ...(init as any), dispatcher: agent } as any) as any,
  });
  const sui = new SuiClient({ transport });
  const walrusExt = WalrusClient.experimental_asClientExtension({
    network,
    ...(env.WALRUS_RELAY_URL
      ? { uploadRelay: { host: env.WALRUS_RELAY_URL, sendTip: { max: 1_000_000 } } }
      : {}),
    storageNodeClientOptions: {
      timeout: uploadTimeout,
      fetch: (url: any, init?: any) =>
        undiciFetch(url as any, { ...(init as any), dispatcher: agent } as any) as any,
    },
  });
  const client = (sui as any).$extend(walrusExt);
  const walrus = (client as any).walrus as any;

  console.log(`[Walrus] Initialized client - RPC: ${rpc}, Network: ${network}, UploadTimeout: ${uploadTimeout}ms, ConnectTimeout: ${connectTimeout}ms`);

  return { sui, walrus };
}

async function uploadViaHttpPublisher(
  data: Uint8Array,
  signer: any,
  opts: { deletable?: boolean; epochs?: number; owner?: string },
): Promise<{ id: string; objectId: string; size: number }> {
  const env = loadEnv();
  const epochs = opts?.epochs ?? 1;

  const publishers = [
    'https://publisher.walrus-testnet.walrus.space',
    'https://wal-publisher-testnet.staketab.org',
    'https://walrus-testnet-publisher.chainbase.online',
    'https://sui-walrus-testnet-publisher.bwarelabs.com',
    'https://publisher.walrus.banansen.dev',
  ];

  console.log('[Walrus HTTP] Attempting direct HTTP publisher upload...');
  let lastError: any;

  for (const publisherUrl of publishers) {
    try {
      console.log(`[Walrus HTTP] Trying publisher: ${publisherUrl}`);
      const uploadStart = Date.now();

      const response = await undiciFetch(`${publisherUrl}/v1/blobs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: data,
        dispatcher: new Agent({ connectTimeout: 30000, headersTimeout: 180000 }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Publisher returned ${response.status}: ${text}`);
      }

      const result = await response.json() as any;
      console.log(`[Walrus HTTP] ✓ HTTP upload succeeded in ${Date.now() - uploadStart}ms`);
      console.log(`[Walrus HTTP] Response:`, JSON.stringify(result).substring(0, 200));

      const blobId = result.newlyCreated?.blobObject?.blobId || result.alreadyCertified?.blobId;
      const objectId = result.newlyCreated?.blobObject?.id || result.alreadyCertified?.blobObject?.id;

      if (!blobId || !objectId) {
        throw new Error('Could not extract blob ID from publisher response');
      }

      console.log(`[Walrus HTTP] ✓ BlobId: ${blobId}, ObjectId: ${objectId}`);
      return { id: blobId, objectId, size: data.byteLength };

    } catch (error: any) {
      console.error(`[Walrus HTTP] ✗ Publisher ${publisherUrl} failed: ${error.message}`);
      lastError = error;
      continue; // Try next publisher
    }
  }

  throw new Error(`All HTTP publishers failed. Last error: ${lastError?.message}`);
}

async function uploadBlob(
  signer: any,
  data: Uint8Array,
  opts: { deletable?: boolean; epochs?: number; owner?: string },
  owner: string,
): Promise<{ id: string; objectId: string; size: number }> {
  const deletable = opts?.deletable ?? true;
  const epochs = opts?.epochs ?? 1;

  console.log(`[Walrus Upload] Starting upload - Size: ${(data.byteLength / 1024 / 1024).toFixed(2)}MB, Epochs: ${epochs}, Deletable: ${deletable}`);
  return await uploadViaHttpPublisher(data, signer, opts);
}

function platformSigner(): Ed25519Keypair {
  const env = loadEnv();
  const raw = (process.env.SUI_PLATFORM_PRIVATE_KEY || env.SUI_PLATFORM_PRIVATE_KEY || '').trim();
  if (!raw) throw new Error('SUI_PLATFORM_PRIVATE_KEY missing');
  const to32 = (bytes: Uint8Array) => (bytes.length === 32 ? bytes : bytes.slice(0, 32));
  if (raw.toLowerCase().startsWith('suiprivkey')) {
    const { secretKey } = decodeSuiPrivateKey(raw);
    return Ed25519Keypair.fromSecretKey(to32(secretKey));
  }
  let cleaned = raw.includes(':') ? raw.split(':').pop()!.trim() : raw;
  const hex = cleaned.startsWith('0x') ? cleaned.slice(2) : cleaned;
  const isHex = /^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0;
  const buf = isHex ? new Uint8Array(Buffer.from(hex, 'hex')) : fromB64(cleaned);
  return Ed25519Keypair.fromSecretKey(to32(buf));
}

export async function providerSigner(userId: string, role: 'payer' | 'payout' = 'payer'): Promise<Ed25519Keypair> {
  const key = await findWalletKey(userId, role, 'sui');
  if (!key) throw new Error('PROVIDER_WALLET_MISSING');
  const secret = decryptSecret(key.enc);
  const asStr = secret.toString('utf8');
  const to32 = (bytes: Uint8Array) => (bytes.length === 32 ? bytes : bytes.slice(0, 32));
  // Handle stored formats flexibly: bech32, hex, base64, or raw bytes
  try {
    if (asStr.startsWith('suiprivkey')) {
      const { secretKey } = decodeSuiPrivateKey(asStr.trim());
      return Ed25519Keypair.fromSecretKey(to32(secretKey));
    }
    if (/^(ed25519:)/i.test(asStr)) {
      const b64 = asStr.split(':').pop()!.trim();
      const bytes = fromB64(b64);
      return Ed25519Keypair.fromSecretKey(to32(bytes));
    }
    if (/^0x[0-9a-fA-F]+$/.test(asStr.trim())) {
      const hex = asStr.trim().slice(2);
      const bytes = new Uint8Array(Buffer.from(hex, 'hex'));
      return Ed25519Keypair.fromSecretKey(to32(bytes));
    }
  } catch { }
  // Fallback: treat as raw bytes; normalize to 32
  return Ed25519Keypair.fromSecretKey(to32(new Uint8Array(secret)));
}

export async function putWalrusBlob(data: Uint8Array, opts?: { deletable?: boolean; epochs?: number; owner?: string }): Promise<{ id: string; objectId: string; size: number }> {
  const signer = platformSigner();
  const owner = opts?.owner || signer.toSuiAddress();
  return await uploadBlob(signer, data, opts ?? {}, owner);
}

export async function putWalrusBlobAsProvider(userId: string, data: Uint8Array, opts?: { deletable?: boolean; epochs?: number; owner?: string }): Promise<{ id: string; objectId: string; size: number }> {
  const signer = await providerSigner(userId, 'payer');
  const owner = opts?.owner || signer.toSuiAddress();
  return await uploadBlob(signer, data, opts ?? {}, owner);
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
