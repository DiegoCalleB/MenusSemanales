import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  configurada: true,
  usuario: { id: "u1" } as { id: string } | null,
  hogar: { id: "h1", nombre: "Casa", rol: "admin" } as {
    id: string;
    nombre: string;
    rol: string;
  } | null,
  uso: { data: { usadas: 3, limite: 40 }, error: null } as {
    data: unknown;
    error: { code: string } | null;
  },
  ia: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/infraestructura/calendario-suscrito", () => ({ hoyEnMadrid: () => "2026-11-17" }));
vi.mock("@/infraestructura/ia/lista", () => ({
  iaConfigurada: () => estado.configurada,
  IaNoConfigurada: class IaNoConfigurada extends Error {},
}));
vi.mock("@/infraestructura/ia/preguntar", () => ({ preguntarALaCasa: estado.ia }));
vi.mock("@/infraestructura/supabase/cliente-servidor", () => ({
  crearClienteServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: estado.usuario } }) },
    rpc: estado.rpc,
  }),
}));
vi.mock("@/infraestructura/supabase/cuenta", () => ({
  hogarDelUsuario: async () => estado.hogar,
}));

import { POST } from "./route";

const pedir = (cuerpo: unknown, crudo?: string) =>
  POST(
    new Request("http://localhost/api/ia/preguntar", {
      method: "POST",
      body: crudo ?? JSON.stringify(cuerpo),
    }),
  );
const ok = "El pediatra es el jueves.";

beforeEach(() => {
  estado.configurada = true;
  estado.usuario = { id: "u1" };
  estado.hogar = { id: "h1", nombre: "Casa", rol: "admin" };
  estado.uso = { data: { usadas: 3, limite: 40 }, error: null };
  estado.ia.mockReset().mockResolvedValue(ok);
  estado.rpc.mockReset().mockImplementation(async () => estado.uso);
});

describe("POST /api/ia/preguntar", () => {
  it("con sesión y hogar, cuenta el uso y devuelve la respuesta", async () => {
    const r = await pedir({
      pregunta: "¿Cuándo es el pediatra?",
      contexto: "## Citas\n- jueves: pediatra",
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ respuesta: ok, usadas: 3, limite: 40 });
    expect(estado.rpc).toHaveBeenCalledWith("usar_ia", { p_hogar_id: "h1" });
    expect(estado.ia).toHaveBeenCalledWith({
      hoy: "2026-11-17",
      pregunta: "¿Cuándo es el pediatra?",
      contexto: "## Citas\n- jueves: pediatra",
    });
  });

  it("rechaza lo vacío, lo muy largo o mal formado sin gastar nada", async () => {
    for (const cuerpo of [
      { pregunta: "", contexto: "x" },
      { pregunta: "ab", contexto: "x" },
      { pregunta: "x".repeat(301), contexto: "x" },
      { pregunta: "¿Qué hay hoy?", contexto: "x".repeat(24_001) },
      { otra: 1 },
    ]) {
      expect((await pedir(cuerpo)).status).toBeGreaterThanOrEqual(400);
    }
    expect((await pedir(null, "no es json")).status).toBe(400);
    expect(
      (await pedir(null, JSON.stringify({ pregunta: "¿Qué hay?", contexto: "a".repeat(60_000) })))
        .status,
    ).toBe(413);
    expect(estado.rpc).not.toHaveBeenCalled();
    expect(estado.ia).not.toHaveBeenCalled();
  });

  it("sin IA configurada, sin sesión, sin hogar o con el tope diario, no llama a la IA", async () => {
    const q = { pregunta: "¿Qué hay hoy?", contexto: "x" };
    estado.configurada = false;
    expect((await pedir(q)).status).toBe(503);
    estado.configurada = true;
    estado.usuario = null;
    expect((await pedir(q)).status).toBe(401);
    estado.usuario = { id: "u1" };
    estado.hogar = null;
    expect((await pedir(q)).status).toBe(403);
    estado.hogar = { id: "h1", nombre: "Casa", rol: "admin" };
    estado.uso = { data: null, error: { code: "53400" } };
    expect((await pedir(q)).status).toBe(429);
    expect(estado.ia).not.toHaveBeenCalled();
  });

  it("un fallo del proveedor no filtra detalles ni la pregunta", async () => {
    estado.ia.mockRejectedValue(new Error("secreto del proveedor: pasaporte"));
    const r = await pedir({ pregunta: "¿Cuándo caduca el pasaporte?", contexto: "x" });
    expect(r.status).toBe(502);
    const cuerpo = JSON.stringify(await r.json());
    expect(cuerpo).not.toContain("secreto");
    expect(cuerpo).not.toContain("pasaporte");
  });
});
