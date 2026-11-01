import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { aPayloadSincronizacion, calcularCompra, PASO_POR_UNIDAD } from "./compra";
import { aplicarMovimientos, descartarCaducados } from "./despensa";
import type { ComidaPlanificada, Ingrediente, ItemDespensa, Plato } from "./tipos";

const HOY = "2026-11-02";
const ingredientes = new Map<string, Ingrediente>(
  (
    [
      { id: "pasta", nombre: "Pasta", unidad: "g", seccion: "despensa" },
      { id: "tomate", nombre: "Tomate", unidad: "g", seccion: "fruta_verdura" },
      { id: "huevo", nombre: "Huevo", unidad: "ud", seccion: "huevos" },
      { id: "leche", nombre: "Leche", unidad: "ml", seccion: "lacteos" },
      { id: "pollo", nombre: "Pollo", unidad: "g", seccion: "carne" },
    ] satisfies Ingrediente[]
  ).map((i) => [i.id, i]),
);
const item = (id: string, cantidad: number, extra: Partial<ItemDespensa> = {}): ItemDespensa => ({
  ingredienteId: id,
  ubicacion: "despensa",
  cantidad,
  minimo: null,
  caducaEn: null,
  ...extra,
});
const plato = (id: string, ingredientes: Plato["ingredientes"]): Plato => ({
  id,
  nombre: id,
  ingredientes,
});
const comida = (etiqueta: string, p: Plato, raciones: number): ComidaPlanificada => ({
  etiqueta,
  fecha: HOY,
  plato: p,
  raciones,
});

const pastaTomate = plato("Pasta con tomate", [
  { ingredienteId: "pasta", cantidadPorRacion: 80, opcional: false },
  { ingredienteId: "tomate", cantidadPorRacion: 100, opcional: false },
]);

