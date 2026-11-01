import { defineConfig, devices } from "@playwright/test";

const PUERTO = 3200;

/**
 * Tests E2E contra el servidor autónomo de producción (el mismo que ejecuta la imagen Docker).
 * Ejecutar con `pnpm e2e` (hace la build y prepara el servidor).
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://127.0.0.1:${PUERTO}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node .next/standalone/server.js`,
    env: { PORT: String(PUERTO), HOSTNAME: "127.0.0.1" },
    url: `http://127.0.0.1:${PUERTO}/api/salud`,
    reuseExistingServer: !process.env.CI,
  },
});
