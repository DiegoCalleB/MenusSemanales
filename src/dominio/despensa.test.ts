import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  StockCaducadoError,
  StockInsuficienteError,
  aplicarMovimientos,
  bajoMinimo,
  descartarCaducados,
  invertirMovimientos,
  planificarCocinado,
  proximosACaducar,
  stockUtilizable,
} from "./despensa";
import type { ItemDespensa, Movimiento, Plato, Ubicacion } from "./tipos";

const HOY = "2026-11-02";
const item = (
  ingredienteId: string,
  ubicacion: Ubicacion,
  cantidad: number,
  extra: Partial<ItemDespensa> = {},
): ItemDespensa => ({ ingredienteId, ubicacion, cantidad, minimo: null, caducaEn: null, ...extra });

const pastaConTomate: Plato = {
  id: "p1",
  nombre: "Pasta con tomate",
  ingredientes: [
    { ingredienteId: "pasta", cantidadPorRacion: 80, opcional: false },
    { ingredienteId: "tomate", cantidadPorRacion: 100, opcional: false },
    { ingredienteId: "queso", cantidadPorRacion: 10, opcional: true },
  ],
};

describe("planificarCocinado", () => {
  it("descuenta lo necesario para las raciones indicadas", () => {
    const plan = planificarCocinado({
      plato: pastaConTomate,
      raciones: 3,
      despensa: [item("pasta", "despensa", 500), item("tomate", "nevera", 400)],
      hoy: HOY,
    });
    expect(plan.movimientos).toEqual([
      { ingredienteId: "pasta", ubicacion: "despensa", delta: -240 },
      { ingredienteId: "tomate", ubicacion: "nevera", delta: -300 },
    ]);
    expect(plan.faltantes).toEqual([]);
  });

  it("no descuenta los ingredientes opcionales aunque los haya", () => {
    const plan = planificarCocinado({
      plato: pastaConTomate,
      raciones: 1,
      despensa: [
        item("pasta", "despensa", 500),
        item("tomate", "nevera", 400),
        item("queso", "nevera", 200),
      ],
      hoy: HOY,
    });
    expect(plan.movimientos.map((m) => m.ingredienteId)).not.toContain("queso");
  });

  it("si no hay bastante, descuenta lo que haya e informa de lo que falta", () => {
    const plan = planificarCocinado({
      plato: pastaConTomate,
      raciones: 3,
      despensa: [item("pasta", "despensa", 100)],
      hoy: HOY,
    });
    expect(plan.movimientos).toEqual([
      { ingredienteId: "pasta", ubicacion: "despensa", delta: -100 },
    ]);
    expect(plan.faltantes).toEqual([
      { ingredienteId: "pasta", cantidad: 140 },
      { ingredienteId: "tomate", cantidad: 300 },
    ]);
  });

  it("gasta primero lo que caduca antes", () => {
    const plan = planificarCocinado({
      plato: pastaConTomate,
      raciones: 2,
      despensa: [
        item("tomate", "nevera", 500, { caducaEn: "2026-11-10" }),
        item("tomate", "congelador", 500, { caducaEn: "2026-11-04" }),
      ],
      hoy: HOY,
    });
    expect(plan.movimientos.find((m) => m.ingredienteId === "tomate")).toEqual({
      ingredienteId: "tomate",
      ubicacion: "congelador",
      delta: -200,
    });
  });

  it("a igual caducidad, usa antes la nevera que la despensa y esta antes que el congelador", () => {
    const plan = planificarCocinado({
      plato: {
        id: "x",
        nombre: "x",
        ingredientes: [{ ingredienteId: "a", cantidadPorRacion: 150, opcional: false }],
      },
      raciones: 2,
      despensa: [
        item("a", "congelador", 500),
        item("a", "despensa", 100),
        item("a", "nevera", 100),
      ],
      hoy: HOY,
    });
    expect(plan.movimientos).toEqual([
      { ingredienteId: "a", ubicacion: "nevera", delta: -100 },
      { ingredienteId: "a", ubicacion: "despensa", delta: -100 },
      { ingredienteId: "a", ubicacion: "congelador", delta: -100 },
    ]);
  });

  it("lo sin caducidad se gasta después de lo que sí caduca", () => {
    const plan = planificarCocinado({
      plato: {
        id: "x",
        nombre: "x",
        ingredientes: [{ ingredienteId: "a", cantidadPorRacion: 100, opcional: false }],
      },
      raciones: 1,
      despensa: [item("a", "nevera", 500), item("a", "despensa", 500, { caducaEn: "2026-11-20" })],
      hoy: HOY,
    });
    expect(plan.movimientos[0]).toMatchObject({ ubicacion: "despensa" });
  });

  it("no usa lo caducado", () => {
    const plan = planificarCocinado({
      plato: pastaConTomate,
      raciones: 1,
      despensa: [
        item("pasta", "despensa", 500, { caducaEn: "2026-11-01" }),
        item("tomate", "nevera", 400),
      ],
      hoy: HOY,
    });
    expect(plan.movimientos.map((m) => m.ingredienteId)).toEqual(["tomate"]);
    expect(plan.faltantes).toEqual([{ ingredienteId: "pasta", cantidad: 80 }]);
  });

  it("lo que caduca hoy todavía se puede usar", () => {
    const plan = planificarCocinado({
      plato: pastaConTomate,
      raciones: 1,
      despensa: [item("pasta", "despensa", 500, { caducaEn: HOY }), item("tomate", "nevera", 400)],
      hoy: HOY,
    });
    expect(plan.faltantes).toEqual([]);
  });

  it("rechaza raciones no positivas", () => {
    expect(() =>
      planificarCocinado({ plato: pastaConTomate, raciones: 0, despensa: [], hoy: HOY }),
    ).toThrow(RangeError);
  });
});

