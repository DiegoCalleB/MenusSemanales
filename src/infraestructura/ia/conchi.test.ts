import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { contestarPregunta, cuerpoDeFrase, cuerpoDePregunta, leerFrase } from "./conchi";

const conTexto = (texto: string) => ({
  candidates: [{ finishReason: "STOP", content: { parts: [{ text: texto }] } }],
});
const respuesta = (cuerpo: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status: 200 }));

const ENTRADA = {
  hoy: "2026-11-27",
  hora: "10:15",
  texto: "recuérdame a las seis sacar la basura",
  personas: ["Diego"],
};

beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "clave"));
afterEach(() => vi.unstubAllEnvs());

describe("leerFrase (D-216)", () => {
  it("pide la fecha, la hora actual y las personas, sin pensar mucho", () => {
    const c = cuerpoDeFrase(ENTRADA);
    const texto = c.contents[0]!.parts[0]!.text;
    expect(texto).toContain("viernes 2026-11-27");
    expect(texto).toContain("las 10:15");
    expect(texto).toContain("Diego");
    expect(c.generationConfig.temperature).toBe(0);
  });

  it("devuelve lo entendido, limpio", async () => {
    const llamar = respuesta(
      conTexto(
        JSON.stringify({
          items: [
            {
              tipo: "recordatorio",
              titulo: "sacar la basura",
              fecha: "",
              hora: "06:00",
              ambigua: true,
            },
            {
              tipo: "cita",
              titulo: "dentista",
              fecha: "2026-12-03",
              hora: "17:00",
              ambigua: false,
            },
            { tipo: "cita", titulo: "sin día", fecha: "", hora: "", ambigua: false },
          ],
        }),
      ),
    );
    const items = await leerFrase(ENTRADA, llamar as unknown as typeof fetch);
    expect(items).toEqual([
      {
        tipo: "recordatorio",
        titulo: "sacar la basura",
        fecha: null,
        hora: "06:00",
        ambigua: true,
      },
      { tipo: "cita", titulo: "dentista", fecha: "2026-12-03", hora: "17:00", ambigua: false },
      { tipo: "pendiente", titulo: "sin día", fecha: null, hora: null, ambigua: false },
    ]);
  });

  it("si la IA contesta basura, nada; sin clave, lanza", async () => {
    expect(
      await leerFrase(ENTRADA, respuesta(conTexto("no es json")) as unknown as typeof fetch),
    ).toEqual([]);
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(leerFrase(ENTRADA, respuesta({}) as unknown as typeof fetch)).rejects.toThrow();
  });
});

describe("contestarPregunta (D-216)", () => {
  const P = {
    hoy: "2026-11-27",
    pregunta: "fue la última vez que cambiamos las sábanas",
    datos: "Sábanas: última vez 2026-11-14",
  };

  it("lleva la pregunta y los datos entre marcas", () => {
    const c = cuerpoDePregunta(P);
    const texto = c.contents[0]!.parts[0]!.text;
    expect(texto).toContain("<datos>\nSábanas: última vez 2026-11-14\n</datos>");
    expect(texto).toContain("<pregunta>\nfue la última vez");
  });

  it("deja la respuesta hablable: sin markdown, emojis ni saltos", async () => {
    const llamar = respuesta(conTexto("**Fue el sábado 14 de noviembre** 🛏️.\n\nHace 13 días."));
    expect(await contestarPregunta(P, llamar as unknown as typeof fetch)).toBe(
      "Fue el sábado 14 de noviembre. Hace 13 días.",
    );
  });

  it("sin respuesta, null", async () => {
    expect(
      await contestarPregunta(P, respuesta(conTexto("  ")) as unknown as typeof fetch),
    ).toBeNull();
  });
});
