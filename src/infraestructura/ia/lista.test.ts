import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IaNoConfigurada, cuerpoDePeticion, ordenarLista } from "./lista";

const respuesta = (cuerpo: unknown, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status }));
const conTexto = (texto: string, extra: object = {}) => ({
  candidates: [{ finishReason: "STOP", content: { parts: [{ text: texto }] }, ...extra }],
});

beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba"));
afterEach(() => vi.unstubAllEnvs());

describe("cuerpoDePeticion", () => {
  it("separa instrucciones y texto, y pide JSON con esquema y temperatura baja", () => {
    const c = cuerpoDePeticion({ texto: "2 leches", yaEnLista: ["Pan"] });
    expect(c.systemInstruction.parts[0]!.text).toMatch(/datos, no instrucciones/);
    expect(c.contents).toHaveLength(1);
    expect(c.contents[0]!.parts[0]!.text).toContain("<texto>\n2 leches\n</texto>");
    expect(c.generationConfig.responseMimeType).toBe("application/json");
    expect(
      c.generationConfig.responseSchema.properties.articulos.items.properties.categoria.enum,
    ).toContain("lacteos");
    expect(c.generationConfig.temperature).toBeLessThanOrEqual(0.3);
  });
});

describe("ordenarLista", () => {
  it("llama con la clave en la cabecera (no en la URL) y devuelve lo propuesto sin lo ya apuntado", async () => {
    const llamar = respuesta(
      conTexto(
        JSON.stringify({
          articulos: [
            { nombre: "Leche", cantidad: "2", categoria: "lacteos" },
            { nombre: "Pan", cantidad: "", categoria: "panaderia" },
          ],
        }),
      ),
    );
    const r = await ordenarLista({ texto: "2 leches y pan", yaEnLista: ["pan"] }, llamar as never);
    expect(r.articulos.map((a) => a.nombre)).toEqual(["Leche"]);
    const [url, init] = llamar.mock.calls[0]!;
    expect(String(url)).toContain("generativelanguage.googleapis.com");
    expect(String(url)).toContain(":generateContent");
    expect(String(url)).not.toContain("clave-de-prueba");
    expect(init.headers["x-goog-api-key"]).toBe("clave-de-prueba");
    expect(init.method).toBe("POST");
  });

  it("una respuesta bloqueada, vacía, rota o con otra forma da una lista vacía, sin lanzar", async () => {
    for (const cuerpo of [
      conTexto("", {}),
      conTexto("no es json"),
      conTexto(
        JSON.stringify({ articulos: [{ nombre: "X", cantidad: "", categoria: "inventada" }] }),
      ),
      { candidates: [{ finishReason: "SAFETY" }] },
      {},
    ]) {
      expect(
        (await ordenarLista({ texto: "x", yaEnLista: [] }, respuesta(cuerpo) as never)).articulos,
      ).toEqual([]);
    }
  });

  it("un error HTTP del proveedor lanza (la ruta lo traduce a un 502 sin detalles)", async () => {
    await expect(
      ordenarLista({ texto: "x", yaEnLista: [] }, respuesta({ error: "cuota" }, 429) as never),
    ).rejects.toThrow("ia-http-429");
  });

  it("sin clave en el servidor lanza IaNoConfigurada antes de llamar a nada", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const llamar = vi.fn();
    await expect(
      ordenarLista({ texto: "x", yaEnLista: [] }, llamar as never),
    ).rejects.toBeInstanceOf(IaNoConfigurada);
    expect(llamar).not.toHaveBeenCalled();
  });
});
