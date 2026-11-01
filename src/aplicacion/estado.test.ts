import { describe, expect, it } from "vitest";
import { estadoInicialDemo } from "./datos-demo";
import {
  type Accion,
  type EstadoHogar,
  articulosPendientes,
  reducir,
  repartoDeLaSemana,
  ubicacionDeCompra,
} from "./estado";

const aplicar = (e: EstadoHogar, ...acciones: Accion[]) => acciones.reduce(reducir, e);
const cantidad = (e: EstadoHogar, id: string, ubi: string) =>
  e.despensa.find((i) => i.ingredienteId === id && i.ubicacion === ubi)?.cantidad;
const pendientes = (e: EstadoHogar) =>
  Object.fromEntries(articulosPendientes(e).map((a) => [a.ingredienteId, a.cantidad]));
const conStock = (e: EstadoHogar) =>
  e.despensa
    .filter((i) => i.cantidad > 0)
    .map((i) => `${i.ingredienteId}|${i.ubicacion}|${i.cantidad}|${i.caducaEn}`)
    .sort();

describe("lista de la compra derivada del menú, la despensa y los mínimos", () => {
  it("pide lo que falta para las cenas elegidas y para llegar a los mínimos", () => {
    expect(pendientes(estadoInicialDemo())).toEqual({
      calabacin: 600, // crema: 200 g × 3 raciones
      arroz: 100, // 210 g − 150 g que hay, en pasos de 50
      huevo: 8, // tortilla 6 + mínimo 6 − 4 que hay
      leche: 300, // por debajo del mínimo de 1000 ml
    });
  });

  it("cada ingrediente tiene su sitio: lo fresco a la nevera, lo congelado al congelador", () => {
    const e = estadoInicialDemo();
    const ing = (id: string) => e.ingredientes.find((i) => i.id === id)!;
    expect(ubicacionDeCompra(ing("pollo"))).toBe("nevera");
    expect(ubicacionDeCompra(ing("merluza"))).toBe("congelador");
    expect(ubicacionDeCompra(ing("arroz"))).toBe("despensa");
  });
});

describe("comprar y deshacer", () => {
  it("comprar mete el artículo en la despensa y lo quita de lo pendiente", () => {
    const e = aplicar(estadoInicialDemo(), { tipo: "comprar", ingredienteId: "calabacin" });
    expect(cantidad(e, "calabacin", "nevera")).toBe(600);
    expect(pendientes(e)).not.toHaveProperty("calabacin");
    expect(e.compras).toHaveLength(1);
    expect(e.aviso).toMatchObject({ tipo: "ok", operacionId: expect.any(String) });
  });

  it("deshacer la compra deja la despensa idéntica y el artículo vuelve a estar pendiente", () => {
    const inicial = estadoInicialDemo();
    const comprada = aplicar(inicial, { tipo: "comprar", ingredienteId: "arroz" });
    const operacionId = comprada.compras[0]?.operacionId ?? "";
    const deshecha = reducir(comprada, { tipo: "deshacer", operacionId });
    expect(conStock(deshecha)).toEqual(conStock(inicial));
    expect(deshecha.compras).toEqual([]);
    expect(pendientes(deshecha)).toHaveProperty("arroz", 100);
  });

  it("no se deshace dos veces la misma operación", () => {
    const comprada = aplicar(estadoInicialDemo(), { tipo: "comprar", ingredienteId: "arroz" });
    const operacionId = comprada.compras[0]?.operacionId ?? "";
    const una = reducir(comprada, { tipo: "deshacer", operacionId });
    expect(reducir(una, { tipo: "deshacer", operacionId })).toBe(una);
  });

  it("si hay stock caducado en esa fila, se tira antes de meter el nuevo y deshacer lo restaura con su caducidad", () => {
    const base = estadoInicialDemo();
    const inicial: EstadoHogar = {
      ...base,
      despensa: base.despensa.map((i) =>
        i.ingredienteId === "leche" ? { ...i, caducaEn: "2026-11-01" } : i,
      ),
    };
    // La leche caducada no cuenta: hace falta toda (mínimo 1000 ml).
    expect(pendientes(inicial)).toHaveProperty("leche", 1000);
    const comprada = aplicar(inicial, { tipo: "comprar", ingredienteId: "leche" });
    expect(cantidad(comprada, "leche", "nevera")).toBe(1000);
    expect(comprada.despensa.find((i) => i.ingredienteId === "leche")?.caducaEn).toBeNull();

    const operacionId = comprada.compras[0]?.operacionId ?? "";
    const deshecha = reducir(comprada, { tipo: "deshacer", operacionId });
    expect(conStock(deshecha)).toEqual(conStock(inicial)); // vuelve la leche caducada, CON su caducidad
  });

  it("no se puede deshacer una compra cuyo contenido ya se ha consumido", () => {
    const comprada = aplicar(estadoInicialDemo(), { tipo: "comprar", ingredienteId: "leche" }); // 700 + 300 = 1000
    const consumida = reducir(comprada, {
      tipo: "ajustar",
      ingredienteId: "leche",
      ubicacion: "nevera",
      delta: -900,
    });
    const operacionId = comprada.compras[0]?.operacionId ?? "";
    const intento = reducir(consumida, { tipo: "deshacer", operacionId });
    expect(intento.aviso).toMatchObject({
      tipo: "error",
      texto: expect.stringContaining("No se puede deshacer"),
    });
    expect(cantidad(intento, "leche", "nevera")).toBe(100);
    expect(intento.compras).toHaveLength(1);
  });

  it("comprar algo que no está pendiente no hace nada", () => {
    const e = estadoInicialDemo();
    expect(reducir(e, { tipo: "comprar", ingredienteId: "pasta" })).toBe(e);
    expect(reducir(e, { tipo: "comprar", ingredienteId: "inexistente" })).toBe(e);
  });
});

