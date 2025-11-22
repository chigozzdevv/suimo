import {
  getAllowlistedKeyServers,
  retrieveKeyServers,
  KeyStore,
  SessionKey,
  encrypt as sealEncrypt,
  AesGcm256,
  EncryptedObject,
} from "@mysten/seal";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  toSerializedSignature,
  decodeSuiPrivateKey,
} from "@mysten/sui/cryptography";
import { fromB64 } from "@mysten/sui/utils";
import { loadEnv } from "@/config/env.js";

function suiClient() {
  const env = loadEnv();
  const rpc = env.SUI_RPC_URL || getFullnodeUrl("testnet");
  return new SuiClient({ url: rpc });
}

export async function sealEncryptForPolicy(
  plaintext: Uint8Array,
  _policyId: string,
): Promise<{
  ciphertextEnvelope: Uint8Array;
  meta: { algo: string; size_bytes: number };
}> {
  const env = loadEnv();
  const network = (env.WALRUS_NETWORK === "mainnet" ? "mainnet" : "testnet") as
    | "mainnet"
    | "testnet";
  const keyServerIds = getAllowlistedKeyServers(network);
  const keyServers = await retrieveKeyServers({
    objectIds: keyServerIds,
    client: suiClient() as any,
  });
  const encryptionInput = new AesGcm256(plaintext, new Uint8Array());
  const policyPackageIdHex = env.SEAL_POLICY_PACKAGE;
  if (!policyPackageIdHex) throw new Error("SEAL_POLICY_PACKAGE missing");
  const packageId = Uint8Array.from(
    Buffer.from(policyPackageIdHex.replace(/^0x/, ""), "hex"),
  );
  // For identity, use the resource id or server-generated id; placeholder zeros (caller should supply)
  const id = new Uint8Array(32);
  const { encryptedObject } = await sealEncrypt({
    keyServers,
    threshold: Math.min(3, keyServers.length),
    packageId,
    id,
    encryptionInput,
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
  const network = (env.WALRUS_NETWORK === "mainnet" ? "mainnet" : "testnet") as
    | "mainnet"
    | "testnet";
  const keyServerIds = getAllowlistedKeyServers(network);
  const keyServers = await retrieveKeyServers({
    objectIds: keyServerIds,
    client: suiClient() as any,
  });
  const ks = new KeyStore();

  const bytes = Buffer.concat(
    cipher.chunks.map((b64) => Buffer.from(b64, "base64")),
  );
  const enc = EncryptedObject.parse(new Uint8Array(bytes));
  const packageId = enc.package_id;
  const id = new Uint8Array(enc.id);

  const ttlMin = 10;
  const session = new SessionKey(packageId, ttlMin);
  const msg = session.getPersonalMessage();
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
  const sigBytes = await kp.sign(msg);
  const sig = toSerializedSignature({
    signatureScheme: "ED25519",
    signature: new Uint8Array(sigBytes),
    publicKey: kp.getPublicKey(),
  });
  session.setPersonalMessageSignature(sig);

  const tx = new Transaction();
  tx.setSender(kp.getPublicKey().toSuiAddress());
  const txBytes = await tx.build({ onlyTransactionKind: true });

  await ks.fetchKeys({
    keyServers,
    threshold: Math.min(3, keyServers.length),
    packageId,
    ids: [id],
    txBytes,
    sessionKey: session,
  });
  const pt = await ks.decrypt(enc);

  const CHUNK_SIZE = 256 * 1024;
  const out: string[] = [];
  for (let i = 0; i < pt.length; i += CHUNK_SIZE) {
    out.push(Buffer.from(pt.slice(i, i + CHUNK_SIZE)).toString("base64"));
  }
  return { chunks: out, bytes: pt.length };
}
