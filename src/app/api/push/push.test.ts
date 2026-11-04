import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ miembro: vi.fn(), enviar: vi.fn() }));
vi.mock("@/infraestructura/acceso-miembro", () => ({
  esMiembroConToken: m.miembro,
  tokenDeLaPeticion: (r: Request) =>
    /^Bearer (.+)$/.exec(r.headers.get("authorization") ?? "")?.[1],
}));
vi.mock("@/infraestructura/avisos/push", () => ({
  claveVapidPublica: () => process.env.VAPID_PUBLIC_KEY ?? null,
  generarClavesVapid: () => ({ publicKey: "PUB", privateKey: "PRIV" }),
  pushConfigurado: () => Boolean(process.env.VAPID_PUBLIC_KEY),
  enviarPush: m.enviar,
}));

import { GET as clave } from "./clave/route";
import { POST as claves } from "./claves/route";
import { POST as prueba } from "./prueba/route";

const post = (ruta: string, cabecera?: string, cuerpo?: unknown) =>
  new Request(`http://localhost/api/push/${ruta}`, {
    method: "POST",
    headers: {
      ...(cabecera ? { authorization: cabecera } : {}),
      "content-type": "application/json",
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
const sub = {
  endpoint: "https://push.example.test/abc",
  keys: { p256dh: "p".repeat(30), auth: "a".repeat(12) },
};

beforeEach(() => {
  vi.unstubAllEnvs();
  m.miembro.mockReset().mockResolvedValue(true);
  m.enviar.mockReset().mockResolvedValue("ok");
});

describe("GET /api/push/clave", () => {
  it("404 si no está configurado y la clave pública si lo está", async () => {
    expect((await clave()).status).toBe(404);
    vi.stubEnv("VAPID_PUBLIC_KEY", "PUBLICA");
    expect(await (await clave()).json()).toEqual({ clave: "PUBLICA" });
  });
});

describe("POST /api/push/claves", () => {
  it("sin sesión de miembro no entrega claves", async () => {
    expect((await claves(post("claves"))).status).toBe(401);
    m.miembro.mockResolvedValue(false);
    expect((await claves(post("claves", "Bearer falso"))).status).toBe(401);
  });
  it("a un miembro le da un par, sin guardarlo en caché", async () => {
    const r = await claves(post("claves", "Bearer bueno"));
    expect(await r.json()).toEqual({ publica: "PUB", privada: "PRIV" });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/push/prueba", () => {
  it("exige sesión de miembro y configuración", async () => {
    expect((await prueba(post("prueba", undefined, sub))).status).toBe(401);
    expect((await prueba(post("prueba", "Bearer bueno", sub))).status).toBe(503); // sin claves
  });
  it("rechaza una suscripción mal formada o que no es https", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "PUB");
    expect(
      (
        await prueba(
          post("prueba", "Bearer bueno", { endpoint: "http://x.test/a", keys: sub.keys }),
        )
      ).status,
    ).toBe(400);
    expect((await prueba(post("prueba", "Bearer bueno", { nada: 1 }))).status).toBe(400);
  });
  it("manda la prueba, y distingue caducada de fallo", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "PUB");
    expect((await prueba(post("prueba", "Bearer bueno", sub))).status).toBe(200);
    m.enviar.mockResolvedValue("caducada");
    expect((await prueba(post("prueba", "Bearer bueno", sub))).status).toBe(410);
    m.enviar.mockResolvedValue("fallo");
    const r = await prueba(post("prueba", "Bearer bueno", sub));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "no-disponible" });
  });
});