describe("cocinar", () => {
  it("descuenta lo que pide el plato y avisa de lo que falta", () => {
    const e = aplicar(estadoInicialDemo(), {
      tipo: "cocinar",
      platoId: "arroz-pollo",
      raciones: 3,
    });
    expect(cantidad(e, "pollo", "nevera")).toBe(0);
    expect(cantidad(e, "arroz", "despensa")).toBe(0);
    expect(e.aviso?.texto).toContain("Faltaba: Arroz"); // pedía 210 g y había 150
  });

  it("un plato con todo disponible no avisa de faltantes", () => {
    const e = aplicar(estadoInicialDemo(), {
      tipo: "cocinar",
      platoId: "merluza-patata",
      raciones: 3,
    });
    expect(e.aviso?.texto).not.toContain("Faltaba");
    expect(cantidad(e, "merluza", "congelador")).toBe(0);
    expect(cantidad(e, "patata", "despensa")).toBe(1500 - 450);
  });

  it("deshacer devuelve exactamente lo descontado", () => {
    const inicial = estadoInicialDemo();
    const cocinado = aplicar(inicial, { tipo: "cocinar", platoId: "pasta-tomate", raciones: 3 });
    const deshecho = reducir(cocinado, {
      tipo: "deshacer",
      operacionId: cocinado.aviso?.operacionId ?? "",
    });
    expect(conStock(deshecho)).toEqual(conStock(inicial));
  });

  it("sin nada en la despensa, avisa en lugar de fingir que cocina", () => {
    const base = estadoInicialDemo();
    const vacio: EstadoHogar = { ...base, despensa: [] };
    const e = reducir(vacio, { tipo: "cocinar", platoId: "tortilla", raciones: 3 });
    expect(e.aviso).toMatchObject({ tipo: "error" });
    expect(e.operaciones).toEqual([]);
  });

  it("ignora platos desconocidos y raciones no positivas", () => {
    const e = estadoInicialDemo();
    expect(reducir(e, { tipo: "cocinar", platoId: "nada", raciones: 3 })).toBe(e);
    expect(reducir(e, { tipo: "cocinar", platoId: "tortilla", raciones: 0 })).toBe(e);
  });
});

describe("ajustes y caducados", () => {
  it("ajustar suma o resta y avisa si no hay stock suficiente", () => {
    const e = estadoInicialDemo();
    expect(
      cantidad(
        reducir(e, { tipo: "ajustar", ingredienteId: "pan", ubicacion: "despensa", delta: 1 }),
        "pan",
        "despensa",
      ),
    ).toBe(2);
    const sin = reducir(e, {
      tipo: "ajustar",
      ingredienteId: "pan",
      ubicacion: "despensa",
      delta: -5,
    });
    expect(sin.aviso).toMatchObject({ tipo: "error" });
    expect(cantidad(sin, "pan", "despensa")).toBe(1);
  });

  it("sumar a una fila con stock caducado tira lo caducado primero", () => {
    const e = reducir(estadoInicialDemo(), {
      tipo: "ajustar",
      ingredienteId: "yogur",
      ubicacion: "nevera",
      delta: 2,
    });
    expect(cantidad(e, "yogur", "nevera")).toBe(2); // los 3 caducados se tiraron
  });

  it("tirar lo caducado vacía la fila y deshacer lo restaura con su caducidad", () => {
    const inicial = estadoInicialDemo();
    const tirado = reducir(inicial, {
      tipo: "tirarCaducado",
      ingredienteId: "yogur",
      ubicacion: "nevera",
    });
    expect(cantidad(tirado, "yogur", "nevera")).toBe(0);
    const restaurado = reducir(tirado, {
      tipo: "deshacer",
      operacionId: tirado.aviso?.operacionId ?? "",
    });
    expect(conStock(restaurado)).toEqual(conStock(inicial));
  });

  it("tirar lo caducado de algo que no está caducado no hace nada", () => {
    const e = estadoInicialDemo();
    expect(
      reducir(e, { tipo: "tirarCaducado", ingredienteId: "pasta", ubicacion: "despensa" }),
    ).toBe(e);
  });
});

