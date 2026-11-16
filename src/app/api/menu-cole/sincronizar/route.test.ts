import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ comprobar: vi.fn() }));
vi.mock("@/infraestructura/avisos/claves", () => ({ comprobarSecretoDeAvisos: m.comprobar }));
vi.mock("@/infraestructura/avisos/push", () => ({ enviarPush: vi.fn() }));
vi.mock("@/infraestructura/avisos/suscripciones", () => ({
  leerSuscripciones: vi.fn(),
  olvidarSuscripcion: vi.fn(),
}));
vi.mock("@/infraestructura/calendario-suscrito", () => ({ hoyEnMadrid: () => "2026-11-28" }));
vi.mock("@/infraestructura/ia/cole", () => ({ transcribirMenuCole: vi.fn() }));
vi.mock("@/infraestructura/menu-cole-blog", () => ({
  bajarMenuBasal: vi.fn(),
  centrosConBlog: async () => [],
  fuentesVistas: vi.fn(),
  leerEntradasDelBlog: vi.fn(),
  registrarMenu: vi.fn(),
}));

import { POST } from "./route";

const SECRETO = "a".repeat(64);
const pedir = (auth?: string) =>
  POST(
    new Request("http://localhost/api/menu-cole/sincronizar", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    }),
  );

describe("POST /api/menu-cole/sincronizar", () => {
  it("sin secreto o con otro, 401 y no lee nada", async () => {
    expect((await pedir()).status).toBe(401);
    m.comprobar.mockResolvedValue({ valido: false });
    expect((await pedir(`Bearer ${SECRETO}`)).status).toBe(401);
  });
  it("con el secreto de verdad, 200 (sin colegios con blog no hay nada que hacer)", async () => {
    m.comprobar.mockResolvedValue({ valido: true, claves: null });
    const r = await pedir(`Bearer ${SECRETO}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ resultado: [] });
  });
});
