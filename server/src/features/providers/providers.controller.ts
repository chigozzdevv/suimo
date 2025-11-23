import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  siteVerifyInput,
  siteVerifyCheckInput,
  uploadDatasetInput,
} from "@/features/providers/providers.schema.js";
import {
  getOrCreateProvider,
  getProviderByUserId,
  getProviderOverview,
  getProviderRequests,
  getProviderEarnings,
  verifySiteInit,
  verifySiteCheck,
  getProviderDomains,
  removeProviderDomain,
} from "@/features/providers/providers.service.js";
import { putWalrusBlobAsProvider } from "@/features/walrus/walrus.service.js";
import { sealEncryptForPolicy } from "@/features/seal/seal.service.js";

export async function createOrGetProviderController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (req as any).userId as string;
  const provider = await getOrCreateProvider(userId);
  return reply.send({ provider });
}

export async function getMeController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (req as any).userId as string;
  const provider = await getProviderByUserId(userId);
  if (!provider) return reply.code(404).send({ error: "PROVIDER_NOT_FOUND" });
  return reply.send({ provider });
}

export async function getOverviewController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (req as any).userId as string;
  const overview = await getProviderOverview(userId);
  if (!overview) return reply.code(404).send({ error: "PROVIDER_NOT_FOUND" });
  return reply.send(overview);
}

export async function getRequestsController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (req as any).userId as string;
  const query = req.query as any;
  const limit = Math.min(Number(query.limit) || 100, 500);
  const status = query.status as string | undefined;
  const data = await getProviderRequests(userId, { limit, status });
  if (!data) return reply.code(404).send({ error: "PROVIDER_NOT_FOUND" });
  return reply.send({ requests: data });
}

export async function getEarningsController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (req as any).userId as string;
  const earnings = await getProviderEarnings(userId);
  if (!earnings) return reply.code(404).send({ error: "PROVIDER_NOT_FOUND" });
  return reply.send({ earnings });
}

// Resource creation controller moved to resources.controller

export async function siteVerifyInitController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (req as any).userId as string;
  const { domain, method } = siteVerifyInput.parse(req.body);
  const out = await verifySiteInit(userId, domain, method);
  if (!out) return reply.code(404).send({ error: "PROVIDER_NOT_FOUND" });
  return reply.send(out);
}

export async function siteVerifyCheckController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (req as any).userId as string;
  const { domain, method, token } = siteVerifyCheckInput.parse(req.body);
  const out = await verifySiteCheck(userId, domain, method, token);
  return reply.send(out);
}

export async function getDomainsController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (req as any).userId as string;
  const domains = await getProviderDomains(userId);
  if (!domains) return reply.code(404).send({ error: "PROVIDER_NOT_FOUND" });
  return reply.send({ domains });
}

export async function deleteDomainController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (req as any).userId as string;
  const { domain } = req.params as { domain: string };
  const result = await removeProviderDomain(userId, domain);
  return reply.send(result);
}

export async function uploadDatasetController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = (req as any).userId as string;
  const body = uploadDatasetInput.parse(req.body);
  const decoded = Buffer.from(body.encrypted_object_b64, "base64");
  let bytesToStore: Uint8Array = new Uint8Array(decoded);
  let sizeBytes = decoded.byteLength;

  // Validate the ciphertext is a parsable Seal envelope before storing; if invalid, encrypt it here.
  try {
    const { EncryptedObject } = await import("@mysten/seal");
    EncryptedObject.parse(new Uint8Array(decoded));
  } catch (err: any) {
    try {
      const plain = new Uint8Array(decoded) as unknown as Uint8Array<ArrayBuffer>;
      const { ciphertextEnvelope, meta } = await sealEncryptForPolicy(plain, "");
      bytesToStore = ciphertextEnvelope;
      sizeBytes = meta.size_bytes;
    } catch (encErr: any) {
      return reply.code(400).send({
        error: "SEAL_CIPHERTEXT_INVALID",
        detail: String(err?.message || err),
      });
    }
  }
  try {
    const res = await putWalrusBlobAsProvider(userId, bytesToStore, {
      deletable: body.deletable ?? true,
      epochs: body.epochs ?? 1,
    });
    return reply.send({
      walrus_blob_id: res.id,
      walrus_blob_object_id: res.objectId,
      size_bytes: sizeBytes,
    });
  } catch (e: any) {
    const msg = String(e?.message || "UPLOAD_FAILED");
    if (msg.includes("PROVIDER_WALLET_MISSING"))
      return reply.code(400).send({ error: "PROVIDER_WALLET_MISSING" });
    if (
      msg.includes("INSUFFICIENT") ||
      msg.includes("Not enough coins") ||
      msg.includes("INSUFFICIENT_BALANCE")
    ) {
      return reply.code(402).send({ error: "INSUFFICIENT_WAL_OR_SUI" });
    }
    throw e;
  }
}