describe("artículos manuales", () => {
  it("se añaden, se marcan y se borran", () => {
    let e = aplicar(estadoInicialDemo(), { tipo: "manual/anadir", nombre: "  Yogures  " });
    const nuevo = e.manuales.find((m) => m.nombre === "Yogures");
    expect(nuevo).toBeDefined();
    e = reducir(e, { tipo: "manual/alternar", id: nuevo?.id ?? "" });
    expect(e.manuales.find((m) => m.id === nuevo?.id)?.comprado).toBe(true);
    e = reducir(e, { tipo: "manual/borrar", id: nuevo?.id ?? "" });
    expect(e.manuales.find((m) => m.id === nuevo?.id)).toBeUndefined();
  });

  it("rechaza nombres vacíos o demasiado largos con un aviso", () => {
    const e = estadoInicialDemo();
    expect(reducir(e, { tipo: "manual/anadir", nombre: "   " }).aviso?.tipo).toBe("error");
    expect(reducir(e, { tipo: "manual/anadir", nombre: "x".repeat(81) }).manuales).toHaveLength(
      e.manuales.length,
    );
  });
});

describe("avisos", () => {
  it("cerrar el aviso lo quita, y si no hay ninguno no cambia el estado", () => {
    const conAviso = aplicar(estadoInicialDemo(), { tipo: "comprar", ingredienteId: "arroz" });
    expect(reducir(conAviso, { tipo: "cerrarAviso" }).aviso).toBeNull();
    const sin = estadoInicialDemo();
    expect(reducir(sin, { tipo: "cerrarAviso" })).toBe(sin);
  });
});

describe("reparto de la carga", () => {
  it("al inicio Ana carga con mucho más, sobre todo por el trabajo invisible de planificar", () => {
    const r = repartoDeLaSemana(estadoInicialDemo());
    const ana = r.personas.find((p) => p.personaId === "ana");
    const diego = r.personas.find((p) => p.personaId === "diego");
    expect(ana).toMatchObject({ ejecucionMin: 195, planificacionMin: 100, totalMin: 295 });
    expect(diego).toMatchObject({ ejecucionMin: 95, planificacionMin: 10, totalMin: 105 });
    expect(r.sinResponsable.map((c) => c.id)).toEqual(["sabanas"]);
    expect(r.diferenciaPuntos).toBe(47.5);
  });

  it("proponer una rotación reduce la diferencia, respeta lo ya hecho y reparte todas las ocurrencias", () => {
    const inicial = estadoInicialDemo();
    const antes = repartoDeLaSemana(inicial).diferenciaPuntos;
    const e = reducir(inicial, { tipo: "reparto/proponerRotacion" });
    expect(repartoDeLaSemana(e).diferenciaPuntos).toBeLessThan(antes);

    // Los turnos ya hechos se conservan tal cual.
    for (const t of inicial.turnos.filter((x) => x.estado === "hecho")) {
      expect(e.turnos).toContainEqual(t);
    }
    // Cada ocurrencia tiene exactamente un turno.
    const claves = e.turnos.map((t) => `${t.cargaId}|${t.fecha}`);
    expect(new Set(claves).size).toBe(claves.length);
    for (const o of inicial.ocurrencias) expect(claves).toContain(`${o.cargaId}|${o.fecha}`);
    expect(e.aviso?.texto).toContain("turnos repartidos");
  });

  it("asignar un responsable lo quita de «sin responsable»", () => {
    const e = reducir(estadoInicialDemo(), {
      tipo: "reparto/asignarResponsable",
      cargaId: "sabanas",
      personaId: "diego",
    });
    expect(repartoDeLaSemana(e).sinResponsable).toEqual([]);
    const sin = reducir(e, {
      tipo: "reparto/asignarResponsable",
      cargaId: "sabanas",
      personaId: null,
    });
    expect(repartoDeLaSemana(sin).sinResponsable.map((c) => c.id)).toEqual(["sabanas"]);
  });

  it("cambiar el estado de un turno lo refleja en el reparto (un turno saltado no cuenta)", () => {
    const e = reducir(estadoInicialDemo(), {
      tipo: "reparto/estadoTurno",
      cargaId: "compra",
      fecha: "2026-11-07",
      estado: "saltado",
    });
    const ana = repartoDeLaSemana(e).personas.find((p) => p.personaId === "ana");
    expect(ana?.ejecucionMin).toBe(135); // 195 − 60 de la compra saltada
  });
});

describe("pureza", () => {
  it("el reductor nunca modifica el estado anterior", () => {
    const inicial = estadoInicialDemo();
    const foto = JSON.stringify(inicial);
    const acciones: Accion[] = [
      { tipo: "comprar", ingredienteId: "arroz" },
      { tipo: "cocinar", platoId: "pasta-tomate", raciones: 3 },
      { tipo: "ajustar", ingredienteId: "pan", ubicacion: "despensa", delta: 1 },
      { tipo: "tirarCaducado", ingredienteId: "yogur", ubicacion: "nevera" },
      { tipo: "manual/anadir", nombre: "x" },
      { tipo: "reparto/proponerRotacion" },
    ];
    acciones.reduce(reducir, inicial);
    expect(JSON.stringify(inicial)).toBe(foto);
  });
});