describe("calcularCompra", () => {
  it("necesidad × raciones − stock, redondeado hacia arriba a 50 g", () => {
    const lista = calcularCompra({
      comidas: [comida("Cena del martes", pastaTomate, 3)],
      despensa: [item("pasta", 100)],
      ingredientes,
      hoy: HOY,
    });
    // pasta: 240 − 100 = 140 → 150; tomate: 300 → 300
    expect(lista).toEqual([
      expect.objectContaining({ ingredienteId: "tomate", cantidad: 300, seccion: "fruta_verdura" }),
      expect.objectContaining({ ingredienteId: "pasta", cantidad: 150, seccion: "despensa" }),
    ]);
  });

  it("no pide lo que ya hay de sobra", () => {
    expect(
      calcularCompra({
        comidas: [comida("Cena", pastaTomate, 2)],
        despensa: [item("pasta", 1000), item("tomate", 1000, { ubicacion: "nevera" })],
        ingredientes,
        hoy: HOY,
      }),
    ).toEqual([]);
  });

  it("suma la necesidad de varias comidas y recuerda todas como motivo", () => {
    const lista = calcularCompra({
      comidas: [
        comida("Cena del martes", pastaTomate, 2),
        comida("Cena del jueves", pastaTomate, 3),
      ],
      despensa: [],
      ingredientes,
      hoy: HOY,
    });
    const pasta = lista.find((a) => a.ingredienteId === "pasta");
    expect(pasta).toMatchObject({ cantidad: 400, motivos: ["Cena del martes", "Cena del jueves"] });
  });

  it("no repite el motivo si una misma comida usa el ingrediente dos veces", () => {
    const doble = plato("Doble", [
      { ingredienteId: "pasta", cantidadPorRacion: 50, opcional: false },
    ]);
    const lista = calcularCompra({
      comidas: [comida("Comida", doble, 2), comida("Comida", doble, 2)],
      despensa: [],
      ingredientes,
      hoy: HOY,
    });
    expect(lista[0]?.motivos).toEqual(["Comida"]);
  });

  it("ignora los ingredientes opcionales y las comidas sin raciones", () => {
    const conOpcional = plato("X", [
      { ingredienteId: "pasta", cantidadPorRacion: 80, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 100, opcional: true },
    ]);
    const lista = calcularCompra({
      comidas: [comida("A", conOpcional, 2), comida("B", pastaTomate, 0)],
      despensa: [],
      ingredientes,
      hoy: HOY,
    });
    expect(lista.map((a) => a.ingredienteId)).toEqual(["pasta"]);
  });

  it("lo caducado no cuenta como stock", () => {
    const lista = calcularCompra({
      comidas: [comida("Cena", pastaTomate, 1)],
      despensa: [item("pasta", 500, { caducaEn: "2026-10-31" })],
      ingredientes,
      hoy: HOY,
    });
    expect(lista.find((a) => a.ingredienteId === "pasta")?.cantidad).toBe(100);
  });

  it("el stock mínimo hace que entre en la lista aunque no haya menú", () => {
    const lista = calcularCompra({
      comidas: [],
      despensa: [item("leche", 200, { ubicacion: "nevera", minimo: 1000 })],
      ingredientes,
      hoy: HOY,
    });
    expect(lista).toEqual([
      expect.objectContaining({ ingredienteId: "leche", cantidad: 800, motivos: ["Stock mínimo"] }),
    ]);
  });

  it("el mínimo se suma a lo que pide el menú, y ambos son motivos", () => {
    const lista = calcularCompra({
      comidas: [comida("Cena", pastaTomate, 2)],
      despensa: [item("pasta", 100, { minimo: 200 })],
      ingredientes,
      hoy: HOY,
    });
    // necesita 160 + mínimo 200 − 100 = 260 → 300
    expect(lista.find((a) => a.ingredienteId === "pasta")).toMatchObject({
      cantidad: 300,
      motivos: ["Cena", "Stock mínimo"],
    });
  });

  it("con un mínimo ya cubierto no pide nada", () => {
    expect(
      calcularCompra({
        comidas: [],
        despensa: [item("leche", 1500, { minimo: 1000 })],
        ingredientes,
        hoy: HOY,
      }),
    ).toEqual([]);
  });

  it("las unidades se redondean de 1 en 1 y el paso es configurable", () => {
    const tortilla = plato("Tortilla", [
      { ingredienteId: "huevo", cantidadPorRacion: 1.5, opcional: false },
    ]);
    expect(
      calcularCompra({
        comidas: [comida("Cena", tortilla, 3)],
        despensa: [],
        ingredientes,
        hoy: HOY,
      })[0],
    ).toMatchObject({
      ingredienteId: "huevo",
      cantidad: 5, // 4,5 → 5
    });
    const lista = calcularCompra({
      comidas: [comida("Cena", pastaTomate, 1)],
      despensa: [],
      ingredientes,
      hoy: HOY,
      pasoPorUnidad: { g: 500 },
    });
    expect(lista.find((a) => a.ingredienteId === "pasta")?.cantidad).toBe(500);
  });

  it("ignora los ingredientes que no están en el catálogo", () => {
    const raro = plato("Raro", [
      { ingredienteId: "desconocido", cantidadPorRacion: 100, opcional: false },
    ]);
    expect(
      calcularCompra({ comidas: [comida("X", raro, 1)], despensa: [], ingredientes, hoy: HOY }),
    ).toEqual([]);
  });

  it("se ordena como un supermercado: por sección y, dentro, alfabéticamente", () => {
    const todo = plato("Todo", [
      { ingredienteId: "leche", cantidadPorRacion: 100, opcional: false },
      { ingredienteId: "pollo", cantidadPorRacion: 100, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 100, opcional: false },
      { ingredienteId: "pasta", cantidadPorRacion: 100, opcional: false },
      { ingredienteId: "huevo", cantidadPorRacion: 1, opcional: false },
    ]);
    const lista = calcularCompra({
      comidas: [comida("X", todo, 1)],
      despensa: [],
      ingredientes,
      hoy: HOY,
    });
    expect(lista.map((a) => a.seccion)).toEqual([
      "fruta_verdura",
      "carne",
      "lacteos",
      "huevos",
      "despensa",
    ]);
  });

  it("el paso por defecto es 50 para g y ml y 1 para unidades", () => {
    expect(PASO_POR_UNIDAD).toEqual({ g: 50, ml: 50, ud: 1 });
  });
});

describe("aPayloadSincronizacion", () => {
  it("genera el formato que espera la base de datos, con el motivo recortado a 100 caracteres", () => {
    const payload = aPayloadSincronizacion([
      {
        ingredienteId: "pasta",
        nombre: "Pasta",
        unidad: "g",
        seccion: "despensa",
        cantidad: 150,
        motivos: ["Cena", "Stock mínimo"],
      },
      {
        ingredienteId: "huevo",
        nombre: "Huevo",
        unidad: "ud",
        seccion: "huevos",
        cantidad: 6,
        motivos: ["x".repeat(150)],
      },
    ]);
    expect(payload[0]).toEqual({
      ingrediente_id: "pasta",
      cantidad: 150,
      motivo: "Cena · Stock mínimo",
    });
    expect(payload[1]?.motivo).toHaveLength(100);
  });
});

