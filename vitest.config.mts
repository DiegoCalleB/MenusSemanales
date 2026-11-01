import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/dominio/**/*.ts", "src/aplicacion/**/*.ts", "src/infraestructura/env.ts"],
      exclude: ["**/*.test.ts"],
      reporter: ["text", "html"],
      // El dominio es el corazón del producto: se exige cobertura alta y se comprueba en CI.
      thresholds: {
        "src/dominio/**/*.ts": { lines: 90, functions: 90, branches: 85, statements: 90 },
      },
    },
  },
});
