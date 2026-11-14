import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  comprobar: vi.fn(),
  leer: vi.fn(),
  guardar: vi.fn(),
  anotar: vi.fn(),
  ia: vi.fn(),
}));
vi.mock("@/infraestructura/avisos/claves", () => ({ comprobarSecretoDeAvisos: m.comprobar }));
vi.mock("@/infraestructura/calendario-suscrito", () => ({ hoyEnMadrid: () => "2026-12-01" }));
vi.mock("@/infraestructura/calendario-escolar", () => ({
  leerCalendariosEscolares: m.leer,
  guardarCalendarioEscolar: m.guardar,
  anotarComprobacion: m.anotar,
}));
vi.mock("@/infraestructura/ia/calendario-escolar", () => ({ leerCalendarioEscolar: m.ia }));

import { POST } from "./route";

const SECRETO = "b".repeat(64);
const pedir = (auth?: string, cuerpo?: unknown) =>
  POST(
    new Request("http://localhost/api/calendario-escolar/comprobar", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
      ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    }),
  );

beforeEach(() => {
  m.comprobar.mockReset().mockResolvedValue({ valido: true, claves: null });
  m.leer.mockReset().mockResolvedValue({ cursos: [], comprobadoEn: null, resultado: null });
  m.guardar.mockReset().mockResolvedValue("nuevo");
  m.anotar.mockReset().mockResolvedValue(undefined);
  m.ia.mockReset().mockResolvedValue(null);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("<p>Aún nada del curso siguiente</p>", { status: 200 })),
  );
});

describe("POST /api/calendario-escolar/comprobar (D-146)", () => {
  it("sin el secreto, o con uno que no vale, 401 y no hace nada", async () => {
    expect((await pedir()).status).toBe(401);
    expect((await pedir("Bearer corto")).status).toBe(401);
    m.comprobar.mockResolvedValue({ valido: false });
    expect((await pedir(`Bearer ${SECRETO}`)).status).toBe(401);
    expect(m.leer).not.toHaveBeenCalled();
    expect(m.anotar).not.toHaveBeenCalled();
  });

  it("con el secreto, mira el curso siguiente y apunta el resultado", async () => {
    const r = await pedir(`Bearer ${SECRETO}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      resultado: [{ anio: 2027, estado: "sin-publicar" }],
      resumen: "Curso 2027/2028: aún no publicado",
    });
    expect(m.anotar).toHaveBeenCalledWith(SECRETO, "Curso 2027/2028: aún no publicado");
    expect(m.guardar).not.toHaveBeenCalled();
  });

  it("la prueba con un curso revisado a mano nunca guarda", async () => {
    const r = await pedir(`Bearer ${SECRETO}`, { prueba: 2026 });
    expect(await r.json()).toEqual({ prueba: 2026, estado: "sin-publicar" });
    expect(m.guardar).not.toHaveBeenCalled();
    expect(m.anotar).not.toHaveBeenCalled();
    expect((await pedir(`Bearer ${SECRETO}`, { prueba: 2030 })).status).toBe(400);
  });
});
