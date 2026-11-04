import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { cuerpoDeCircular, leerCircular } from "./circular";
import { IaNoConfigurada } from "./lista";
import { cuerpoDePlato, proponerPlato } from "./plato";

const gemini = (texto: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: typeof texto === "string" ? texto : JSON.stringify(texto) }] },
        },
      ],
    }),
    { status: 200 },
  );

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("GEMINI_API_KEY", "clave-de-prueba");
});

const propuesta = {
  grupo: "carne",
  minutosActivos: 25,
  ligero: false,
  pasos: "Empana el pollo y fríelo.",
  ingredientes: [
    { nombre: "Pechuga de pollo", cantidad: 150, unidad: "g", seccion: "carne", opcional: false },
  ],
};

describe("proponerPlato", () => {
  it("sin clave lanza IaNoConfigurada", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(proponerPlato({ nombre: "Pollo", catalogo: [] }, vi.fn())).rejects.toBeInstanceOf(
      IaNoConfigurada,
    );
  });

  it("pide JSON estructurado con las instrucciones aparte y el nombre como dato", () => {
    const c = cuerpoDePlato({
      nombre: "Pollo empanado",
      catalogo: [{ nombre: "Huevos", unidad: "ud" }],
    });
    expect(c.systemInstruction.parts[0]?.text).toContain("POR RACIÓN DE UN ADULTO");
    expect(c.contents[0]?.parts[0]?.text).toContain("<plato>\nPollo empanado\n</plato>");
    expect(c.generationConfig.responseMimeType).toBe("application/json");
    expect(
      "thinkingConfig" in cuerpoDePlato({ nombre: "x", catalogo: [] }, false).generationConfig,
    ).toBe(false);
  });

  it("devuelve la propuesta válida", async () => {
    const f = vi.fn().mockResolvedValue(gemini(propuesta));
    expect(await proponerPlato({ nombre: "Pollo empanado", catalogo: [] }, f)).toMatchObject({
      minutosActivos: 25,
    });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("clave-de-prueba");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("clave-de-prueba");
  });

  it("una respuesta que no cumple el esquema o no es JSON da null", async () => {
    expect(
      await proponerPlato(
        { nombre: "Pollo", catalogo: [] },
        vi.fn().mockResolvedValue(gemini({ ...propuesta, ingredientes: [] })),
      ),
    ).toBeNull();
    expect(
      await proponerPlato(
        { nombre: "Pollo", catalogo: [] },
        vi.fn().mockResolvedValue(gemini("no es json")),
      ),
    ).toBeNull();
  });
});

describe("leerCircular", () => {
  it("con archivo manda el archivo y la fecha de hoy; con texto, el texto", () => {
    const a = cuerpoDeCircular({
      hoy: "2026-11-04",
      archivo: { mime: "image/jpeg", base64: "QUJD" },
    });
    expect(a.contents[0]?.parts[0]).toEqual({
      inlineData: { mimeType: "image/jpeg", data: "QUJD" },
    });
    expect(JSON.stringify(a.contents[0]?.parts[1])).toContain("Hoy es 2026-11-04");
    const t = cuerpoDeCircular({ hoy: "2026-11-04", texto: "Excursión el 17" });
    expect(JSON.stringify(t.contents[0]?.parts)).toContain("Excursión el 17");
  });

  it("devuelve citas y tareas depuradas, y quita lo que ya pasó", async () => {
    const f = vi.fn().mockResolvedValue(
      gemini({
        items: [
          { tipo: "cita", titulo: "Excursión", fecha: "2026-11-20", hasta: "", hora: "09:00" },
          { tipo: "cita", titulo: "Ayer", fecha: "2026-11-01", hasta: "", hora: "" },
          { tipo: "tarea", titulo: "Firmar", fecha: "", hasta: "", hora: "" },
        ],
      }),
    );
    const r = await leerCircular({ hoy: "2026-11-04", texto: "texto" }, f);
    expect(r.pasados).toBe(1);
    expect(r.items.map((i) => i.titulo)).toEqual(["Excursión", "Firmar"]);
  });

  it("si la respuesta es inválida, lista vacía (no un error)", async () => {
    const r = await leerCircular(
      { hoy: "2026-11-04", texto: "t" },
      vi.fn().mockResolvedValue(gemini("basura")),
    );
    expect(r).toEqual({ items: [], pasados: 0 });
  });
});
