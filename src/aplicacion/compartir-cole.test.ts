import { describe, expect, it } from "vitest";
import { estadoInicialDemo } from "./datos-demo";
import { coleParaCompartir, planParaCompartir } from "./compartir";

describe("coleParaCompartir", () => {
  const cole = {
    primero: "legumbre" as const,
    segundo: "pescado" as const,
    textoPrimero: "Lentejas estofadas",
    textoSegundo: "Merluza al horno",
  };

  it("cuenta lo que comieron con las palabras del cole y por qué esa cena, según el día", () => {
    const futuro = coleParaCompartir(cole, "2026-11-10", "2026-11-04", ["Pollo con patatas"]);
    expect(futuro.coleTexto).toBe("Lentejas estofadas + Merluza al horno");
    expect(futuro.porque).toBe(
      "Como en el cole comerán legumbres y pescado, propongo de cena Pollo con patatas",
    );
    expect(coleParaCompartir(cole, "2026-11-04", "2026-11-04", ["X"]).porque).toContain("comen ");
    expect(coleParaCompartir(cole, "2026-11-01", "2026-11-04", ["X"]).porque).toContain("comieron");
  });

  it("no inventa nada: sin cena no hay porqué; sin textos no hay línea de cole", () => {
    expect(coleParaCompartir(cole, "2026-11-10", "2026-11-04", []).porque).toBeUndefined();
    const sinTextos = coleParaCompartir(
      { primero: "arroz", segundo: null },
      "2026-11-10",
      "2026-11-04",
      ["Ensalada"],
    );
    expect(sinTextos.coleTexto).toBeUndefined();
    expect(sinTextos.porque).toContain("arroz");
    expect(
      coleParaCompartir({ primero: "otro", segundo: null }, "2026-11-10", "2026-11-04", ["X"]),
    ).toEqual({});
  });

  it("con datos reales: los días con cole y cena llevan las dos cosas", () => {
    const e = estadoInicialDemo();
    const dias = planParaCompartir(e).dias;
    const conPorque = dias.filter((d) => d.porque);
    expect(conPorque.length).toBeGreaterThan(0);
    for (const d of conPorque) expect(d.platos.length).toBeGreaterThan(0);
  });
});
