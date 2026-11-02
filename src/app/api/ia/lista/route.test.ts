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

vi.mock("@/infraestructura/ia/lista", () => ({
  iaConfigurada: () => estado.configurada,
  ordenarLista: estado.ia,
  IaNoConfigurada: class IaNoConfigurada extends Error {},
}));
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
    new Request("http://localhost/api/ia/lista", {
      method: "POST",
      body: crudo ?? JSON.stringify(cuerpo),
    }),
  );
const ok = { articulos: [{ nombre: "Leche", cantidad: "2", categoria: "lacteos" }] };

beforeEach(() => {
  estado.configurada = true;
  estado.usuario = { id: "u1" };
  estado.hogar = { id: "h1", nombre: "Casa", rol: "admin" };
  estado.uso = { data: { usadas: 3, limite: 40 }, error: null };
  estado.ia.mockReset().mockResolvedValue(ok);
  estado.rpc.mockReset().mockImplementation(async () => estado.uso);
});

describe("POST /api/ia/lista", () => {
  it("con sesión y hogar, cuenta el uso y devuelve los artículos propuestos", async () => {
    const r = await pedir({ texto: "2 leches", yaEnLista: ["Pan"] });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ...ok, usadas: 3, limite: 40 });
    expect(estado.rpc).toHaveBeenCalledWith("usar_ia", { p_hogar_id: "h1" });
    expect(estado.ia).toHaveBeenCalledWith({ texto: "2 leches", yaEnLista: ["Pan"] });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("rechaza peticiones mal formadas, vacías o demasiado largas sin gastar nada", async () => {
    for (const cuerpo of [{ texto: "" }, { texto: "x".repeat(1600) }, { otra: 1 }]) {
      expect((await pedir(cuerpo)).status).toBe(400);
    }
    expect((await pedir(null, "no es json")).status).toBe(400);
    expect((await pedir(null, JSON.stringify({ texto: "a".repeat(30_000) }))).status).toBe(413);
    expect(estado.rpc).not.toHaveBeenCalled();
    expect(estado.ia).not.toHaveBeenCalled();
  });

  it("sin clave de IA responde 503 sin contar uso ni llamar", async () => {
    estado.configurada = false;
    const r = await pedir({ texto: "leche" });
    expect(r.status).toBe(503);
    expect(estado.rpc).not.toHaveBeenCalled();
  });

  it("sin sesión (401) o sin hogar (403) no se llama a la IA", async () => {
    estado.usuario = null;
    expect((await pedir({ texto: "leche" })).status).toBe(401);
    estado.usuario = { id: "u1" };
    estado.hogar = null;
    expect((await pedir({ texto: "leche" })).status).toBe(403);
    expect(estado.ia).not.toHaveBeenCalled();
  });

  it("si el hogar llegó a su tope diario responde 429 y no llama a la IA", async () => {
    estado.uso = { data: null, error: { code: "53400" } };
    const r = await pedir({ texto: "leche" });
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "tope-diario" });
    expect(estado.ia).not.toHaveBeenCalled();
  });

  it("un fallo del proveedor no filtra detalles ni el texto", async () => {
    estado.ia.mockRejectedValue(new Error("secreto del proveedor: leche"));
    const r = await pedir({ texto: "leche" });
    expect(r.status).toBe(502);
    const cuerpo = JSON.stringify(await r.json());
    expect(cuerpo).not.toContain("secreto");
    expect(cuerpo).not.toContain("leche");
  });
});
