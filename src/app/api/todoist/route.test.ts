import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  usuario: { v: { id: "u" } as { id: string } | null },
  hogar: { v: { id: "h" } as { id: string } | null },
  sincronizar: vi.fn(),
}));
vi.mock("@/infraestructura/supabase/cliente-servidor", () => ({
  crearClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: m.usuario.v } }) },
  }),
}));
vi.mock("@/infraestructura/supabase/cuenta", () => ({ hogarDelUsuario: async () => m.hogar.v }));
vi.mock("@/infraestructura/todoist", async () => {
  class TodoistError extends Error {
    constructor(
      readonly motivo: string,
      mensaje?: string,
    ) {
      super(mensaje ?? motivo);
    }
  }
  return { TodoistError, sincronizarConTodoist: m.sincronizar };
});

import { TodoistError } from "@/infraestructura/todoist";
import { GET, POST } from "./route";

const pedir = (cuerpo: unknown) =>
  POST(
    new Request("http://localhost/api/todoist", {
      method: "POST",
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    }),
  );

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("TODOIST_TOKEN", "TOKEN");
  m.usuario.v = { id: "u" };
  m.hogar.v = { id: "h" };
  m.sincronizar.mockReset().mockResolvedValue({ creadas: [], activas: [], cerradas: [] });
});

describe("/api/todoist (D-205)", () => {
  it("sin sesión o sin hogar, nada", async () => {
    m.usuario.v = null;
    expect((await GET()).status).toBe(401);
    expect((await pedir({ crear: [], cerrar: [] })).status).toBe(401);
    m.usuario.v = { id: "u" };
    m.hogar.v = null;
    expect((await GET()).status).toBe(403);
    expect(m.sincronizar).not.toHaveBeenCalled();
  });

  it("GET dice si está configurado y de quién es, sin enseñar el token", async () => {
    const r = await GET();
    expect(await r.json()).toEqual({ configurado: true, persona: "diego" });
    vi.stubEnv("TODOIST_PERSONA_ID", "ana");
    vi.stubEnv("TODOIST_TOKEN", "");
    expect(await (await GET()).json()).toEqual({ configurado: false, persona: "ana" });
  });

  it("POST sin token, 503; con una petición mala, 400, sin llamar a Todoist", async () => {
    vi.stubEnv("TODOIST_TOKEN", "");
    expect((await pedir({ crear: [], cerrar: [] })).status).toBe(503);
    vi.stubEnv("TODOIST_TOKEN", "TOKEN");
    for (const c of [
      "no es json",
      {},
      { crear: [{ ref: "", content: "x" }], cerrar: [] },
      { crear: [], cerrar: ["../x"] },
      { crear: Array.from({ length: 31 }, (_, i) => ({ ref: `r${i}`, content: "x" })), cerrar: [] },
    ]) {
      expect((await pedir(c)).status).toBe(400);
    }
    expect(m.sincronizar).not.toHaveBeenCalled();
  });

  it("POST sincroniza con el token del servidor y devuelve el resultado", async () => {
    m.sincronizar.mockResolvedValue({
      creadas: [{ ref: "pen-1", id: "T1" }],
      activas: [{ id: "T1", content: "x" }],
      cerradas: [],
    });
    const r = await pedir({ crear: [{ ref: "pen-1", content: "x" }], cerrar: ["T9"] });
    expect(r.status).toBe(200);
    expect((await r.json()).creadas).toEqual([{ ref: "pen-1", id: "T1" }]);
    expect(m.sincronizar).toHaveBeenCalledWith("TOKEN", {
      crear: [{ ref: "pen-1", content: "x" }],
      cerrar: ["T9"],
    });
  });

  it("si Todoist falla, 502 con el motivo (401 si el token no vale)", async () => {
    m.sincronizar.mockRejectedValue(new TodoistError("red"));
    const r = await pedir({ crear: [], cerrar: [] });
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "no-disponible", motivo: "red" });
    m.sincronizar.mockRejectedValue(new TodoistError("token"));
    expect((await pedir({ crear: [], cerrar: [] })).status).toBe(401);
  });
});
