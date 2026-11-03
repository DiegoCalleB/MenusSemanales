import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IaNoConfigurada } from "./lista";
import { cuerpoDeTranscripcion, transcribirMenuCole } from "./cole";

const respuesta = (cuerpo: unknown, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status }));
const conTexto = (texto: string) => ({
  candidates: [{ finishReason: "STOP", content: { parts: [{ text: texto }] } }],
});
const archivo = { mime: "application/pdf" as const, base64: "QUJD" };

beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba"));
afterEach(() => vi.unstubAllEnvs());

describe("transcribirMenuCole", () => {
  it("envía el archivo en la petición (con la clave en la cabecera) y devuelve el texto limpio", async () => {
    const llamar = respuesta(
      conTexto(JSON.stringify({ texto: "MENÚ Noviembre 2026\r\n3\r\nLentejas\r\n\r\n\r\n\r\n4" })),
    );
    const t = await transcribirMenuCole(archivo, llamar as never);
    expect(t).toBe("MENÚ Noviembre 2026\n3\nLentejas\n\n4");
    const [url, init] = llamar.mock.calls[0]!;
    expect(String(url)).not.toContain("clave-de-prueba");
    expect(init.headers["x-goog-api-key"]).toBe("clave-de-prueba");
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo.contents[0].parts[0].inlineData).toEqual({
      mimeType: "application/pdf",
      data: "QUJD",
    });
    expect(cuerpo.generationConfig.temperature).toBe(0);
    expect(cuerpo.systemInstruction.parts[0].text).toMatch(/transcriptor/);
  });

  it("una respuesta vacía, bloqueada o rota da texto vacío; un error HTTP lanza", async () => {
    for (const c of [
      {},
      { candidates: [{ finishReason: "SAFETY" }] },
      conTexto("no es json"),
      conTexto(JSON.stringify({ texto: 5 })),
    ]) {
      expect(await transcribirMenuCole(archivo, respuesta(c) as never)).toBe("");
    }
    await expect(transcribirMenuCole(archivo, respuesta({}, 500) as never)).rejects.toThrow(
      "ia-http-500",
    );
  });

  it("sin clave lanza IaNoConfigurada sin llamar a nada", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const llamar = vi.fn();
    await expect(transcribirMenuCole(archivo, llamar as never)).rejects.toBeInstanceOf(
      IaNoConfigurada,
    );
    expect(llamar).not.toHaveBeenCalled();
    expect(cuerpoDeTranscripcion(archivo).contents).toHaveLength(1);
  });
});
