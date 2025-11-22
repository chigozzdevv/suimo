import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { fetchTokenPrices } from "@/features/prices/prices.service.js";

export async function registerPricesRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/prices", async () => {
    const prices = await fetchTokenPrices();
    return prices;
  });
}