describe("aplicarMovimientos e invertirMovimientos", () => {
  const base = [item("pasta", "despensa", 500), item("tomate", "nevera", 300)];

  it("aplica descuentos y compras sin modificar el original", () => {
    const original = JSON.stringify(base);
    const { despensa } = aplicarMovimientos(
      base,
      [
        { ingredienteId: "pasta", ubicacion: "despensa", delta: -200 },
        { ingredienteId: "tomate", ubicacion: "nevera", delta: 100 },
      ],
      HOY,
    );
    expect(despensa.map((i) => i.cantidad)).toEqual([300, 400]);
    expect(JSON.stringify(base)).toBe(original);
  });

  it("una compra de algo que no había crea el artículo", () => {
    const { despensa } = aplicarMovimientos(
      base,
      [{ ingredienteId: "arroz", ubicacion: "despensa", delta: 1000 }],
      HOY,
    );
    expect(despensa).toContainEqual({
      ingredienteId: "arroz",
      ubicacion: "despensa",
      cantidad: 1000,
      minimo: null,
      caducaEn: null,
    });
  });

  it("no permite stock negativo: ni quedándose corto ni descontando lo que no existe", () => {
    expect(() =>
      aplicarMovimientos(
        base,
        [{ ingredienteId: "pasta", ubicacion: "despensa", delta: -501 }],
        HOY,
      ),
    ).toThrow(StockInsuficienteError);
    expect(() =>
      aplicarMovimientos(base, [{ ingredienteId: "sal", ubicacion: "despensa", delta: -1 }], HOY),
    ).toThrow(/Stock insuficiente/);
  });

  it("si un movimiento falla no se aplica ninguno (la despensa original queda intacta)", () => {
    expect(() =>
      aplicarMovimientos(
        base,
        [
          { ingredienteId: "tomate", ubicacion: "nevera", delta: -50 },
          { ingredienteId: "pasta", ubicacion: "despensa", delta: -9999 },
        ],
        HOY,
      ),
    ).toThrow(StockInsuficienteError);
    expect(base[1]?.cantidad).toBe(300);
  });

  it("deshacer devuelve exactamente lo descontado", () => {
    const plan = planificarCocinado({
      plato: pastaConTomate,
      raciones: 2,
      despensa: base,
      hoy: HOY,
    });
    const cocinada = aplicarMovimientos(base, plan.movimientos, HOY);
    expect(cocinada.despensa).not.toEqual(base);
    expect(
      aplicarMovimientos(cocinada.despensa, invertirMovimientos(cocinada.aplicados), HOY).despensa,
    ).toEqual(base);
  });

  it("deshacer aplica los inversos en orden inverso", () => {
    const { aplicados } = aplicarMovimientos(
      base,
      [
        { ingredienteId: "pasta", ubicacion: "despensa", delta: -100 },
        { ingredienteId: "tomate", ubicacion: "nevera", delta: -50 },
      ],
      HOY,
    );
    expect(invertirMovimientos(aplicados).map((m) => [m.ingredienteId, m.delta])).toEqual([
      ["tomate", 50],
      ["pasta", 100],
    ]);
  });
});

