import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const sourceVersion = createHash("sha256");
for (const file of [
  "index.html",
  "web/main.ts",
  "web/model.ts",
  "web/calculator.worker.ts",
  "web/style.css",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
]) {
  sourceVersion.update(file).update("\0").update(readFileSync(file));
}

export default defineConfig({
  base: "./",
  define: { __SOURCE_VERSION__: JSON.stringify(sourceVersion.digest("hex")) },
  test: { include: ["web-tests/**/*.test.ts"] },
  build: { target: "es2022", modulePreload: { polyfill: false } },
});
