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

  // Configurable timeouts with fallbacks
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

function pickFallbackRpc(primary?: string) {
  const publicNode = 'https://sui-testnet-rpc.publicnode.com';
  const chainbase = 'https://testnet-rpc.sui.chainbase.online';
  if (!primary) return publicNode;
  return primary.includes('chainbase') ? publicNode : chainbase;
}

function candidateRpcs(primary?: string): string[] {
  const base = primary || getFullnodeUrl('testnet');
  const list = [
    base,
    pickFallbackRpc(base),
    'https://api.us1.shinami.com/sui/node/v1/us1_sui_testnet_3dbbd061b67242df938d13ae4f8b7873',
    'https://sui-testnet-endpoint.blockvision.org',
    'https://rpc.ankr.com/sui_testnet',
  ];
  return Array.from(new Set(list.filter(Boolean)));
}

async function selectRpc(desired?: string): Promise<string> {
  const list = [desired, pickFallbackRpc(desired), 'https://api.us1.shinami.com/sui/node/v1/us1_sui_testnet_3dbbd061b67242df938d13ae4f8b7873', 'https://sui-testnet-endpoint.blockvision.org', 'https://rpc.ankr.com/sui_testnet']
    .filter(Boolean) as string[];
  const body = JSON.stringify({ jsonrpc: '2.0', method: 'suix_getReferenceGasPrice', params: [], id: 1 });
  for (const url of list) {
    try {
      const probeAgent = new Agent({ connectTimeout: 3000, headersTimeout: 8000 });
      const res = await undiciFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, dispatcher: probeAgent } as any);
      if (res.ok) return url;
    } catch { }
  }
  return desired || 'https://sui-testnet-rpc.publicnode.com';
}

function isConnectTimeoutError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('connect timeout') ||
    msg.includes('timeout:') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  );
}

