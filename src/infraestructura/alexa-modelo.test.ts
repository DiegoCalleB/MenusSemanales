import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Funcion {
  name: string;
  samples: string[];
  slots?: { name: string }[];
}
const modelo = JSON.parse(
  readFileSync(new URL("../../alexa/modelo-es-ES.json", import.meta.url), "utf8"),
) as { interactionModel: { languageModel: { invocationName: string; intents: Funcion[] } } };
const { intents, invocationName } = modelo.interactionModel.languageModel;
const manejador = readFileSync(new URL("../app/api/alexa/manejar.ts", import.meta.url), "utf8");

describe("alexa: el modelo de voz de Conchi", () => {
  it("se llama Conchi y tiene las funciones de siempre de Amazon", () => {
    expect(invocationName).toBe("conchi");
    const nombres = intents.map((i) => i.name);
    for (const n of [
      "AMAZON.HelpIntent",
      "AMAZON.StopIntent",
      "AMAZON.CancelIntent",
      "AMAZON.FallbackIntent",
      "AMAZON.YesIntent",
      "AMAZON.NoIntent",
    ]) {
      expect(nombres).toContain(n);
    }
  });

  it("cada función propia la atiende el servidor, y al revés", () => {
    for (const i of intents.filter((x) => !x.name.startsWith("AMAZON."))) {
      expect(manejador, i.name).toContain(`"${i.name}"`);
    }
    const atendidas = [...manejador.matchAll(/case "([A-Za-z]+Intent)"/g)].map((m) => m[1]);
    const delModelo = intents.map((i) => i.name);
    for (const a of atendidas) expect(delModelo, a).toContain(a);
  });

  it("las frases con un dato lo llevan, y ninguna frase está en dos funciones", () => {
    for (const i of intents) {
      const dato = i.slots?.[0]?.name;
      for (const s of i.samples) {
        if (dato) expect(s, `${i.name}: ${s}`).toContain(`{${dato}}`);
        else expect(s, `${i.name}: ${s}`).not.toContain("{");
      }
    }
    const todas = intents.flatMap((i) => i.samples.map((s) => s.toLowerCase()));
    expect(new Set(todas).size).toBe(todas.length);
  });
});
