import { describe, expect, it } from "vitest";
import { estadoInicialDemo } from "./datos-demo";
import {
  type Accion,
  type EstadoHogar,
  articulosPendientes,
  diasDelMenu,
  menuDeLaSemana,
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

describe("menú semanal", () => {
  it("planifica desde hoy hasta el domingo: 30 min entre semana, 60 el fin de semana", () => {
    const dias = diasDelMenu(estadoInicialDemo());
    expect(dias.map((d) => d.fecha)).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    expect(dias.map((d) => d.minutosMax)).toEqual([30, 30, 30, 60, 60]);
  });

  it("respeta las cenas ya elegidas y no ofrece su grupo a los días vecinos", () => {
    const m = menuDeLaSemana(estadoInicialDemo());
    expect(m.dias.find((d) => d.fecha === "2026-11-06")?.opciones.map((o) => o.plato.id)).toEqual([
      "tortilla",
    ]);
    const sabado = m.dias.find((d) => d.fecha === "2026-11-07")?.opciones ?? [];
    expect(sabado.length).toBeGreaterThan(0);
    expect(sabado.every((o) => o.plato.grupo !== "huevo")).toBe(true);
  });

  it("elegir una cena la guarda y cambia la lista de la compra", () => {
    const e0 = estadoInicialDemo();
    const e1 = aplicar(e0, { tipo: "menu/elegir", fecha: "2026-11-07", platoId: "salmon-plancha" });
    expect(e1.comidas.find((c) => c.fecha === "2026-11-07")?.plato.id).toBe("salmon-plancha");
    expect(pendientes(e1).salmon).toBe(400); // 120 g × 3 raciones = 360 g, redondeado a pasos de 50 g
    expect(pendientes(e0).salmon).toBeUndefined();
    // Cambiarla sustituye la anterior (una cena por día).
    const e2 = aplicar(e1, { tipo: "menu/elegir", fecha: "2026-11-07", platoId: "hamburguesas" });
    expect(e2.comidas.filter((c) => c.fecha === "2026-11-07")).toHaveLength(1);
    expect(pendientes(e2).salmon).toBeUndefined();
  });

  it("quitar una cena la deja sin decidir", () => {
    const e = aplicar(estadoInicialDemo(), { tipo: "menu/quitar", fecha: "2026-11-06" });
    expect(e.comidas.some((c) => c.fecha === "2026-11-06")).toBe(false);
    expect(menuDeLaSemana(e).dias.find((d) => d.fecha === "2026-11-06")?.opciones.length).toBe(3);
  });

  it("«hoy llego tarde» deja solo platos de 15 minutos o menos, y se puede revertir", () => {
    const e = aplicar(
      estadoInicialDemo(),
      { tipo: "menu/quitar", fecha: "2026-11-06" },
      { tipo: "menu/llegoTarde", fecha: "2026-11-06" },
    );
    const opciones = menuDeLaSemana(e).dias.find((d) => d.fecha === "2026-11-06")?.opciones ?? [];
    expect(opciones.length).toBeGreaterThan(0);
    expect(opciones.every((o) => o.plato.minutosActivos <= 15)).toBe(true);
    expect(aplicar(e, { tipo: "menu/llegoTarde", fecha: "2026-11-06" }).llegoTarde).toEqual([]);
  });

  it("la quincena planifica 15 días y ofrece algo cada día sin agotar el catálogo", () => {
    const e = aplicar(estadoInicialDemo(), { tipo: "menu/horizonte", horizonte: "quincena" });
    const dias = diasDelMenu(e);
    expect(dias).toHaveLength(15);
    expect(dias[0]?.fecha).toBe("2026-11-04");
    expect(dias[14]?.fecha).toBe("2026-11-18");
    const m = menuDeLaSemana(e);
    expect(m.dias.every((d) => d.opciones.length > 0)).toBe(true);
  });

  it("elegir toda la quincena adelanta la compra con las cantidades sumadas", () => {
    let e = aplicar(estadoInicialDemo(), { tipo: "menu/horizonte", horizonte: "quincena" });
    const antes = pendientes(e);
    // Misma cena (salmón) con 7 días de separación: se suman las dos necesidades.
    e = aplicar(
      e,
      { tipo: "menu/elegir", fecha: "2026-11-07", platoId: "salmon-plancha" },
      { tipo: "menu/elegir", fecha: "2026-11-14", platoId: "salmon-plancha" },
    );
    expect(antes.salmon).toBeUndefined();
    expect(pendientes(e).salmon).toBe(750); // 2 × 360 g = 720 g, a pasos de 50
  });

  it("un plato elegido no se vuelve a ofrecer en los 7 días siguientes, pero sí después", () => {
    let e = aplicar(estadoInicialDemo(), { tipo: "menu/horizonte", horizonte: "quincena" });
    e = aplicar(e, { tipo: "menu/elegir", fecha: "2026-11-07", platoId: "salmon-plancha" });
    const ofrecidoEn = (fecha: string) =>
      menuDeLaSemana(e)
        .dias.find((d) => d.fecha === fecha)
        ?.opciones.map((o) => o.plato.id) ?? [];
    for (const f of ["2026-11-08", "2026-11-10", "2026-11-13"]) {
      expect(ofrecidoEn(f)).not.toContain("salmon-plancha");
    }
  });

  it("importar el menú del cole añade días sin borrar los anteriores", () => {
    const e0 = estadoInicialDemo();
    const e1 = aplicar(e0, {
      tipo: "cole/importar",
      dias: { "2026-12-01": { primero: "pasta", segundo: "carne" } },
    });
    expect(e1.colegio["2026-12-01"]).toEqual({ primero: "pasta", segundo: "carne" });
    expect(e1.colegio["2026-11-04"]).toEqual(e0.colegio["2026-11-04"]);
    expect(e1.aviso?.texto).toContain("1 días");
  });

  it("el menú del cole de demo sale del lector y cubre todo noviembre", () => {
    const e = estadoInicialDemo();
    expect(Object.keys(e.colegio)).toHaveLength(19);
    expect(e.colegio["2026-11-12"]).toMatchObject({ primero: "legumbre", segundo: "huevo" });
  });

  it("ignora platos o días que no existen", () => {
    const e = estadoInicialDemo();
    expect(reducir(e, { tipo: "menu/elegir", fecha: "2026-11-07", platoId: "nada" })).toBe(e);
    expect(reducir(e, { tipo: "menu/elegir", fecha: "2026-12-25", platoId: "tortilla" })).toBe(e);
  });
});

describe("valoraciones", () => {
  it("la media de las valoraciones por persona se guarda en el plato y la usa el motor", () => {
    let e = aplicar(
      estadoInicialDemo(),
      { tipo: "valorar", platoId: "crema-calabacin", personaId: "diego", puntos: 2 },
      { tipo: "valorar", platoId: "crema-calabacin", personaId: "ana", puntos: 5 },
    );
    expect(e.platos.find((p) => p.id === "crema-calabacin")?.valoracion).toBe(3.5);
    expect(e.valoraciones["crema-calabacin"]).toEqual({ diego: 2, ana: 5 });
    // Cambiar la puntuación de una persona sustituye la suya.
    e = aplicar(e, { tipo: "valorar", platoId: "crema-calabacin", personaId: "diego", puntos: 4 });
    expect(e.platos.find((p) => p.id === "crema-calabacin")?.valoracion).toBe(4.5);
  });

  it("repetir la misma puntuación o poner 0 la quita; sin valoraciones no hay media", () => {
    const base = aplicar(estadoInicialDemo(), {
      tipo: "valorar",
      platoId: "tortilla",
      personaId: "lucia",
      puntos: 5,
    });
    const quitada = aplicar(base, {
      tipo: "valorar",
      platoId: "tortilla",
      personaId: "lucia",
      puntos: 5,
    });
    expect(quitada.platos.find((p) => p.id === "tortilla")?.valoracion).toBeNull();
    const cero = aplicar(base, {
      tipo: "valorar",
      platoId: "tortilla",
      personaId: "lucia",
      puntos: 0,
    });
    expect(cero.valoraciones.tortilla).toEqual({});
  });

  it("ignora valoraciones inválidas", () => {
    const e = estadoInicialDemo();
    for (const accion of [
      { tipo: "valorar", platoId: "nada", personaId: "ana", puntos: 3 },
      { tipo: "valorar", platoId: "tortilla", personaId: "nadie", puntos: 3 },
      { tipo: "valorar", platoId: "tortilla", personaId: "ana", puntos: 6 },
      { tipo: "valorar", platoId: "tortilla", personaId: "ana", puntos: 2.5 },
      { tipo: "valorar", platoId: "tortilla", personaId: "ana", puntos: -1 },
    ] as const) {
      expect(reducir(e, accion)).toBe(e);
    }
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
      { tipo: "menu/elegir", fecha: "2026-11-07", platoId: "salmon-plancha" },
      { tipo: "menu/quitar", fecha: "2026-11-06" },
      { tipo: "menu/llegoTarde", fecha: "2026-11-05" },
    ];
    acciones.reduce(reducir, inicial);
    expect(JSON.stringify(inicial)).toBe(foto);
  });
});
