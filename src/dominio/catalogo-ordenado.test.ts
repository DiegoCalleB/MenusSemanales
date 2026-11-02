import { describe, expect, it } from "vitest";
import { type DiaMenu, type PlatoMenu, ordenarCatalogo } from "./menu";

const plato = (
  id: string,
  grupo: PlatoMenu["grupo"],
  extra: Partial<PlatoMenu> = {},
): PlatoMenu => ({
  id,
  nombre: id,
  grupo,
  minutosActivos: 15,
  ultimaVez: null,
  valoracion: null,
  ingredientes: [{ ingredienteId: `i-${id}`, cantidadPorRacion: 100, opcional: false }],
  ...extra,
});
const dia = (extra: Partial<DiaMenu> = {}): DiaMenu => ({
  fecha: "2026-11-04",
  minutosMax: 30,
  cole: { primero: "verdura", segundo: "carne" },
  ...extra,
});
const catalogo = [
  plato("pollo", "carne"),
  plato("salmon", "pescado"),
  plato("tortilla", "huevo"),
  plato("pasta", "pasta"),
  plato("crema", "verdura"),
  plato("lento", "pescado", { minutosActivos: 45 }),
];
const base = { hoy: "2026-11-01", despensa: [], excluirIngredientes: [] as string[] };

describe("ordenarCatalogo: todo el catálogo, lo que más conviene primero", () => {
  const r = ordenarCatalogo({ ...base, dias: [dia()], catalogo });

  it("incluye todos los platos y pone primero los que encajan con el cole", () => {
    expect(r).toHaveLength(catalogo.length);
    const compatibles = r.filter((o) => o.compatible).map((o) => o.plato.id);
    expect(compatibles.sort()).toEqual(["pasta", "salmon", "tortilla"]);
    // Verdura + carne en el cole → pasta/arroz, huevo o pescado; los compatibles van antes que el resto.
    const primeros = r
      .slice(0, 3)
      .map((o) => o.plato.id)
      .sort();
    expect(primeros).toEqual(["pasta", "salmon", "tortilla"]);
  });

  it("explica por qué no conviene cada uno de los demás", () => {
    const pollo = r.find((o) => o.plato.id === "pollo");
    expect(pollo?.compatible).toBe(false);
    expect(pollo?.rechazos[0]).toMatchObject({ tipo: "cole" });
    expect(pollo?.rechazos[0]?.detalle).toContain("En el cole: verdura y carne");
    expect(pollo?.rechazos[0]?.detalle).toContain("no carne");
    const lento = r.find((o) => o.plato.id === "lento");
    expect(lento?.rechazos.map((x) => x.tipo)).toEqual(["tiempo"]);
    expect(lento?.rechazos[0]?.detalle).toContain("45 min");
  });

  it("sin menú del cole, nada se descarta por el cole y manda el equilibrio de la semana", () => {
    const sin = ordenarCatalogo({
      ...base,
      dias: [dia({ cole: null })],
      catalogo,
      colegio: {
        "2026-11-03": { primero: "legumbre", segundo: "carne" },
        "2026-11-05": { primero: "pasta", segundo: "carne" },
      },
    });
    expect(sin.filter((o) => o.compatible).map((o) => o.plato.id)).toContain("pollo");
    const pescado = sin.find((o) => o.plato.id === "salmon");
    expect(pescado?.semana).toMatchObject({ estado: "falta", n: 0, nombre: "pescado" });
    const carne = sin.find((o) => o.plato.id === "pollo");
    expect(carne?.semana).toMatchObject({ n: 2 });
    // El pescado, que falta, va por delante de la carne, que ya lleva dos.
    expect(sin.findIndex((o) => o.plato.id === "salmon")).toBeLessThan(
      sin.findIndex((o) => o.plato.id === "pollo"),
    );
  });

  it("tiene en cuenta lo ya planificado en los días de al lado y en la semana", () => {
    const ctx = {
      ...base,
      dias: [dia({ cole: null })],
      catalogo,
      elegidos: { "2026-11-05": "salmon", "2026-11-03": "tortilla" },
    };
    const o = ordenarCatalogo(ctx);
    const pescado = o.find((x) => x.plato.id === "lento");
    expect(pescado?.rechazos.map((x) => x.tipo)).toContain("vecino");
    expect(pescado?.rechazos.find((x) => x.tipo === "vecino")?.detalle).toBe(
      "El día siguiente ya hay pescado.",
    );
    expect(
      o.find((x) => x.plato.id === "tortilla")?.rechazos.find((x) => x.tipo === "vecino")?.detalle,
    ).toBe("El día anterior ya hay huevo.");
    // El plato elegido otro día cercano se marca como repetido.
    expect(o.find((x) => x.plato.id === "salmon")?.rechazos.map((x) => x.tipo)).toContain(
      "repetido",
    );
  });

  it("los que llevan algo excluido van al final y se pueden ocultar los ya elegidos ese día", () => {
    const o = ordenarCatalogo({
      ...base,
      dias: [dia({ cole: null })],
      catalogo,
      excluirIngredientes: ["i-pasta"],
      excluirPlatos: ["crema"],
    });
    expect(o.at(-1)?.plato.id).toBe("pasta");
    expect(o.at(-1)?.rechazos[0]?.tipo).toBe("excluido");
    expect(o.map((x) => x.plato.id)).not.toContain("crema");
  });

  it("sin días devuelve vacío y el orden es determinista", () => {
    expect(ordenarCatalogo({ ...base, dias: [], catalogo })).toEqual([]);
    expect(ordenarCatalogo({ ...base, dias: [dia()], catalogo })).toEqual(r);
  });
});
