import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cuerpoDeCaptura, leerCaptura } from "./captura";

const conTexto = (texto: string) => ({
  candidates: [{ finishReason: "STOP", content: { parts: [{ text: texto }] } }],
});
const respuesta = (cuerpo: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status: 200 }));
const ITEM = {
  tipo: "evento",
  titulo: "Pediatra de Alba",
  fecha: "2026-11-19",
  hasta: "",
  hora: "18:00",
  persona: "Alba",
  importante: false,
  repiteMeses: 0,
  categoria: "otro",
};
const ENTRADA = {
  hoy: "2026-11-17",
  texto: "el jueves a las 18 pediatra de Alba",
  personas: ["Alba"],
};

beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "clave"));
afterEach(() => vi.unstubAllEnvs());

describe("leerCaptura (D-178)", () => {
  it("pide el día de la semana de hoy y las personas, sin gastar pensamiento", () => {
    const c = cuerpoDeCaptura(ENTRADA);
    const texto = c.contents[0]!.parts[0]!.text;
    expect(texto).toContain("martes 2026-11-17");
    expect(texto).toContain("Alba");
    expect(c.generationConfig.temperature).toBe(0);
  });

  it("devuelve lo repartido y limpio", async () => {
    const r = await leerCaptura(
      ENTRADA,
      respuesta(conTexto(JSON.stringify({ items: [ITEM] }))) as never,
    );
    expect(r.items).toEqual([
      expect.objectContaining({
        tipo: "evento",
        titulo: "Pediatra de Alba",
        fecha: "2026-11-19",
        hora: "18:00",
        persona: "Alba",
      }),
    ]);
  });

  it("si la respuesta no vale, no propone nada en vez de romperse", async () => {
    expect((await leerCaptura(ENTRADA, respuesta(conTexto("no es json")) as never)).items).toEqual(
      [],
    );
    expect(
      (
        await leerCaptura(
          ENTRADA,
          respuesta(conTexto(JSON.stringify({ items: [{ tipo: "x" }] }))) as never,
        )
      ).items,
    ).toEqual([]);
    expect((await leerCaptura(ENTRADA, respuesta({ candidates: [] }) as never)).items).toEqual([]);
  });

  it("sin clave, avisa", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(leerCaptura(ENTRADA, respuesta(conTexto("{}")) as never)).rejects.toThrow();
  });
});
