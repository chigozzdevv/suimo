import { randomUUID } from "node:crypto";
import {
  searchResources as repoSearch,
  getResourceById,
} from "@/features/mcp/mcp.model.js";
import { getDb } from "@/config/db.js";
import { findProviderById } from "@/features/providers/providers.model.js";
import { createSignedReceipt } from "@/features/receipts/receipts.model.js";
import { getWalrusBlobChunks } from "@/features/walrus/walrus.service.js";
import { sealDecryptForAccess } from "@/features/seal/seal.service.js";
import { findConnectorById } from "@/features/connectors/connectors.model.js";
import { fetchViaConnector } from "@/features/connectors/connectors.service.js";
import { checkSpendingCaps } from "@/features/caps/caps.service.js";
import { createAgent } from "@/features/agents/agents.service.js";
import { transferWal } from "@/services/sui/sui.service.js";
import { findWalletKey } from "@/features/wallets/keys.model.js";
import { calculateWalAmount, verifyWalPayment } from "@/features/payments/wal-payments.service.js";

export type PendingReceipt = {
  requestId: string;
  payload: Record<string, any>;
};

// Ranks resources for a query; we blend text relevance with coarse cost/latency to prefer "good-enough and cheaper".
export async function discoverService(params: {
  query: string;
  filters?: { format?: string[] };
  userId?: string;
  agentId?: string;
}) {
  const list = await repoSearch(params.query, {
    format: params.filters?.format,
  });

  const results = list.map((r) => {
    const priceEst =
      typeof r.price_flat === "number" && r.price_flat > 0
        ? r.price_flat
        : typeof r.price_per_kb === "number" &&
          r.price_per_kb > 0 &&
          typeof r.size_bytes === "number"
          ? Number((r.price_per_kb * (r.size_bytes / 1024)).toFixed(6))
          : 0;

    const relevanceScore = computeRelevanceScore(params.query, r);

    return {
      resourceId: r.id!,
      title: r.title,
      type: r.type,
      format: r.format,
      domain: r.domain,
      updatedAt: (r as any).updatedAt || (r as any).updated_at,
      summary: r.summary,
      samplePreview: (r as any).sample_preview,
      tags: r.tags,
      priceEstimate: priceEst,
      avgSizeKb:
        typeof r.size_bytes === "number"
          ? Math.round(r.size_bytes / 1024)
          : undefined,
      relevanceScore,
      latencyMs: (r as any).avg_latency_ms || 500,
    };
  });

  const scored = results
    .map((r) => ({
      ...r,
      score:
        r.relevanceScore - 0.1 * (r.priceEstimate || 0) - 0.0001 * r.latencyMs,
    }))
    .sort((a, b) => b.score - a.score);

  if (params.userId) {
    const { randomUUID } = await import("node:crypto");
    const { recordDiscoveryQuery, recordSearchImpressions } = await import(
      "@/features/analytics/analytics.model.js"
    );
    const queryId = randomUUID();
    await recordDiscoveryQuery({
      _id: queryId,
      query: params.query,
      user_id: params.userId,
      agent_id: params.agentId,
      matched_resource_ids: scored.map((r) => r.resourceId),
      created_at: new Date().toISOString(),
    });
    const impressions = scored.map((r, idx) => ({
      _id: randomUUID(),
      resource_id: r.resourceId,
      query_id: queryId,
      rank: idx + 1,
      selected: false,
      created_at: new Date().toISOString(),
    }));
    await recordSearchImpressions(impressions);
  }

  return { results: scored, recommended: scored[0]?.resourceId };
}

function computeRelevanceScore(query: string, resource: any): number {
  const tokens = Array.from(
    new Set(
      String(query)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1),
    ),
  ).slice(0, 6);
  if (tokens.length === 0) return 0;
  let matchScore = 0;
  const title = String(resource.title || "").toLowerCase();
  const summary = String(resource.summary || "").toLowerCase();
  const sample = String((resource as any).sample_preview || "").toLowerCase();
  const tags: string[] = Array.isArray(resource.tags)
    ? resource.tags.map((x: any) => String(x).toLowerCase())
    : [];
  for (const t of tokens) {
    let tokenScore = 0;
    if (title.includes(t)) tokenScore = Math.max(tokenScore, 1.0);
    if (summary.includes(t)) tokenScore = Math.max(tokenScore, 0.6);
    if (sample.includes(t)) tokenScore = Math.max(tokenScore, 0.6);
    if (tags.some((tag) => tag.includes(t)))
      tokenScore = Math.max(tokenScore, 0.7);
    matchScore += tokenScore;
  }
  const normalized = Math.min(1, matchScore / tokens.length);
  return normalized;
}

