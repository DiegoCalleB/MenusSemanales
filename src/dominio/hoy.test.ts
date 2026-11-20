import { describe, expect, it } from "vitest";
import { TARJETAS, limpiarAjuste, mover, ocultasDe, ordenDe } from "./hoy";

const IDS = TARJETAS.map((t) => t.id);

describe("Hoy a tu manera (D-196)", () => {
  it("sin ajuste, el orden de siempre y nada oculto", () => {
    expect(ordenDe(null)).toEqual(IDS);
    expect(ocultasDe(null).size).toBe(0);
  });
  it("lo elegido va primero y lo que falta se añade detrás; lo desconocido y repetido se descarta", () => {
    const o = ordenDe({
      personaId: "a",
      orden: ["compra", "nada", "mi-dia", "compra"],
      ocultas: [],
    });
    expect(o.slice(0, 2)).toEqual(["compra", "mi-dia"]);
    expect(o).toHaveLength(IDS.length);
    expect(new Set(o).size).toBe(IDS.length);
  });
  it("la cena no se puede ocultar", () => {
    const a = limpiarAjuste("a", IDS, ["cena", "cole", "inventada"]);
    expect(a.ocultas).toEqual(["cole"]);
  });
  it("sube y baja un puesto, sin salirse", () => {
    expect(mover(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(mover(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(mover(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(mover(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});
