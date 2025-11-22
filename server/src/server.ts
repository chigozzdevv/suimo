import { buildApp } from "@/app.js";
import { loadEnv } from "@/config/env.js";
import { KeepAliveService } from "@/services/keepalive.service.js";

async function main() {
  const env = loadEnv();
  const app = buildApp();
  const port = Number(env.PORT || 3000);
  await app.listen({ port, host: "0.0.0.0" });

  const keepAlive = new KeepAliveService();
  keepAlive.start();

  process.on("SIGTERM", () => {
    keepAlive.stop();
    app.close();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
