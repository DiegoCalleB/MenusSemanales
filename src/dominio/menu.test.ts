import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  GRUPOS_PLATO,
  type DiaMenu,
  type PlatoMenu,
  proponerMenu,
  recomendadosParaCenar,
} from "./menu";

const HOY = "2026-11-02";

function plato(id: string, extra: Partial<PlatoMenu> = {}): PlatoMenu {
  return {
    id,
    nombre: id,
    ingredientes: [{ ingredienteId: `ing-${id}`, cantidadPorRacion: 100, opcional: false }],
    grupo: "carne",
    minutosActivos: 20,
    ultimaVez: null,
    valoracion: null,
    ...extra,
  };
}
const dia = (fecha: string, extra: Partial<DiaMenu> = {}): DiaMenu => ({
  fecha,
  minutosMax: 30,
  cole: null,
  ...extra,
});
const base = { hoy: HOY, despensa: [], excluirIngredientes: [] };

describe("proponerMenu · reglas duras", () => {
  it("excluye platos con un ingrediente prohibido, pero no si es opcional", () => {
    const p1 = plato("a", {
      ingredientes: [{ ingredienteId: "x", cantidadPorRacion: 1, opcional: false }],
    });
    const p2 = plato("b", {
      ingredientes: [{ ingredienteId: "x", cantidadPorRacion: 1, opcional: true }],
    });
    const m = proponerMenu({
      ...base,
      dias: [dia(HOY)],
      catalogo: [p1, p2],
      excluirIngredientes: ["x"],
    });
    expect(m.dias[0]?.opciones.map((o) => o.plato.id)).toEqual(["b"]);
  });

  it("respeta el tiempo máximo del día (hoy llego tarde)", () => {
    const m = proponerMenu({
      ...base,
      dias: [dia(HOY, { minutosMax: 15 })],
      catalogo: [plato("lento", { minutosActivos: 25 }), plato("rapido", { minutosActivos: 10 })],
    });
    expect(m.dias[0]?.opciones.map((o) => o.plato.id)).toEqual(["rapido"]);
  });

  it("sigue el recomendador de cenas del cole (verdura + carne en el cole → pasta/arroz, huevo o pescado)", () => {
    const m = proponerMenu({
      ...base,
      dias: [dia(HOY, { cole: { primero: "verdura", segundo: "carne" } })],
      opcionesPorDia: 10,
      catalogo: [
        plato("espaguetis", { grupo: "pasta" }),
        plato("arroz", { grupo: "arroz" }),
        plato("pollo", { grupo: "carne" }),
        plato("crema", { grupo: "verdura" }),
        plato("merluza", { grupo: "pescado" }),
        plato("tortilla", { grupo: "huevo" }),
        plato("lentejas", { grupo: "legumbre" }),
      ],
    });
    expect(m.dias[0]?.opciones.map((o) => o.plato.grupo).sort()).toEqual([
      "arroz",
      "huevo",
      "pasta",
      "pescado",
    ]);
  });

  it("si el cole solo tiene un plato conocido, aplica solo esa regla; sin datos no restringe", () => {
    expect(recomendadosParaCenar(null)).toBeNull();
    expect(recomendadosParaCenar({ primero: null, segundo: null })).toBeNull();
    expect(
      [...(recomendadosParaCenar({ primero: "legumbre", segundo: null }) ?? [])].sort(),
    ).toEqual(["arroz", "pasta", "verdura"]);
    // Un primero sin regla (p. ej. «otro») tampoco restringe.
    expect(recomendadosParaCenar({ primero: "otro", segundo: null })).toBeNull();
  });

  it("un plato elegido no se repite y condiciona el grupo de los días vecinos", () => {
    const m = proponerMenu({
      ...base,
      dias: [dia("2026-11-02"), dia("2026-11-03"), dia("2026-11-04")],
      catalogo: [
        plato("lentejas", { grupo: "legumbre" }),
        plato("garbanzos", { grupo: "legumbre" }),
        plato("pollo"),
        plato("merluza", { grupo: "pescado" }),
      ],
      elegidos: { "2026-11-03": "lentejas" },
    });
    const [lunes, martes, miercoles] = m.dias;
    expect(martes?.opciones.map((o) => o.plato.id)).toEqual(["lentejas"]);
    for (const d of [lunes, miercoles]) {
      const ids = d?.opciones.map((o) => o.plato.id) ?? [];
      expect(ids).not.toContain("lentejas");
      expect(ids).not.toContain("garbanzos");
    }
  });

  it("si las reglas no dejan ninguna opción, el día queda vacío (no se relajan en silencio)", () => {
    const m = proponerMenu({
      ...base,
      dias: [dia(HOY, { minutosMax: 5 })],
      catalogo: [plato("a")],
    });
    expect(m.dias[0]?.opciones).toEqual([]);
  });
});

