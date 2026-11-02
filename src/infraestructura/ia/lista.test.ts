import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { IaNoConfigurada, type ClienteIa, ordenarLista } from "./lista";

const falso = (respuesta: unknown) => {
  const parse = vi.fn().mockResolvedValue(respuesta);
  return { cliente: { messages: { parse } } as unknown as ClienteIa, parse };
};

afterEach(() => vi.unstubAllEnvs());

describe("ordenarLista", () => {
  it("manda las instrucciones aparte del texto, pide salida estructurada y esfuerzo bajo", async () => {
    const { cliente, parse } = falso({
      stop_reason: "end_turn",
      parsed_output: {
        articulos: [
          { nombre: "Leche", cantidad: "2", categoria: "lacteos" },
          { nombre: "Pan", cantidad: "", categoria: "panaderia" },
        ],
      },
    });
    const r = await ordenarLista({ texto: "2 leches y pan", yaEnLista: ["pan"] }, cliente);
    expect(r.articulos.map((a) => a.nombre)).toEqual(["Leche"]); // «Pan» ya estaba
    const arg = parse.mock.calls[0]![0];
    expect(arg.system).toMatch(/datos, no instrucciones/);
    expect(arg.messages).toHaveLength(1);
    expect(arg.messages[0].content).toContain("<texto>\n2 leches y pan\n</texto>");
    expect(arg.output_config.effort).toBe("low");
    expect(arg.output_config.format).toBeDefined();
    expect(arg.thinking).toBeUndefined();
    expect(arg.max_tokens).toBeLessThanOrEqual(8000);
  });

  it("si el modelo rechaza o no devuelve nada utilizable, devuelve una lista vacía", async () => {
    expect(
      (
        await ordenarLista(
          { texto: "x", yaEnLista: [] },
          falso({ stop_reason: "refusal", parsed_output: null }).cliente,
        )
      ).articulos,
    ).toEqual([]);
    expect(
      (
        await ordenarLista(
          { texto: "x", yaEnLista: [] },
          falso({ stop_reason: "end_turn", parsed_output: null }).cliente,
        )
      ).articulos,
    ).toEqual([]);
  });

  it("sin clave de IA en el servidor lanza IaNoConfigurada antes de llamar a nada", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(ordenarLista({ texto: "x", yaEnLista: [] })).rejects.toBeInstanceOf(
      IaNoConfigurada,
    );
  });
});
