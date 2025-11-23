import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const sealEsmDir = resolve(rootDir, "node_modules/@mysten/seal/dist/esm");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
      "@mysten/seal/dist/esm/encrypt.js": resolve(sealEsmDir, "encrypt.js"),
      "@mysten/seal/dist/esm/dem.js": resolve(sealEsmDir, "dem.js"),
    },
  },
});
