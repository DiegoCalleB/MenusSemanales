import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cuerpoCalendarioEscolar, leerCalendarioEscolar } from "./calendario-escolar";

const respuesta = (cuerpo: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status: 200 }));
const conTexto = (texto: string, finishReason = "STOP") => ({
  candidates: [{ finishReason, content: { parts: [{ text: texto }] } }],
});
const LEIDO = {
  inicio: "2026-09-07",
  fin: "2027-06-18",
  periodos: [{ desde: "2026-12-23", hasta: "2027-01-06", motivo: "Vacaciones de Navidad" }],
  dias: [{ fecha: "2026-10-12", motivo: "Fiesta Nacional de España" }],
};

beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba"));
afterEach(() => vi.unstubAllEnvs());

describe("leerCalendarioEscolar (D-146)", () => {
  it("deja sitio para pensar y responder (si no, la respuesta sale cortada)", () => {
    const c = cuerpoCalendarioEscolar(2026, ["QUJD"]);
    expect(c.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(32_000);
  });

  it("lee lo pedido; un motivo largo se recorta en vez de tirar la lectura", async () => {
    const largo = { ...LEIDO, dias: [{ fecha: "2026-10-12", motivo: "x".repeat(200) }] };
    const r = await leerCalendarioEscolar(
      2026,
      ["QUJD"],
      respuesta(conTexto(JSON.stringify(largo))) as never,
    );
    expect(r?.inicio).toBe("2026-09-07");
    expect(r?.dias[0]?.motivo.length).toBe(120);
  });

  it("si no vale, dice por qué: cortada, JSON roto o forma distinta", async () => {
    const motivos: string[] = [];
    const porQue = (m: string) => motivos.push(m);
    const cortada = JSON.stringify(LEIDO).slice(0, 40);
    expect(
      await leerCalendarioEscolar(
        2026,
        ["QUJD"],
        respuesta(conTexto(cortada, "MAX_TOKENS")) as never,
        porQue,
      ),
    ).toBeNull();
    expect(
      await leerCalendarioEscolar(
        2026,
        ["QUJD"],
        respuesta({ candidates: [{ finishReason: "MAX_TOKENS" }] }) as never,
        porQue,
      ),
    ).toBeNull();
    expect(
      await leerCalendarioEscolar(
        2026,
        ["QUJD"],
        respuesta(conTexto(JSON.stringify({ ...LEIDO, inicio: "7/9/2026" }))) as never,
        porQue,
      ),
    ).toBeNull();
    expect(motivos).toEqual([
      "json (MAX_TOKENS, 40 caracteres)",
      "sin-texto (MAX_TOKENS)",
      expect.stringMatching(/^esquema: inicio /),
    ]);
  });
});
