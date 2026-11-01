import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cenaDeEmergencia } from "./emergencia";
import type { PlatoMenu } from "./menu";
import type { ItemDespensa } from "./tipos";

const HOY = "2026-11-04";
const plato = (
  id: string,
  ings: Array<[string, number, boolean?]>,
  extra: Partial<PlatoMenu> = {},
): PlatoMenu => ({
  id,
  nombre: id,
  grupo: "huevo",
  minutosActivos: 10,
  ultimaVez: null,
  valoracion: null,
  ingredientes: ings.map(([ingredienteId, cantidadPorRacion, opcional]) => ({
    ingredienteId,
    cantidadPorRacion,
    opcional: opcional ?? false,
  })),
  ...extra,
});
const item = (
  ingredienteId: string,
  cantidad: number,
  caducaEn: string | null = null,
): ItemDespensa => ({
  ingredienteId,
  ubicacion: "nevera",
  cantidad,
  minimo: null,
  caducaEn,
});
const base = { hoy: HOY, raciones: 3, excluirIngredientes: [] as string[] };

describe("cenaDeEmergencia", () => {
  it("pone primero lo que se puede cocinar ya y luego lo que casi se puede", () => {
    const r = cenaDeEmergencia({
      ...base,
      catalogo: [
        plato("falta-poco", [
          ["huevo", 2],
          ["patata", 150],
        ]),
        plato("tortilla", [["huevo", 2]]),
      ],
      despensa: [item("huevo", 6)],
    });
    expect(r.map((o) => o.plato.id)).toEqual(["tortilla", "falta-poco"]);
    expect(r[0]).toMatchObject({ completa: true, faltan: [] });
    expect(r[1]).toMatchObject({
      completa: false,
      faltan: [{ ingredienteId: "patata", falta: 450 }],
    });
  });

  it("cuenta las raciones: con 3 raciones hacen falta 6 huevos, no 4", () => {
    const r = cenaDeEmergencia({
      ...base,
      catalogo: [plato("tortilla", [["huevo", 2]])],
      despensa: [item("huevo", 4)],
    });
    expect(r[0]?.faltan).toEqual([{ ingredienteId: "huevo", falta: 2 }]);
  });

  it("descarta lo lento, lo que falta mucho y lo excluido; ignora opcionales", () => {
    const r = cenaDeEmergencia({
      ...base,
      excluirIngredientes: ["picante"],
      catalogo: [
        plato("lento", [["huevo", 1]], { minutosActivos: 25 }),
        plato("mucho", [
          ["a", 1],
          ["b", 1],
          ["c", 1],
        ]),
        plato("picante", [["picante", 1]]),
        plato("ok", [
          ["huevo", 1],
          ["queso", 10, true],
        ]),
      ],
      despensa: [item("huevo", 6)],
    });
    expect(r.map((o) => o.plato.id)).toEqual(["ok"]);
    expect(r[0]?.completa).toBe(true);
  });

  it("lo caducado no cuenta como stock", () => {
    const r = cenaDeEmergencia({
      ...base,
      catalogo: [plato("tortilla", [["huevo", 2]])],
      despensa: [item("huevo", 6, "2026-11-01")],
    });
    expect(r[0]?.completa).toBe(false);
  });

  it("a igualdad, prefiere lo que encaja con el cole, lo que gasta caducidad y lo mejor valorado", () => {
    const r = cenaDeEmergencia({
      ...base,
      cole: { primero: null, segundo: "carne" }, // tras carne: huevo o pescado
      catalogo: [
        plato("carne", [["pollo", 100]], { grupo: "carne", valoracion: 5 }),
        plato("huevo", [["huevo", 1]], { grupo: "huevo" }),
        plato("pescado", [["merluza", 100]], { grupo: "pescado", valoracion: 4 }),
        plato("pescado-caduca", [["atun", 1]], { grupo: "pescado" }),
      ],
      despensa: [
        item("pollo", 500),
        item("huevo", 6),
        item("merluza", 500),
        item("atun", 4, "2026-11-05"),
      ],
    });
    expect(r.map((o) => o.plato.id)).toEqual(["pescado-caduca", "pescado", "huevo", "carne"]);
    expect(r[0]?.usaCaducidad).toBe(true);
    expect(r.at(-1)?.encajaConCole).toBe(false);
  });

  it("respeta el máximo de opciones y un tiempo distinto", () => {
    const catalogo = ["a", "b", "c"].map((id) => plato(id, [["huevo", 1]], { minutosActivos: 20 }));
    expect(cenaDeEmergencia({ ...base, catalogo, despensa: [item("huevo", 9)] })).toEqual([]);
    expect(
      cenaDeEmergencia({ ...base, catalogo, despensa: [item("huevo", 9)], minutosMax: 20, max: 2 }),
    ).toHaveLength(2);
  });

  it("propiedad: toda opción cumple tiempo, exclusiones, y «completa» ⇔ nada falta", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ cant: fc.integer({ min: 0, max: 10 }), t: fc.integer({ min: 1, max: 30 }) }),
          { maxLength: 12 },
        ),
        (datos) => {
          const catalogo = datos.map((d, i) =>
            plato(
              `p${i}`,
              [
                ["x", 1],
                ["y", 1],
              ],
              { minutosActivos: d.t },
            ),
          );
          const r = cenaDeEmergencia({
            ...base,
            catalogo,
            despensa: [item("x", datos[0]?.cant ?? 0)],
            excluirIngredientes: ["z"],
          });
          for (const o of r) {
            expect(o.plato.minutosActivos).toBeLessThanOrEqual(15);
            expect(o.completa).toBe(o.faltan.length === 0);
            expect(o.faltan.length).toBeLessThanOrEqual(2);
          }
        },
      ),
    );
  });
});