describe("proponerMenu · puntuación", () => {
  it("prefiere lo bien valorado y penaliza lo cocinado hace menos de una semana", () => {
    const m = proponerMenu({
      ...base,
      dias: [dia(HOY)],
      opcionesPorDia: 3,
      catalogo: [
        plato("reciente", { ultimaVez: "2026-10-31", valoracion: 5 }),
        plato("querido", { grupo: "pescado", ultimaVez: "2026-10-01", valoracion: 5 }),
        plato("regular", { grupo: "pasta", ultimaVez: "2026-10-01", valoracion: 2 }),
      ],
    });
    const ids = m.dias[0]?.opciones.map((o) => o.plato.id);
    expect(ids?.[0]).toBe("querido");
    expect(ids?.[2]).not.toBe("querido");
  });

  it("aprovecha lo que caduca pronto y lo explica", () => {
    const m = proponerMenu({
      ...base,
      dias: [dia(HOY)],
      despensa: [
        {
          ingredienteId: "ing-puerro",
          ubicacion: "nevera",
          cantidad: 300,
          minimo: null,
          caducaEn: "2026-11-03",
        },
      ],
      catalogo: [
        plato("puerros", {
          grupo: "verdura",
          ingredientes: [{ ingredienteId: "ing-puerro", cantidadPorRacion: 100, opcional: false }],
        }),
        plato("otro"),
      ],
    });
    const primero = m.dias[0]?.opciones[0];
    expect(primero?.plato.id).toBe("puerros");
    expect(primero?.motivos).toContain("usa_caducidad");
    expect(primero?.motivos).toContain("usa_despensa");
  });

  it("reparte grupos distintos entre las opciones del día", () => {
    const m = proponerMenu({
      ...base,
      dias: [dia(HOY)],
      catalogo: [
        plato("p1", { valoracion: 5 }),
        plato("p2", { valoracion: 5 }),
        plato("p3", { valoracion: 5 }),
        plato("m1", { grupo: "pescado" }),
        plato("a1", { grupo: "arroz" }),
      ],
    });
    const grupos = m.dias[0]?.opciones.map((o) => o.plato.grupo);
    expect(new Set(grupos).size).toBe(3);
  });

  it("una opción ofrecida un día pierde puntos al siguiente (variedad en la semana)", () => {
    const catalogo = [
      plato("a", { valoracion: 5 }),
      plato("b", { grupo: "pescado", valoracion: 4 }),
    ];
    const m = proponerMenu({
      ...base,
      dias: [dia("2026-11-02"), dia("2026-11-03")],
      catalogo,
      opcionesPorDia: 1,
    });
    expect(m.dias[0]?.opciones[0]?.plato.id).toBe("a");
    expect(m.dias[1]?.opciones[0]?.plato.id).toBe("b");
  });
});

describe("proponerMenu · propiedades", () => {
  const platoArb = fc
    .record({
      id: fc.uuid(),
      grupo: fc.constantFrom(...GRUPOS_PLATO),
      minutosActivos: fc.integer({ min: 1, max: 60 }),
      ing: fc.constantFrom("x", "y", "z", "w"),
      opcional: fc.boolean(),
      valoracion: fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
      ultimaVez: fc.option(fc.constantFrom("2026-10-01", "2026-10-30", "2026-11-01"), {
        nil: null,
      }),
    })
    .map(({ id, ing, opcional, ...r }) =>
      plato(id, { ...r, ingredientes: [{ ingredienteId: ing, cantidadPorRacion: 1, opcional }] }),
    );

  it("nunca incumple una regla dura y es determinista", () => {
    fc.assert(
      fc.property(
        fc.array(platoArb, { maxLength: 25 }),
        fc.subarray(["x", "y", "z"]),
        fc.constantFrom(15, 30),
        fc.option(fc.constantFrom(...GRUPOS_PLATO), { nil: null }),
        (catalogo, excluidos, minutosMax, primeroCole) => {
          const dias = [
            dia("2026-11-02", { minutosMax, cole: { primero: primeroCole, segundo: null } }),
            dia("2026-11-03", { minutosMax }),
          ];
          const ctx = { ...base, dias, catalogo, excluirIngredientes: excluidos };
          const m = proponerMenu(ctx);
          expect(proponerMenu(ctx)).toEqual(m);
          for (const [i, d] of m.dias.entries()) {
            const ids = d.opciones.map((o) => o.plato.id);
            expect(new Set(ids).size).toBe(ids.length);
            expect(ids.length).toBeLessThanOrEqual(3);
            for (const o of d.opciones) {
              expect(o.plato.minutosActivos).toBeLessThanOrEqual(minutosMax);
              const rec =
                i === 0 ? recomendadosParaCenar({ primero: primeroCole, segundo: null }) : null;
              if (rec) expect(rec.has(o.plato.grupo)).toBe(true);
              for (const ing of o.plato.ingredientes) {
                if (!ing.opcional) expect(excluidos).not.toContain(ing.ingredienteId);
              }
            }
          }
        },
      ),
    );
  });
});
