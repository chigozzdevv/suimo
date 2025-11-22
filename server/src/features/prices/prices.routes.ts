import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { loadEnv } from "@/config/env.js";

export async function registerPricesRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/prices", async () => {
    const env = loadEnv();
    const rate = Number(
      process.env.WAL_USD_RATE || (env as any).WAL_USD_RATE || 0,
    );
    if (!rate || !isFinite(rate) || rate <= 0) {
      return { wal_usd: null };
    }
    return { wal_usd: rate };
  });
}
