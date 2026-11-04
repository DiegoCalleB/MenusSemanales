import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  acceso: { ok: true, usadas: 3, limite: 40 } as
    { ok: true; usadas: number; limite: number } | { ok: false; respuesta: Response },
  proponer: vi.fn(),
  circular: vi.fn(),
}));
vi.mock("@/infraestructura/ia/acceso", () => ({
  comprobarAccesoIa: async () => m.acceso,
  motivoDeError: (e: unknown) =>
    e instanceof Error && /^ia-http-\d{3}$/.test(e.message) ? e.message : "ia-red",
  responderIa: (cuerpo: unknown, status: number) =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));
vi.mock("@/infraestructura/ia/plato", () => ({ proponerPlato: m.proponer }));
vi.mock("@/infraestructura/ia/circular", () => ({ leerCircular: m.circular }));
vi.mock("@/infraestructura/ia/lista", () => ({
  IaNoConfigurada: class IaNoConfigurada extends Error {},
}));
vi.mock("@/infraestructura/calendario-suscrito", () => ({ hoyEnMadrid: () => "2026-11-04" }));

import { POST as circular } from "./circular/route";
import { POST as plato } from "./plato/route";

const json = (cuerpo: unknown) =>
  plato(
    new Request("http://localhost/api/ia/plato", {
      method: "POST",
      body: JSON.stringify(cuerpo),
      headers: { "content-type": "application/json" },
    }),
  );
const form = (campos: Record<string, string | File>) => {
  const d = new FormData();
  for (const [k, v] of Object.entries(campos)) d.append(k, v);
  return circular(new Request("http://localhost/api/ia/circular", { method: "POST", body: d }));
};
const pdf = (n = 100) => new File([new Uint8Array(n)], "c.pdf", { type: "application/pdf" });

beforeEach(() => {
  m.acceso = { ok: true, usadas: 3, limite: 40 };
  m.proponer.mockReset().mockResolvedValue({
    grupo: "carne",
    minutosActivos: 20,
    ligero: false,
    pasos: "",
    ingredientes: [],
  });
  m.circular.mockReset().mockResolvedValue({ items: [], pasados: 0 });
});

describe("POST /api/ia/plato", () => {
  it("con una petición válida devuelve la propuesta y el uso", async () => {
    const r = await json({ nombre: "Pollo empanado", catalogo: [] });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ usadas: 3, limite: 40 });
  });
  it("rechaza lo mal formado sin gastar nada", async () => {
    expect((await json({ nombre: "x" })).status).toBe(400);
    expect(m.proponer).not.toHaveBeenCalled();
  });
  it("sin acceso (sin sesión o tope), no llama a la IA", async () => {
    m.acceso = { ok: false, respuesta: new Response("{}", { status: 429 }) };
    expect((await json({ nombre: "Pollo empanado" })).status).toBe(429);
    expect(m.proponer).not.toHaveBeenCalled();
  });
  it("un fallo del proveedor da 502 con un código corto y sin detalles", async () => {
    m.proponer.mockRejectedValue(new Error("ia-http-503"));
    const r = await json({ nombre: "Pollo empanado" });
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "no-disponible", motivo: "ia-http-503" });
  });
});

describe("POST /api/ia/circular", () => {
  it("lee un archivo con la fecha de hoy", async () => {
    const r = await form({ archivo: pdf() });
    expect(r.status).toBe(200);
    expect(m.circular.mock.calls[0]?.[0]).toMatchObject({
      hoy: "2026-11-04",
      archivo: { mime: "application/pdf" },
    });
  });
  it("lee un texto pegado", async () => {
    expect((await form({ texto: "Excursión el 17 de noviembre" })).status).toBe(200);
    expect(m.circular.mock.calls[0]?.[0]).toMatchObject({ texto: "Excursión el 17 de noviembre" });
  });
  it("rechaza archivos grandes, de otro tipo o una petición vacía", async () => {
    expect((await form({ archivo: pdf(9 * 1024 * 1024) })).status).toBe(413);
    expect(
      (await form({ archivo: new File(["x"], "a.exe", { type: "application/x-msdownload" }) }))
        .status,
    ).toBe(415);
    expect((await form({ texto: "ab" })).status).toBe(400);
    expect(m.circular).not.toHaveBeenCalled();
  });
  it("sin acceso no llama a la IA y un fallo no filtra detalles", async () => {
    m.circular.mockRejectedValue(new Error("secreto del proveedor"));
    const r = await form({ texto: "Excursión el 17 de noviembre" });
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toContain("secreto");
    m.circular.mockClear();
    m.acceso = { ok: false, respuesta: new Response("{}", { status: 401 }) };
    expect((await form({ texto: "Excursión el 17 de noviembre" })).status).toBe(401);
    expect(m.circular).not.toHaveBeenCalled();
  });
});