describe("caducidad en las operaciones de despensa", () => {
  const leche = (cantidad: number, caducaEn: string | null): ItemDespensa[] => [
    item("leche", "nevera", cantidad, { caducaEn }),
  ];

  it("una fila que llega a 0 pierde su caducidad", () => {
    const { despensa } = aplicarMovimientos(
      leche(500, "2026-11-10"),
      [{ ingredienteId: "leche", ubicacion: "nevera", delta: -500 }],
      HOY,
    );
    expect(despensa[0]).toMatchObject({ cantidad: 0, caducaEn: null });
  });

  it("añadir stock a una fila vacía crea un lote nuevo, sin la caducidad vencida del anterior", () => {
    const { despensa } = aplicarMovimientos(
      leche(0, "2026-10-01"),
      [{ ingredienteId: "leche", ubicacion: "nevera", delta: 1000 }],
      HOY,
    );
    expect(despensa[0]).toMatchObject({ cantidad: 1000, caducaEn: null });
  });

  it("no se mezcla stock nuevo con stock caducado: hay que tirarlo antes", () => {
    expect(() =>
      aplicarMovimientos(
        leche(300, "2026-10-01"),
        [{ ingredienteId: "leche", ubicacion: "nevera", delta: 1000 }],
        HOY,
      ),
    ).toThrow(StockCaducadoError);
  });

  it("tirar lo caducado y comprar de nuevo, en un solo paso, funciona", () => {
    const base = leche(300, "2026-10-01");
    const { despensa } = aplicarMovimientos(
      base,
      [
        ...descartarCaducados(base, HOY),
        { ingredienteId: "leche", ubicacion: "nevera", delta: 1000 },
      ],
      HOY,
    );
    expect(despensa[0]).toMatchObject({ cantidad: 1000, caducaEn: null });
  });

  it("deshacer restaura el stock caducado CON su caducidad: no resucita comida caducada como fresca", () => {
    const base = leche(300, "2026-10-01");
    const paso = aplicarMovimientos(
      base,
      [
        ...descartarCaducados(base, HOY),
        { ingredienteId: "leche", ubicacion: "nevera", delta: 1000 },
      ],
      HOY,
    );
    const vuelta = aplicarMovimientos(paso.despensa, invertirMovimientos(paso.aplicados), HOY);
    expect(vuelta.despensa.filter((i) => i.cantidad > 0)).toEqual(base);
  });

  it("deshacer puede añadir stock a una fila con stock caducado (restituye lo que había)", () => {
    const base = leche(300, "2026-10-01");
    const cocinar = aplicarMovimientos(
      base,
      [{ ingredienteId: "leche", ubicacion: "nevera", delta: -100 }],
      HOY,
    );
    expect(
      aplicarMovimientos(cocinar.despensa, invertirMovimientos(cocinar.aplicados), HOY).despensa,
    ).toEqual(base);
  });

  it("descartarCaducados solo propone tirar lo que tiene stock y ya caducó", () => {
    expect(
      descartarCaducados(
        [
          item("a", "nevera", 100, { caducaEn: "2026-10-01" }),
          item("b", "nevera", 100, { caducaEn: HOY }), // caduca hoy: aún vale
          item("c", "nevera", 0, { caducaEn: "2026-10-01" }), // sin stock
          item("d", "nevera", 100),
        ],
        HOY,
      ),
    ).toEqual([{ ingredienteId: "a", ubicacion: "nevera", delta: -100 }]);
  });
});

