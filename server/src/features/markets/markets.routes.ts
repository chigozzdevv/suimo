import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  getMarketController,
  listMarketsController,
  listMarketCategoriesController,
} from "@/features/markets/markets.controller.js";

export async function registerMarketsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get("/markets", { schema: {} }, listMarketsController);
  r.get("/markets/:slug", { schema: {} }, getMarketController);
  r.get("/markets/categories", { schema: {} }, listMarketCategoriesController);
}