// Fetch content via connector, compute final cost, settle internally, then pay provider on-chain and issue a signed receipt.
export async function fetchService(
  params: {
    userId: string;
    clientId: string;
    agentId?: string;
    resourceId: string;
    mode: "raw" | "summary";
    constraints?: { maxCost?: number; maxBytes?: number };
  },
  opts?: { settlementMode?: "internal" | "external" },
) {
  const { userId, clientId, agentId, resourceId, mode, constraints } = params;
  const db = await getDb();
  const agentsColl = db.collection<any>("agents");
  // Resolve or create an active agent context for this client/user
  let agent: any | null = agentId
    ? await agentsColl.findOne({
      _id: agentId,
      user_id: userId,
      client_id: clientId,
      status: { $ne: "revoked" },
    } as any)
    : await agentsColl.findOne({
      user_id: userId,
      client_id: clientId,
      status: { $ne: "revoked" },
    } as any);
  if (!agent) {
    agent = await createAgent(
      userId,
      `OAuth Client ${clientId.slice(-6)}`,
      clientId,
    );
  }
  const activeAgent = agent as any;
  const resource = await getResourceById(resourceId);
  if (!resource) return { status: 404 as const, error: "RESOURCE_NOT_FOUND" };

  // Policy enforcement (modes + visibility allowlist) with summary→raw fallback
  const modes = (resource.modes || resource.policy?.modes) as any;
  const requestedMode = mode;
  let effectiveMode: "raw" | "summary" = requestedMode;
  if (requestedMode === "summary" && modes && !modes.includes("summary")) {
    if (!modes || modes.includes("raw")) {
      effectiveMode = "raw";
    } else {
      return { status: 403 as const, error: "MODE_NOT_ALLOWED" };
    }
  } else if (requestedMode === "raw" && modes && !modes.includes("raw")) {
    return { status: 403 as const, error: "MODE_NOT_ALLOWED" };
  }
  if (
    requestedMode === "summary" &&
    (!resource.summary || String(resource.summary).trim().length === 0)
  ) {
    if (!modes || modes.includes("raw")) {
      effectiveMode = "raw";
    } else {
      return { status: 404 as const, error: "SUMMARY_NOT_AVAILABLE" };
    }
  }
  const visibility = (resource.policy?.visibility ||
    resource.visibility) as any;
  if (visibility === "restricted") {
    const allow = resource.policy?.allow || [];
    if (!allow.includes(activeAgent._id))
      return { status: 403 as const, error: "PROVIDER_POLICY_DENY" };
  }

  // Persist request lifecycle; we will update status/cost after fetch/settlement
  const requestId = "rq_" + randomUUID();
  const requests = db.collection<any>("requests");
  await requests.insertOne({
    _id: requestId,
    user_id: activeAgent.user_id,
    agent_id: activeAgent._id,
    resource_id: resourceId,
    mode: effectiveMode,
    status: "initiated",
    ts: new Date().toISOString(),
  } as any);

  const provider = await findProviderById(resource.provider_id);
  if (!provider) {
    await requests.updateOne(
      { _id: requestId } as any,
      {
        $set: { status: "failed", failure_reason: "PROVIDER_NOT_FOUND" },
      } as any,
    );
    return { status: 500 as const, error: "PROVIDER_NOT_FOUND" };
  }

  // If the requester owns the resource, we waive pricing
  const sameOwner = provider.user_id === activeAgent.user_id;
  const isFlat =
    typeof resource.price_flat === "number" && resource.price_flat! > 0;
  const unitPrice = resource.price_per_kb ?? 0;
  const estBytes =
    resource.size_bytes ??
    Math.min(constraints?.maxBytes ?? 256 * 1024, 10 * 1024 * 1024);
  const estCost = sameOwner
    ? 0
    : isFlat
      ? resource.price_flat!
      : Number((unitPrice * (estBytes / 1024)).toFixed(6));

  if (estCost > 0 && !sameOwner) {
    const capCheck = await checkSpendingCaps(
      activeAgent.user_id,
      resourceId,
      effectiveMode,
      estCost,
    );
    if (!capCheck.allowed) {
      return {
        status: 402 as const,
        error: capCheck.reason || "SPENDING_CAP_EXCEEDED",
        quote: estCost,
        cap: { limit: capCheck.limit, current: capCheck.current },
      };
    }
  }

  const settlementMode = opts?.settlementMode ?? "internal";

  let consumerPaymentTx: string | undefined;
  let walAmountRequired = 0;
  if (settlementMode === "internal" && estCost > 0 && !sameOwner) {
    try {
      const { walAmount, walUsdRate } = await calculateWalAmount(estCost);
      walAmountRequired = walAmount;

      const { transferWalFromUser } = await import("@/features/payments/custodial-transfer.service.js");
      let platformKey = await findWalletKey("platform", "payout");
      // Fallback to env if DB record missing
      if (!platformKey) {
        const raw = process.env.SUI_PLATFORM_PRIVATE_KEY;
        if (raw) {
          try {
            const { decodeSuiPrivateKey } = await import("@mysten/sui/cryptography");
            const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
            const { schema, secretKey } = decodeSuiPrivateKey(raw);
            if (schema === 'ED25519') {
              const kp = Ed25519Keypair.fromSecretKey(secretKey);
              platformKey = {
                public_key: kp.getPublicKey().toSuiAddress()
              } as any;
            }
          } catch (e) {
            console.warn("Failed to derive platform key from env:", e);
          }
        }
      }

      if (!platformKey?.public_key) {
        return {
          status: 500 as const,
          error: "PLATFORM_WALLET_NOT_CONFIGURED",
        };
      }

      consumerPaymentTx = await transferWalFromUser(
        activeAgent.user_id,
        platformKey.public_key,
        walAmountRequired
      );
    } catch (e: any) {
      if (String(e.message).includes("WAL_PRICE_UNAVAILABLE"))
        return {
          status: 503 as const,
          error: "PRICE_SERVICE_UNAVAILABLE",
        };
      if (String(e.message).includes("INSUFFICIENT_WAL_BALANCE"))
        return {
          status: 402 as const,
          error: "INSUFFICIENT_WAL_BALANCE",
          quote: estCost,
        };
      throw e;
    }
  }

  try {
    let content: string | { url: string } = "";
    let bytesBilled = 0;
    let walrusCipher: { chunks: string[]; bytes: number } | null = null;

    const toBase64 = (buf: Uint8Array) =>
      Buffer.from(buf).toString("base64");

    if (
      effectiveMode === "summary" &&
      resource.summary &&
      String(resource.summary).trim().length > 0
    ) {
      const buf = Buffer.from(String(resource.summary), "utf8");
      bytesBilled = buf.byteLength;
      content = toBase64(buf);
    }
    // Retrieve raw content either via connector or internal storage; always return single base64
    else if (resource.connector_id) {
      const connector = await findConnectorById(resource.connector_id);
      if (!connector) throw new Error("CONNECTOR_NOT_FOUND");
      const fetched = await fetchViaConnector(resource as any, connector);
      if (fetched.kind === "internal") {
        if (resource.walrus_blob_id) {
          walrusCipher = await getWalrusBlobChunks(resource.walrus_blob_id);
          bytesBilled =
            typeof resource.size_bytes === "number"
              ? resource.size_bytes
              : walrusCipher.bytes;
        } else if (resource.walrus_quilt_id) {
          walrusCipher = await getWalrusBlobChunks(resource.walrus_quilt_id);
          bytesBilled =
            typeof resource.size_bytes === "number"
              ? resource.size_bytes
              : walrusCipher.bytes;
        } else {
          throw new Error("WALRUS_REF_MISSING");
        }
      } else {
        bytesBilled = fetched.bytes;
        content = toBase64(fetched.body);
      }
    } else if (resource.walrus_blob_id || resource.walrus_quilt_id) {
      const walrusId = resource.walrus_blob_id || resource.walrus_quilt_id!;
      walrusCipher = await getWalrusBlobChunks(walrusId);
    } else {
      return { status: 501 as const, error: "NO_CONNECTOR" };
    }

    const finalCost = sameOwner
      ? 0
      : isFlat
        ? resource.price_flat!
        : Number((unitPrice * (bytesBilled / 1024)).toFixed(6));

    let providerSettlementTx: string | undefined;
    if (settlementMode === "internal" && finalCost > 0 && !sameOwner) {
      const bps = Number(process.env.PLATFORM_FEE_BPS || "0");
      const providerShare = Number(
        (finalCost - Number(((finalCost * bps) / 10000).toFixed(6))).toFixed(6),
      );
      if (providerShare > 0) {
        const key = await findWalletKey(provider.user_id, "payout");
        if (!key?.public_key) {
          throw new Error("PROVIDER_PAYOUT_ADDRESS_MISSING");
        }
        providerSettlementTx = await transferWal(key.public_key, providerShare);
      }
    }

    if (walrusCipher) {
      const plaintext = await sealDecryptForAccess(
        { chunks: walrusCipher.chunks },
        resource.seal_policy_id,
        { requestId },
      );
      content = plaintext.base64;
    }

    const receiptPayload = {
      id: "rcpt_" + randomUUID(),
      request_id: requestId,
      resource: { id: resourceId, title: resource.title },
      providerId: resource.provider_id,
      userId: activeAgent.user_id,
      agentId: activeAgent._id,
      mode: effectiveMode,
      requested_mode: requestedMode,
      bytes_billed: bytesBilled,
      unit_price: sameOwner ? undefined : isFlat ? undefined : unitPrice,
      flat_price: sameOwner ? undefined : isFlat ? finalCost : undefined,
      paid_total: finalCost,
      splits:
        finalCost > 0
          ? ((): any[] => {
            const bps = Number(process.env.PLATFORM_FEE_BPS || "0");
            const fee = Number(((finalCost * bps) / 10000).toFixed(6));
            return fee > 0
              ? [
                {
                  to: "wallet:provider_payout",
                  amount: Number((finalCost - fee).toFixed(6)),
                },
                { to: "wallet:platform_fee", amount: fee },
              ]
              : [{ to: "wallet:provider_payout", amount: finalCost }];
          })()
          : [],
      provider_onchain_tx: providerSettlementTx,
    };

    await requests.updateOne(
      { _id: requestId } as any,
      {
        $set: { status: "settled", bytes_billed: bytesBilled, cost: finalCost },
      } as any,
    );
    const receipt = await createSignedReceipt(receiptPayload);
    return { status: 200 as const, content, receipt, requestId };
  } catch (err) {
    throw err;
  }
}