describe("proximosACaducar y bajoMinimo", () => {
  it("lista lo que caduca en los próximos días, de más urgente a menos", () => {
    const lista = proximosACaducar(
      [
        item("a", "nevera", 1, { caducaEn: "2026-11-05" }),
        item("b", "nevera", 1, { caducaEn: "2026-11-02" }),
        item("c", "nevera", 1, { caducaEn: "2026-11-20" }),
        item("d", "nevera", 0, { caducaEn: "2026-11-03" }), // sin cantidad: no cuenta
        item("e", "nevera", 1), // sin caducidad
        item("f", "nevera", 1, { caducaEn: "2026-10-30" }), // ya caducado
      ],
      HOY,
      3,
    );
    expect(lista.map((i) => i.ingredienteId)).toEqual(["b", "a"]);
  });

  it("por defecto mira los próximos 3 días", () => {
    expect(
      proximosACaducar([item("a", "nevera", 1, { caducaEn: "2026-11-05" })], HOY),
    ).toHaveLength(1);
    expect(
      proximosACaducar([item("a", "nevera", 1, { caducaEn: "2026-11-06" })], HOY),
    ).toHaveLength(0);
  });

  it("detecta lo que está por debajo del mínimo sumando ubicaciones y sin contar lo caducado", () => {
    const bajos = bajoMinimo(
      [
        item("leche", "nevera", 400, { minimo: 1000 }),
        item("leche", "despensa", 300),
        item("huevo", "nevera", 2, { minimo: 6 }),
        item("pan", "despensa", 5, { minimo: 2 }), // por encima: no sale
        item("yogur", "nevera", 10, { minimo: 4, caducaEn: "2026-10-01" }), // todo caducado
      ],
      HOY,
    );
    expect(bajos).toEqual([
      { ingredienteId: "huevo", stock: 2, minimo: 6 },
      { ingredienteId: "leche", stock: 700, minimo: 1000 },
      { ingredienteId: "yogur", stock: 0, minimo: 4 },
    ]);
  });

  it("stockUtilizable suma ubicaciones y excluye lo caducado", () => {
    const stock = stockUtilizable(
      [
        item("a", "nevera", 100),
        item("a", "despensa", 50),
        item("a", "congelador", 70, { caducaEn: "2026-01-01" }),
      ],
      HOY,
    );
    expect(stock.get("a")).toBe(150);
  });
});

// ---------------------------------------------------------------------------------------------
// Propiedades: se comprueban con miles de despensas y platos generados al azar.
// ---------------------------------------------------------------------------------------------
const idIng = fc.constantFrom("a", "b", "c", "d");
const ubicacion = fc.constantFrom<Ubicacion>("nevera", "despensa", "congelador");
const cantidad = fc.integer({ min: 0, max: 100_000 }).map((n) => n / 100); // con dos decimales
const caducidad = fc.option(
  fc.constantFrom("2026-10-30", "2026-11-02", "2026-11-05", "2026-12-31"),
  { nil: null },
);

const arbItem = fc.record({
  ingredienteId: idIng,
  ubicacion,
  cantidad,
  minimo: fc.constant(null),
  caducaEn: caducidad,
});
// Una despensa no repite (ingrediente, ubicación), como la restricción única de la base de datos.
const arbDespensa = fc.uniqueArray(arbItem, {
  selector: (i) => `${i.ingredienteId}|${i.ubicacion}`,
  maxLength: 10,
});
const arbPlato = fc.record({
  id: fc.constant("p"),
  nombre: fc.constant("Plato"),
  ingredientes: fc.uniqueArray(
    fc.record({
      ingredienteId: idIng,
      cantidadPorRacion: fc.integer({ min: 1, max: 50_000 }).map((n) => n / 100),
      opcional: fc.boolean(),
    }),
    { selector: (i) => i.ingredienteId, maxLength: 4 },
  ),
});
const arbRaciones = fc.integer({ min: 1, max: 1200 }).map((n) => n / 100);

// Una fila vacía equivale a una fila ausente (y su caducidad no significa nada): se ignoran al comparar.
const clave = (d: readonly ItemDespensa[]) =>
  d
    .filter((i) => i.cantidad > 0)
    .map((i) => `${i.ingredienteId}|${i.ubicacion}|${i.cantidad}|${i.caducaEn}`)
    .sort();