// ---------------------------------------------------------------------------------------------
const idIng = fc.constantFrom("pasta", "tomate", "huevo", "leche", "pollo");
const arbDespensa = fc.uniqueArray(
  fc.record({
    ingredienteId: idIng,
    ubicacion: fc.constantFrom<"nevera" | "despensa" | "congelador">(
      "nevera",
      "despensa",
      "congelador",
    ),
    cantidad: fc.integer({ min: 0, max: 200_000 }).map((n) => n / 100),
    minimo: fc.option(
      fc.integer({ min: 0, max: 50_000 }).map((n) => n / 100),
      { nil: null },
    ),
    caducaEn: fc.option(fc.constantFrom("2026-10-30", "2026-11-05"), { nil: null }),
  }),
  { selector: (i) => `${i.ingredienteId}|${i.ubicacion}`, maxLength: 10 },
);
const arbPlato = fc.record({
  id: fc.constant("p"),
  nombre: fc.constant("P"),
  ingredientes: fc.uniqueArray(
    fc.record({
      ingredienteId: idIng,
      cantidadPorRacion: fc.integer({ min: 1, max: 30_000 }).map((n) => n / 100),
      opcional: fc.boolean(),
    }),
    { selector: (i) => i.ingredienteId, maxLength: 4 },
  ),
});
const arbComidas = fc.array(
  fc.record({
    etiqueta: fc.constantFrom("Cena L", "Cena M", "Cena X"),
    fecha: fc.constant(HOY),
    plato: arbPlato,
    raciones: fc.integer({ min: 1, max: 800 }).map((n) => n / 100),
  }),
  { maxLength: 5 },
);
const total = (l: ReturnType<typeof calcularCompra>) => l.reduce((s, a) => s + a.cantidad, 0);

describe("propiedades de la lista de la compra", () => {
  it("todo lo que se pide es positivo y múltiplo del paso de su unidad", () => {
    fc.assert(
      fc.property(arbComidas, arbDespensa, (comidas, despensa) => {
        for (const a of calcularCompra({ comidas, despensa, ingredientes, hoy: HOY })) {
          expect(a.cantidad).toBeGreaterThan(0);
          expect(
            Math.abs((a.cantidad / PASO_POR_UNIDAD[a.unidad]) % 1) < 1e-9 ||
              a.cantidad % PASO_POR_UNIDAD[a.unidad] === 0,
          ).toBe(true);
        }
      }),
      { numRuns: 400 },
    );
  });

  it("más stock nunca obliga a comprar más", () => {
    fc.assert(
      fc.property(
        arbComidas,
        arbDespensa,
        fc.integer({ min: 1, max: 100_000 }),
        (comidas, despensa, extra) => {
          // Más stock de pasta en el congelador (se suma a la fila si existe, o se crea una nueva).
          const existente = despensa.some(
            (i) => i.ingredienteId === "pasta" && i.ubicacion === "congelador",
          );
          const con = existente
            ? despensa.map((i) =>
                i.ingredienteId === "pasta" && i.ubicacion === "congelador"
                  ? { ...i, cantidad: i.cantidad + extra / 100 }
                  : i,
              )
            : [
                ...despensa,
                {
                  ingredienteId: "pasta",
                  ubicacion: "congelador" as const,
                  cantidad: extra / 100,
                  minimo: null,
                  caducaEn: null,
                },
              ];
          expect(
            total(calcularCompra({ comidas, despensa: con, ingredientes, hoy: HOY })),
          ).toBeLessThanOrEqual(
            total(calcularCompra({ comidas, despensa, ingredientes, hoy: HOY })),
          );
        },
      ),
      { numRuns: 400 },
    );
  });

  it("idempotencia: tras tirar lo caducado y comprar lo que pide la lista, ya no falta nada", () => {
    fc.assert(
      fc.property(arbComidas, arbDespensa, (comidas, despensa) => {
        const lista = calcularCompra({ comidas, despensa, ingredientes, hoy: HOY });
        // Flujo real: se tira lo caducado y se compra lo que pide la lista, todo en una operación.
        const { despensa: tras } = aplicarMovimientos(
          despensa,
          [
            ...descartarCaducados(despensa, HOY),
            ...lista.map((a) => ({
              ingredienteId: a.ingredienteId,
              ubicacion: "despensa" as const,
              delta: a.cantidad,
            })),
          ],
          HOY,
        );
        expect(calcularCompra({ comidas, despensa: tras, ingredientes, hoy: HOY })).toEqual([]);
      }),
      { numRuns: 400 },
    );
  });

  it("más raciones nunca reducen lo que hay que comprar", () => {
    fc.assert(
      fc.property(arbComidas, arbDespensa, (comidas, despensa) => {
        const doble = comidas.map((c) => ({ ...c, raciones: c.raciones * 2 }));
        expect(
          total(calcularCompra({ comidas: doble, despensa, ingredientes, hoy: HOY })),
        ).toBeGreaterThanOrEqual(
          total(calcularCompra({ comidas, despensa, ingredientes, hoy: HOY })),
        );
      }),
      { numRuns: 400 },
    );
  });
});
