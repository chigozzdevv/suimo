import { SealClient, SessionKey, EncryptedObject } from "@mysten/seal";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { fromB64, fromHex } from "@mysten/sui/utils";
import { randomBytes } from "crypto";
import { loadEnv } from "@/config/env.js";

function suiClient() {
  const env = loadEnv();
  const rpc = env.SUI_RPC_URL || getFullnodeUrl("testnet");
  return new SuiClient({ url: rpc });
}

const DEFAULT_TESTNET_KEY_SERVERS = [
  "0xb35a7228d8cf224ad1e828c0217c95a5153bafc2906d6f9c178197dce26fbcf8",
  "0x2d6cde8a9d9a65bde3b0a346566945a63b4bfb70e9a06c41bdb70807e2502b06",
];

function getKeyServerIds(): string[] {
  const env = loadEnv();
  const network = env.WALRUS_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const configuredIds = env.SEAL_KEY_SERVER_IDS
    ? env.SEAL_KEY_SERVER_IDS.split(",").map((id) => id.trim()).filter(Boolean)
    : null;
  const keyServerIds =
    configuredIds ?? (network === "testnet" ? DEFAULT_TESTNET_KEY_SERVERS : []);

  if (!keyServerIds.length) {
    throw new Error(
      "Seal key server IDs are not configured for the current network",
    );
  }

  return keyServerIds;
}

function createSealClient(keyServerIds: string[]): SealClient {
  return new SealClient({
    suiClient: suiClient() as any,
    serverConfigs: keyServerIds.map((objectId) => ({
      objectId,
      weight: 1,
    })),
  });
}

export async function sealEncryptForPolicy(
  plaintext: Uint8Array,
  _policyId: string,
): Promise<{
  ciphertextEnvelope: Uint8Array;
  meta: { algo: string; size_bytes: number };
}> {
  const env = loadEnv();
  const policyPackageIdHex = env.SEAL_POLICY_PACKAGE;
  if (!policyPackageIdHex) throw new Error("SEAL_POLICY_PACKAGE missing");

  const keyServerIds = getKeyServerIds();
  const seal = createSealClient(keyServerIds);
  const id = `0x${randomBytes(32).toString("hex")}`;
  const { encryptedObject } = await seal.encrypt({
    threshold: Math.min(3, keyServerIds.length),
    packageId: policyPackageIdHex,
    id,
    data: plaintext,
  });
  return {
    ciphertextEnvelope: encryptedObject,
    meta: { algo: "seal-ibe-aes256gcm", size_bytes: plaintext.byteLength },
  };
}

export async function sealDecryptForAccess(
  cipher: { chunks: string[] },
  _policyId?: string,
  _ctx?: { requestId?: string },
): Promise<{ chunks: string[]; bytes: number }> {
  const env = loadEnv();

  const bytes = Buffer.concat(
    cipher.chunks.map((b64) => Buffer.from(b64, "base64")),
  );
  let enc: ReturnType<typeof EncryptedObject.parse>;
  try {
    enc = EncryptedObject.parse(new Uint8Array(bytes));
  } catch (err: any) {
    throw new Error(
      `SEAL_CIPHERTEXT_UNSUPPORTED: ${err?.message || String(err)}`,
    );
  }
  const packageId = enc.packageId;
  const idHex = enc.id;

  const ttlMin = 10;
  const raw =
    process.env.SUI_PLATFORM_PRIVATE_KEY || env.SUI_PLATFORM_PRIVATE_KEY;
  if (!raw) throw new Error("SUI_PLATFORM_PRIVATE_KEY missing");
  let kp: Ed25519Keypair;
  if (raw.startsWith("suiprivkey")) {
    const { secretKey } = decodeSuiPrivateKey(raw);
    kp = Ed25519Keypair.fromSecretKey(secretKey);
  } else {
    const cleaned = raw.includes(":") ? raw.split(":").pop()! : raw;
    const buf = cleaned.startsWith("0x")
      ? new Uint8Array(Buffer.from(cleaned.slice(2), "hex"))
      : fromB64(cleaned);
    kp = Ed25519Keypair.fromSecretKey(buf);
  }

  const session = await SessionKey.create({
    address: kp.getPublicKey().toSuiAddress(),
    packageId,
    ttlMin,
    signer: kp,
    suiClient: suiClient() as any,
  });

  const tx = new Transaction();
  const sender = kp.getPublicKey().toSuiAddress();
  tx.setSender(sender);
  tx.moveCall({
    target: `${packageId}::policy::seal_approve`,
    arguments: [tx.pure.vector("u8", fromHex(idHex))],
  });

  const txBytes = await tx.build({
    client: suiClient() as any,
    onlyTransactionKind: true,
  });

  const keyServerIds = getKeyServerIds();
  const seal = createSealClient(keyServerIds);
  await seal.fetchKeys({
    ids: [idHex],
    txBytes,
    sessionKey: session,
    threshold: enc.threshold,
  });
  const pt = await seal.decrypt({
    data: new Uint8Array(bytes),
    sessionKey: session,
    txBytes,
  });

  const CHUNK_SIZE = 256 * 1024;
  const out: string[] = [];
  for (let i = 0; i < pt.length; i += CHUNK_SIZE) {
    out.push(Buffer.from(pt.slice(i, i + CHUNK_SIZE)).toString("base64"));
  }
  return { chunks: out, bytes: pt.length };
}
