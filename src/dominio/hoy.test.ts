import { describe, expect, it } from "vitest";
import { TARJETAS, aLaVista, limpiarAjuste, mover, ocultasDe, ordenDe } from "./hoy";

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
  it("modo simple: la cena y 4 del momento; sin hora o con ajuste, se ve todo", () => {
    expect([...(aLaVista(null, "tarde") ?? [])]).toEqual([
      "cena",
      "citas",
      "pendientes",
      "casa",
      "compra",
    ]);
    expect(aLaVista(null, "manana")?.has("mi-dia")).toBe(true);
    expect(aLaVista(null, null)).toBeNull();
    expect(aLaVista({ personaId: "a", orden: [], ocultas: [] }, "tarde")).toBeNull();
  });
});
