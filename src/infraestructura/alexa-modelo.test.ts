import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("alexa: el modelo de voz", () => {
  const modelo = JSON.parse(
    readFileSync(new URL("../../alexa/modelo-es-ES.json", import.meta.url), "utf8"),
  ) as {
    interactionModel: {
      languageModel: {
        invocationName: string;
        intents: { name: string; samples: string[]; slots?: { name: string }[] }[];
      };
    };
  };
  const { intents, invocationName } = modelo.interactionModel.languageModel;

  it("tiene las tres cosas y las de siempre de Amazon", () => {
    const nombres = intents.map((i) => i.name);
    for (const n of [
      "AnadirCompraIntent",
      "CenaIntent",
      "HoyIntent",
      "AMAZON.HelpIntent",
      "AMAZON.StopIntent",
      "AMAZON.CancelIntent",
      "AMAZON.FallbackIntent",
    ]) {
      expect(nombres).toContain(n);
    }
    expect(invocationName).toBe("hecho");
  });

  it("todo lo que dice «añade» lleva el producto, y los nombres coinciden con la ruta", () => {
    const anadir = intents.find((i) => i.name === "AnadirCompraIntent");
    expect(anadir?.slots?.[0]?.name).toBe("producto");
    expect(anadir?.samples.length).toBeGreaterThan(3);
    for (const s of anadir?.samples ?? []) expect(s).toContain("{producto}");
    const route = readFileSync(new URL("../app/api/alexa/manejar.ts", import.meta.url), "utf8");
    for (const n of ["AnadirCompraIntent", "CenaIntent", "HoyIntent"])
      expect(route).toContain(`"${n}"`);
  });
});
