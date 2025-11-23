import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { loadEnv } from "@/config/env.js";

const DEFAULT_TESTNET_KEY_SERVERS = [
  "0xb35a7228d8cf224ad1e828c0217c95a5153bafc2906d6f9c178197dce26fbcf8",
  "0x2d6cde8a9d9a65bde3b0a346566945a63b4bfb70e9a06c41bdb70807e2502b06",
];

export async function registerSealRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/seal/key-servers", async () => {
    const env = loadEnv();
    const network = (
      env.WALRUS_NETWORK === "mainnet" ? "mainnet" : "testnet"
    ) as "mainnet" | "testnet";
    try {
      const ids = env.SEAL_KEY_SERVER_IDS
        ? env.SEAL_KEY_SERVER_IDS.split(",")
          .map((id) => id.trim())
          .filter(Boolean)
        : network === "testnet"
          ? DEFAULT_TESTNET_KEY_SERVERS
          : [];
      const toHex = (id: unknown): string => {
        if (!id) return "";
        if (typeof id === "string") return id.startsWith("0x") ? id : `0x${id}`;
        try {
          const u8 = id instanceof Uint8Array ? id : new Uint8Array(id as any);
          return "0x" + Buffer.from(u8).toString("hex");
        } catch {
          return "";
        }
      };
      const objectIds = Array.isArray(ids)
        ? ids.map(toHex).filter(Boolean)
        : [];
      return { objectIds };
    } catch {
      return { objectIds: [] };
    }
  });
}