describe("propiedades de la despensa", () => {
  it("cocinar nunca deja el stock negativo y nunca falla", () => {
    fc.assert(
      fc.property(arbDespensa, arbPlato, arbRaciones, (despensa, plato, raciones) => {
        const plan = planificarCocinado({ plato, raciones, despensa, hoy: HOY });
        const resultado = aplicarMovimientos(despensa, plan.movimientos, HOY).despensa;
        expect(resultado.every((i) => i.cantidad >= 0)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("conservación: lo descontado más lo que falta es exactamente lo que pide el plato", () => {
    fc.assert(
      fc.property(arbDespensa, arbPlato, arbRaciones, (despensa, plato, raciones) => {
        const plan = planificarCocinado({ plato, raciones, despensa, hoy: HOY });
        for (const ing of plato.ingredientes.filter((i) => !i.opcional)) {
          const descontado = -plan.movimientos
            .filter((m) => m.ingredienteId === ing.ingredienteId)
            .reduce((s, m) => s + m.delta, 0);
          const falta =
            plan.faltantes.find((f) => f.ingredienteId === ing.ingredienteId)?.cantidad ?? 0;
          expect(Math.abs(descontado + falta - ing.cantidadPorRacion * raciones)).toBeLessThan(
            0.011,
          );
        }
      }),
      { numRuns: 500 },
    );
  });

  it("deshacer devuelve exactamente la despensa original, caducidades incluidas", () => {
    fc.assert(
      fc.property(arbDespensa, arbPlato, arbRaciones, (despensa, plato, raciones) => {
        const { movimientos } = planificarCocinado({ plato, raciones, despensa, hoy: HOY });
        const tras = aplicarMovimientos(despensa, movimientos, HOY);
        const deshecha = aplicarMovimientos(
          tras.despensa,
          invertirMovimientos(tras.aplicados),
          HOY,
        );
        expect(clave(deshecha.despensa)).toEqual(clave(despensa));
      }),
      { numRuns: 500 },
    );
  });

  it("tirar lo caducado y comprar es siempre posible y deshacer lo restaura todo, fechas incluidas", () => {
    fc.assert(
      fc.property(
        arbDespensa,
        idIng,
        ubicacion,
        fc.integer({ min: 1, max: 100_000 }),
        (despensa, id, ubi, extra) => {
          const movimientos = [
            ...descartarCaducados(despensa, HOY),
            { ingredienteId: id, ubicacion: ubi, delta: extra / 100 },
          ];
          const tras = aplicarMovimientos(despensa, movimientos, HOY);
          // Si había stock caducado en la misma fila, se tiró primero: el lote nuevo no hereda la fecha vencida.
          const fila = tras.despensa.find((i) => i.ingredienteId === id && i.ubicacion === ubi);
          expect(fila?.cantidad).toBeGreaterThan(0);
          const deshecha = aplicarMovimientos(
            tras.despensa,
            invertirMovimientos(tras.aplicados),
            HOY,
          );
          expect(clave(deshecha.despensa)).toEqual(clave(despensa));
        },
      ),
      { numRuns: 500 },
    );
  });

  it("nunca queda stock caducado mezclado con stock utilizable en una misma fila tras una compra", () => {
    fc.assert(
      fc.property(
        arbDespensa,
        idIng,
        ubicacion,
        fc.integer({ min: 1, max: 100_000 }),
        (despensa, id, ubi, extra) => {
          const movimientos = [
            ...descartarCaducados(despensa, HOY),
            { ingredienteId: id, ubicacion: ubi, delta: extra / 100 },
          ];
          const { despensa: tras } = aplicarMovimientos(despensa, movimientos, HOY);
          for (const i of tras)
            expect(i.cantidad === 0 || i.caducaEn === null || i.caducaEn >= HOY).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("nunca se consume lo caducado ni los ingredientes opcionales", () => {
    fc.assert(
      fc.property(arbDespensa, arbPlato, arbRaciones, (despensa, plato, raciones) => {
        const { movimientos } = planificarCocinado({ plato, raciones, despensa, hoy: HOY });
        const opcionales = new Set<string>(
          plato.ingredientes.filter((i) => i.opcional).map((i) => i.ingredienteId),
        );
        for (const m of movimientos) {
          const origen = despensa.find(
            (i) => i.ingredienteId === m.ingredienteId && i.ubicacion === m.ubicacion,
          );
          expect(origen?.caducaEn === null || (origen?.caducaEn ?? "") >= HOY).toBe(true);
          expect(opcionales.has(m.ingredienteId)).toBe(false);
          expect(m.delta).toBeLessThan(0);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("es determinista: la misma entrada da siempre el mismo plan", () => {
    fc.assert(
      fc.property(arbDespensa, arbPlato, arbRaciones, (despensa, plato, raciones) => {
        const a = planificarCocinado({ plato, raciones, despensa, hoy: HOY });
        const b = planificarCocinado({
          plato,
          raciones,
          despensa: [...despensa].reverse(),
          hoy: HOY,
        });
        expect(a.faltantes).toEqual(b.faltantes);
        const total = (m: Movimiento[]) => m.reduce((s, x) => s + x.delta, 0);
        expect(total(a.movimientos)).toBeCloseTo(total(b.movimientos), 2);
      }),
      { numRuns: 300 },
    );
  });
});
