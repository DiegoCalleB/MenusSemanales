import { describe, expect, it } from "vitest";
import { dejarPreparadoDe, fraseDeHoy } from "./frase-hoy";

const base = { hoy: "2026-11-04", cumples: [], citas: [], dejarPreparado: [], casa: 0, cena: [] };

describe("hoy en una frase (D-190)", () => {
  it("un día tranquilo dice solo la cena", () => {
    expect(fraseDeHoy({ ...base, cena: ["Pollo"] })).toBe("Miércoles 4: cena de Pollo.");
    expect(fraseDeHoy(base)).toBe("Miércoles 4: aún falta elegir la cena.");
  });

  it("junta lo importante por orden y no pasa de cuatro cosas", () => {
    const f = fraseDeHoy({
      ...base,
      cumples: ["Ana"],
      citas: [{ titulo: "pediatra de Alba", hora: "17:00" }],
      dejarPreparado: ["flauta de Emma"],
      casa: 2,
      cena: ["Pollo"],
    });
    expect(f).toBe(
      "Miércoles 4: es el cumple de Ana, tienes pediatra de Alba a las 17:00, hay que dejar preparado flauta de Emma y en casa tocan 2 cosas.",
    );
  });

  it("saca lo que hay que dejar preparado de los avisos", () => {
    expect(
      dejarPreparadoDe([
        {
          id: "mochila-x",
          emoji: "🎒",
          titulo: "Deja preparado: Flauta de Emma (para mañana)",
          nivel: "ya",
        },
        { id: "cena-hoy", emoji: "🍝", titulo: "Cena: Pollo", nivel: "info" },
      ]),
    ).toEqual(["flauta de Emma"]);
  });
});