async function uploadWithClients(
  walrus: any,
  signer: any,
  data: Uint8Array,
  opts: { deletable?: boolean; epochs?: number; owner?: string },
  owner: string,
): Promise<{ id: string; objectId: string; size: number }> {
  const deletable = opts?.deletable ?? true;
  const epochs = opts?.epochs ?? 1;
  const env = loadEnv();
  const maxRetries = parseInt(env.WALRUS_MAX_RETRIES || '5', 10);
  const concurrency = parseInt(env.WALRUS_CONCURRENCY || '16', 10);

  console.log(`[Walrus Upload] Starting upload - Size: ${(data.byteLength / 1024 / 1024).toFixed(2)}MB, Epochs: ${epochs}, Deletable: ${deletable}`);

  try {
    console.log('[Walrus Upload] Attempting direct writeBlob...');
    const startTime = Date.now();
    const res = await walrus.writeBlob({ blob: data, deletable, epochs, signer, owner });
    const objectId = res.blobObject.id.id as string;
    console.log(`[Walrus Upload] ✓ Direct writeBlob succeeded in ${Date.now() - startTime}ms - BlobId: ${res.blobId}`);
    return { id: res.blobId, objectId, size: data.byteLength };
  } catch (e: any) {
    console.error(`[Walrus Upload] ✗ Direct writeBlob failed: ${e.message}`);
    if (isConnectTimeoutError(e)) {
      console.error('[Walrus Upload] ✗ Timeout during writeBlob - aborting');
      throw e;
    }

    console.log('[Walrus Upload] Falling back to manual encode/upload/certify flow...');
    try {
      console.log('[Walrus Upload] Step 1: Encoding blob...');
      const encodeStart = Date.now();
      const { sliversByNode, blobId, metadata, rootHash } = await walrus.encodeBlob(data);
      console.log(`[Walrus Upload] ✓ Encoded blob in ${Date.now() - encodeStart}ms - BlobId: ${blobId}, StorageNodes: ${sliversByNode.length}`);

      console.log('[Walrus Upload] Step 2: Registering blob on-chain...');
      const regStart = Date.now();
      const reg = await walrus.executeRegisterBlobTransaction({ signer, size: data.length, epochs, blobId, rootHash, deletable, owner });
      const blobObjectId = reg.blob.id.id as string;
      console.log(`[Walrus Upload] ✓ Registered blob in ${Date.now() - regStart}ms - ObjectId: ${blobObjectId}`);

      const confirmations: Array<any | null> = new Array(sliversByNode.length).fill(null);

      console.log(`[Walrus Upload] Step 3: Uploading to storage nodes (concurrency: ${concurrency}, max retries: ${maxRetries})...`);
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const attemptStart = Date.now();
        let uploadedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < sliversByNode.length; i += concurrency) {
          const tasks: Promise<void>[] = [];
          for (let j = i; j < Math.min(i + concurrency, sliversByNode.length); j++) {
            if (confirmations[j] != null) continue;
            tasks.push(
              walrus
                .writeEncodedBlobToNode({
                  nodeIndex: j,
                  blobId,
                  metadata,
                  slivers: sliversByNode[j],
                  deletable,
                  objectId: blobObjectId,
                })
                .then((c: any) => {
                  if (c) {
                    confirmations[j] = c;
                    uploadedCount++;
                  }
                })
                .catch((err: any) => {
                  failedCount++;
                  console.error(`[Walrus Upload] Node ${j} upload failed: ${err.message}`);
                })
            );
          }
          if (tasks.length) await Promise.all(tasks);
        }

        const confirmedCount = confirmations.filter(c => c != null).length;
        console.log(`[Walrus Upload] Attempt ${attempt}/${maxRetries}: ${confirmedCount}/${sliversByNode.length} nodes confirmed (uploaded: ${uploadedCount}, failed: ${failedCount}) in ${Date.now() - attemptStart}ms`);

        try {
          console.log('[Walrus Upload] Step 4: Certifying blob...');
          const certifyStart = Date.now();
          await walrus.executeCertifyBlobTransaction({ signer, blobId, blobObjectId, confirmations, deletable });
          console.log(`[Walrus Upload] ✓ Upload complete in ${Date.now() - certifyStart}ms - BlobId: ${blobId}`);
          return { id: blobId, objectId: blobObjectId, size: data.byteLength };
        } catch (err: any) {
          console.error(`[Walrus Upload] ✗ Certify failed on attempt ${attempt}: ${err.message}`);
          if (isConnectTimeoutError(err)) {
            console.error('[Walrus Upload] ✗ Timeout during certify - aborting');
            throw err;
          }
          if (attempt === maxRetries) {
            console.error('[Walrus Upload] ✗ Max retries exceeded for certify');
            throw new Error('Failed to certify blob after ' + maxRetries + ' attempts');
          }
          const backoffMs = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s, 16s, 32s
          console.log(`[Walrus Upload] Retrying certify in ${backoffMs}ms...`);
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
      throw new Error('Unexpected upload failure');
    } catch (inner: any) {
      console.error(`[Walrus Upload] ✗ Manual flow failed: ${inner.message}`);
      if (isConnectTimeoutError(inner)) throw inner;
      throw inner;
    }
  }
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

  const env = loadEnv();
  const rpcs = candidateRpcs(process.env.SUI_RPC_URL || env.SUI_RPC_URL);
  let lastErr: any;
  for (const url of rpcs) {
    try {
      const { walrus } = getClients(url);
      return await uploadWithClients(walrus, signer, data, opts ?? {}, owner);
    } catch (e: any) {
      lastErr = e;
      if (!isConnectTimeoutError(e)) throw e;
      continue;
    }
  }
  throw lastErr || new Error('RPC_UNAVAILABLE');
}

export async function putWalrusBlobAsProvider(userId: string, data: Uint8Array, opts?: { deletable?: boolean; epochs?: number; owner?: string }): Promise<{ id: string; objectId: string; size: number }> {
  const signer = await providerSigner(userId, 'payer');
  const owner = opts?.owner || signer.toSuiAddress();

  const env = loadEnv();
  const rpcs = candidateRpcs(process.env.SUI_RPC_URL || env.SUI_RPC_URL);
  let lastErr: any;
  for (const url of rpcs) {
    try {
      const { walrus } = getClients(url);
      return await uploadWithClients(walrus, signer, data, opts ?? {}, owner);
    } catch (e: any) {
      lastErr = e;
      if (!isConnectTimeoutError(e)) throw e;
      continue;
    }
  }
  throw lastErr || new Error('RPC_UNAVAILABLE');
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
