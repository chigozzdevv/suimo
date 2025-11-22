import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireUser } from "@/middleware/auth.js";
import {
  siteVerifyInput,
  siteVerifyCheckInput,
  uploadDatasetInput,
} from "@/features/providers/providers.schema.js";
import {
  createOrGetProviderController,
  getMeController,
  getOverviewController,
  getRequestsController,
  getEarningsController,
  siteVerifyInitController,
  siteVerifyCheckController,
  getDomainsController,
  deleteDomainController,
  uploadDatasetController,
} from "@/features/providers/providers.controller.js";

export async function registerProvidersRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/providers",
    { preHandler: [requireUser] },
    createOrGetProviderController,
  );

  r.get("/providers/me", { preHandler: [requireUser] }, getMeController);

  r.get(
    "/providers/overview",
    { preHandler: [requireUser] },
    getOverviewController,
  );

  r.get(
    "/providers/requests",
    { preHandler: [requireUser] },
    getRequestsController,
  );

  r.get(
    "/providers/earnings",
    { preHandler: [requireUser] },
    getEarningsController,
  );

  r.post(
    "/sites/verify",
    { preHandler: [requireUser], schema: { body: siteVerifyInput } },
    siteVerifyInitController,
  );

  r.post(
    "/sites/verify-check",
    { preHandler: [requireUser], schema: { body: siteVerifyCheckInput } },
    siteVerifyCheckController,
  );

  r.get("/domains", { preHandler: [requireUser] }, getDomainsController);

  r.delete(
    "/domains/:domain",
    { preHandler: [requireUser] },
    deleteDomainController,
  );

  r.post(
    "/datasets/upload",
    { preHandler: [requireUser], schema: { body: uploadDatasetInput } },
    uploadDatasetController,
  );
}
