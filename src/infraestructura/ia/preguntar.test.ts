import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cuerpoDePreguntar, preguntarALaCasa } from "./preguntar";

const conTexto = (texto: string) => ({
  candidates: [{ finishReason: "STOP", content: { parts: [{ text: texto }] } }],
});
const respuesta = (cuerpo: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status: 200 }));
const E = {
  hoy: "2026-11-17",
  pregunta: "¿Cuándo es el pediatra?",
  contexto: "## Citas\n- jueves 19: pediatra",
};

beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "clave"));
afterEach(() => vi.unstubAllEnvs());

describe("preguntarALaCasa (D-179)", () => {
  it("manda el día de la semana de hoy, los datos y la pregunta", () => {
    const c = cuerpoDePreguntar(E);
    const texto = c.contents[0]!.parts[0]!.text;
    expect(texto).toContain("martes 2026-11-17");
    expect(texto).toContain("pediatra");
    expect(texto).toContain("¿Cuándo es el pediatra?");
  });
  it("devuelve la respuesta recortada y limpia", async () => {
    const r = await preguntarALaCasa(
      E,
      respuesta(conTexto(JSON.stringify({ respuesta: "  El jueves 19.  " }))) as never,
    );
    expect(r).toBe("El jueves 19.");
  });
  it("si la respuesta no vale, devuelve vacío en vez de romperse", async () => {
    expect(await preguntarALaCasa(E, respuesta(conTexto("no es json")) as never)).toBe("");
    expect(await preguntarALaCasa(E, respuesta({ candidates: [] }) as never)).toBe("");
    expect(
      await preguntarALaCasa(E, respuesta(conTexto(JSON.stringify({ respuesta: 3 }))) as never),
    ).toBe("");
  });
  it("sin clave, avisa", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(preguntarALaCasa(E, respuesta(conTexto("{}")) as never)).rejects.toThrow();
  });
});
