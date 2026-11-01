import { expect, test } from "@playwright/test";

/**
 * Tests de regresión de seguridad. Comprueban en un navegador real que las cabeceras y la CSP
 * protegen la aplicación (ver docs/seguridad.md).
 */

test("responde con todas las cabeceras de seguridad y sin delatar la tecnología", async ({
  request,
}) => {
  const r = await request.get("/");
  const h = r.headers();
  expect(h["strict-transport-security"]).toContain("max-age=63072000");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["cross-origin-opener-policy"]).toBe("same-origin");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("la CSP lleva un nonce distinto en cada petición y no permite inline", async ({ request }) => {
  const nonce = async () => {
    const csp = (await request.get("/")).headers()["content-security-policy"] ?? "";
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    return /'nonce-([^']+)'/.exec(csp)?.[1];
  };
  const [a, b] = [await nonce(), await nonce()];
  expect(a).toBeTruthy();
  expect(a).not.toBe(b);
});

test("la app funciona con la CSP: Next arranca sin violaciones ni errores", async ({ page }) => {
  const violaciones: string[] = [];
  const errores: string[] = [];
  await page.exposeFunction("__violacion", (d: string) => violaciones.push(d));
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { __violacion: (d: string) => void }).__violacion(e.violatedDirective),
    ),
  );
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));

  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Menús Semanales" })).toBeVisible();
  expect(await page.evaluate(() => typeof (window as { next?: unknown }).next)).toBe("object");
  expect(violaciones).toEqual([]);
  expect(errores).toEqual([]);
});

test("la CSP bloquea XSS por HTML inyectado (servidor y DOM)", async ({ page }) => {
  const violaciones: string[] = [];
  await page.exposeFunction("__violacion", (d: string) => violaciones.push(d));
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { __violacion: (d: string) => void }).__violacion(e.violatedDirective),
    ),
  );
  // Simula contenido malicioso que se colara sin escapar en el HTML del servidor.
  await page.route("/", async (route) => {
    const r = await route.fetch();
    const html = (await r.text()).replace(
      "</body>",
      '<script>window.__xss1=1</script><img src="x" onerror="window.__xss2=1"></body>',
    );
    await route.fulfill({ response: r, body: html });
  });
  await page.goto("/", { waitUntil: "networkidle" });
  // Y HTML malicioso insertado en el DOM.
  await page.evaluate(() =>
    document.body.insertAdjacentHTML("beforeend", '<img src="y" onerror="window.__xss3=1">'),
  );
  await page.waitForTimeout(300);

  const ejecutado = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return [w.__xss1, w.__xss2, w.__xss3].some(Boolean);
  });
  expect(ejecutado).toBe(false);
  expect(violaciones).toEqual(expect.arrayContaining(["script-src-elem", "script-src-attr"]));
});

test("la comprobación de salud no expone información interna", async ({ request }) => {
  const r = await request.get("/api/salud");
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ estado: "ok" });
  expect(r.headers()["cache-control"]).toBe("no-store");
});
