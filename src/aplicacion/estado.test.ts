import { describe, expect, it } from "vitest";
import { sumarDias } from "@/dominio/fechas";
import { esUuid } from "@/dominio/identificadores";
import { type Cumple, estadoVigente } from "@/dominio/cumples";
import { estadoInicialDemo } from "./datos-demo";
import {
  type Accion,
  type EstadoHogar,
  articulosPendientes,
  articulosQuitados,
  cenaDeEmergenciaHoy,
  diasDelMenu,
  menuDeLaSemana,
  normalizar,
  opcionesParaFecha,
  comidasDe,
  conIdBase,
  idDePlatoRapido,
  cumplesProximos,
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
    expect(reducir(e, { tipo: "menu/elegir", fecha: "2027-06-01", platoId: "tortilla" })).toBe(e);
    expect(reducir(e, { tipo: "menu/elegir", fecha: "2026-11-01", platoId: "tortilla" })).toBe(e); // ya pasó
    expect(opcionesParaFecha(e, "2027-06-01")).toEqual([]);
  });
});

describe("cena de emergencia", () => {
  it("propone platos de 15 minutos o menos y pone primero los que se pueden hacer ya", () => {
    const r = cenaDeEmergenciaHoy(estadoInicialDemo());
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((o) => o.plato.minutosActivos <= 15)).toBe(true);
    const primeraIncompleta = r.findIndex((o) => !o.completa);
    expect(
      r.slice(primeraIncompleta === -1 ? r.length : primeraIncompleta).every((o) => !o.completa),
    ).toBe(true);
  });

  it("cocinar la emergencia elige la cena de hoy, descuenta la despensa y se puede deshacer", () => {
    const e0 = estadoInicialDemo();
    const completa = cenaDeEmergenciaHoy(e0).find((o) => o.completa);
    expect(completa).toBeDefined();
    const e1 = aplicar(e0, { tipo: "emergencia/cocinar", platoId: completa?.plato.id ?? "" });
    expect(e1.comidas.find((c) => c.fecha === e1.hoy)?.plato.id).toBe(completa?.plato.id);
    expect(e1.operaciones.at(-1)?.tipo).toBe("cocinar");
    expect(e1.despensa).not.toEqual(e0.despensa);
    const e2 = aplicar(e1, { tipo: "deshacer", operacionId: e1.operaciones.at(-1)?.id ?? "" });
    expect(conStock(e2)).toEqual(conStock(e0));
  });

  it("un plato desconocido no hace nada", () => {
    const e = estadoInicialDemo();
    expect(reducir(e, { tipo: "emergencia/cocinar", platoId: "nada" })).toBe(e);
  });
});

describe("catálogo de platos", () => {
  const nuevo = {
    nombre: "Pan con tomate",
    grupo: "otro" as const,
    minutosActivos: 5,
    pasos: null,
    ingredientes: [
      { ingredienteId: "pan", cantidadPorRacion: 1, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 80, opcional: false },
    ],
  };

  it("añade un plato nuevo, lo edita conservando valoración y lo propone", () => {
    const e1 = aplicar(estadoInicialDemo(), { tipo: "plato/guardar", plato: nuevo });
    const creado = e1.platos.at(-1);
    expect(creado).toMatchObject({ nombre: "Pan con tomate", ultimaVez: null, valoracion: null });
    expect(e1.aviso?.texto).toContain("Plato añadido");
    const e2 = aplicar(
      e1,
      { tipo: "valorar", platoId: creado?.id ?? "", personaId: "ana", puntos: 4 },
      { tipo: "plato/guardar", id: creado?.id, plato: { ...nuevo, minutosActivos: 10 } },
    );
    expect(e2.platos.find((p) => p.id === creado?.id)).toMatchObject({
      minutosActivos: 10,
      valoracion: 4,
    });
    expect(e2.platos).toHaveLength(e1.platos.length);
  });

  it("rechaza platos inválidos y nombres repetidos (sin tildes ni mayúsculas)", () => {
    const e = estadoInicialDemo();
    const malo = reducir(e, { tipo: "plato/guardar", plato: { ...nuevo, ingredientes: [] } });
    expect(malo.platos).toBe(e.platos);
    expect(malo.aviso?.tipo).toBe("error");
    const repetido = reducir(e, {
      tipo: "plato/guardar",
      plato: { ...nuevo, nombre: "TORTILLA FRANCESA" },
    });
    expect(repetido.aviso?.texto).toContain("Ya tienes un plato");
    expect(repetido.platos).toBe(e.platos);
    expect(reducir(e, { tipo: "plato/guardar", id: "no-existe", plato: nuevo })).toBe(e);
  });

  it("un plato editado actualiza las cenas elegidas y la compra", () => {
    const e0 = estadoInicialDemo();
    const antes = pendientes(e0);
    const tortilla = e0.platos.find((p) => p.id === "tortilla");
    const e1 = aplicar(e0, {
      tipo: "plato/guardar",
      id: "tortilla",
      plato: {
        nombre: "Tortilla francesa",
        grupo: "huevo",
        minutosActivos: 10,
        pasos: null,
        ingredientes: [{ ingredienteId: "huevo", cantidadPorRacion: 6, opcional: false }],
      },
    });
    expect(tortilla).toBeDefined();
    expect(
      e1.comidas.find((c) => c.plato.id === "tortilla")?.plato.ingredientes[0]?.cantidadPorRacion,
    ).toBe(6);
    expect(pendientes(e1).huevo).toBeGreaterThan(antes.huevo ?? 0);
  });

  it("«no proponer» saca el plato del motor y de la emergencia, y se revierte", () => {
    const e = aplicar(estadoInicialDemo(), { tipo: "menu/quitar", fecha: "2026-11-06" });
    const ids = (x: EstadoHogar) =>
      menuDeLaSemana(x).dias.flatMap((d) => d.opciones.map((o) => o.plato.id));
    const objetivo = ids(e)[0] ?? "";
    const oculto = aplicar(e, { tipo: "plato/proponer", id: objetivo, proponer: false });
    expect(ids(oculto)).not.toContain(objetivo);
    expect(cenaDeEmergenciaHoy(oculto).map((o) => o.plato.id)).not.toContain(objetivo);
    expect(
      ids(aplicar(oculto, { tipo: "plato/proponer", id: objetivo, proponer: true })),
    ).toContain(objetivo);
    expect(reducir(e, { tipo: "plato/proponer", id: "nada", proponer: true })).toBe(e);
  });

  it("borra un plato libre pero no uno elegido en el menú", () => {
    const e = estadoInicialDemo();
    const elegido = reducir(e, { tipo: "plato/borrar", id: "tortilla" });
    expect(elegido.platos).toBe(e.platos);
    expect(elegido.aviso?.tipo).toBe("error");
    const libre = aplicar(
      e,
      { tipo: "valorar", platoId: "pisto-huevo", personaId: "ana", puntos: 3 },
      { tipo: "plato/borrar", id: "pisto-huevo" },
    );
    expect(libre.platos.some((p) => p.id === "pisto-huevo")).toBe(false);
    expect(libre.valoraciones["pisto-huevo"]).toBeUndefined();
    expect(reducir(e, { tipo: "plato/borrar", id: "nada" })).toBe(e);
  });

  it("crea ingredientes nuevos y rechaza repetidos o inválidos", () => {
    const e1 = aplicar(estadoInicialDemo(), {
      tipo: "ingrediente/crear",
      ingrediente: { nombre: "Lima", unidad: "ud", seccion: "fruta_verdura" },
    });
    expect(e1.ingredientes.at(-1)).toMatchObject({ nombre: "Lima", unidad: "ud" });
    const dup = reducir(e1, {
      tipo: "ingrediente/crear",
      ingrediente: { nombre: "calabacin", unidad: "g", seccion: "fruta_verdura" },
    });
    expect(dup.aviso?.texto).toBe("Ese ingrediente ya existe.");
    const mal = reducir(e1, {
      tipo: "ingrediente/crear",
      ingrediente: { nombre: "L", unidad: "g", seccion: "otros" },
    });
    expect(mal.aviso?.tipo).toBe("error");
    expect(mal.ingredientes).toBe(e1.ingredientes);
  });
});

describe("calendario", () => {
  it("se puede planificar más allá de la semana (hasta 60 días) y hay opciones", () => {
    const e0 = estadoInicialDemo();
    const opciones = opcionesParaFecha(e0, "2026-12-10");
    expect(opciones.length).toBeGreaterThan(0);
    const e1 = aplicar(e0, {
      tipo: "menu/elegir",
      fecha: "2026-12-10",
      platoId: opciones[0]?.plato.id ?? "",
    });
    expect(e1.comidas.some((c) => c.fecha === "2026-12-10")).toBe(true);
  });

  it("respeta el menú del cole de cualquier día del mes", () => {
    const e = estadoInicialDemo();
    // 12 de noviembre: legumbre + huevo → conviene verdura, pasta, arroz, carne o pescado.
    const grupos = opcionesParaFecha(e, "2026-11-12").map((o) => o.plato.grupo);
    expect(grupos.length).toBeGreaterThan(0);
    for (const g of grupos) expect(["verdura", "pasta", "arroz", "carne", "pescado"]).toContain(g);
  });
});

describe("cumpleaños y regalos", () => {
  const con = (...a: Accion[]) => aplicar(estadoInicialDemo(), ...a);
  const alba = {
    tipo: "cumple/anadir",
    nombre: "Alba",
    dia: 12,
    mes: 3,
    anio: 2017,
    relacion: "familia",
  } as const;

  it("guarda un cumpleaños, enlaza con la persona del hogar y no lo repite", () => {
    const e = con(alba);
    expect(e.cumples).toHaveLength(1);
    expect(e.cumples[0]).toMatchObject({
      nombre: "Alba",
      dia: 12,
      mes: 3,
      anio: 2017,
      personaId: "alba",
      estado: "sin-pensar",
    });
    const repetido = aplicar(e, { ...alba, nombre: "alba" });
    expect(repetido.cumples).toHaveLength(1);
    expect(repetido.aviso?.texto).toBe("alba ya estaba.");
  });

  it("rechaza fechas imposibles y nombres vacíos", () => {
    for (const mala of [
      { ...alba, dia: 31, mes: 4 },
      { ...alba, mes: 13 },
      { ...alba, dia: 0 },
      { ...alba, nombre: "  " },
    ]) {
      expect(con(mala).cumples).toEqual([]);
    }
  });

  it("importa varias personas de una vez y avisa de lo que no entiende", () => {
    const e = con({
      tipo: "cumple/importar",
      relacion: "cole",
      texto: "Lucas 3/5/2017, Marta 14/10\nRaro sin fecha",
    });
    expect(e.cumples.map((c) => [c.nombre, c.relacion])).toEqual([
      ["Lucas", "cole"],
      ["Marta", "cole"],
    ]);
    expect(e.aviso?.texto).toBe("Guardados 2. No he entendido: Raro sin fecha.");
    expect(con({ tipo: "cumple/importar", relacion: "cole", texto: "nada" }).aviso?.tipo).toBe(
      "error",
    );
  });

  it("las ideas se añaden sin repetir, pasan el estado a «idea» y se quitan", () => {
    let e = con(alba);
    const id = e.cumples[0]?.id ?? "";
    e = aplicar(
      e,
      { tipo: "cumple/idea", id, texto: "Libro de aventuras" },
      { tipo: "cumple/idea", id, texto: "libro de aventuras" },
      { tipo: "cumple/idea", id, texto: "  " },
    );
    expect(e.cumples[0]?.ideas).toEqual(["Libro de aventuras"]);
    expect(e.cumples[0]?.estado).toBe("idea");
    expect(
      aplicar(e, { tipo: "cumple/quitarIdea", id, texto: "Libro de aventuras" }).cumples[0]?.ideas,
    ).toEqual([]);
  });

  it("el estado del regalo es del año de la próxima celebración y deja de avisar al comprarlo", () => {
    let e = con({ ...alba, dia: 20, mes: 11 }); // en 16 días desde el 4 de noviembre
    expect(cumplesProximos(e)).toHaveLength(1);
    expect(cumplesProximos(e)[0]).toMatchObject({ dias: 16, urgencia: "pensar", edad: 9 });
    e = aplicar(e, { tipo: "cumple/estado", id: e.cumples[0]?.id ?? "", estado: "comprado" });
    expect(e.cumples[0]?.anioEstado).toBe(2026);
    expect(cumplesProximos(e)).toEqual([]);
    // Al año siguiente vuelve a empezar de cero.
    const otroAnio = aplicar(e, { tipo: "hogar/hoy", fecha: "2026-11-25" });
    expect(estadoVigente(otroAnio.cumples[0] as Cumple, otroAnio.hoy)).toBe("sin-pensar");
  });

  it("borra un cumpleaños", () => {
    const e = con(alba);
    expect(aplicar(e, { tipo: "cumple/borrar", id: e.cumples[0]?.id ?? "" }).cumples).toEqual([]);
  });
});

describe("tareas por persona", () => {
  const con = (...a: Accion[]) => aplicar(estadoInicialDemo(), ...a);

  it("añade varias tareas a una persona, con su frecuencia, sin repetir", () => {
    const e = con({
      tipo: "tarea/anadir",
      personaId: "alba",
      texto: "deberes, recoger mesa y dientes",
      frecuencia: "diaria",
    });
    expect(e.tareas.map((t) => [t.personaId, t.texto, t.frecuencia])).toEqual([
      ["alba", "Deberes", "diaria"],
      ["alba", "Recoger mesa", "diaria"],
      ["alba", "Dientes", "diaria"],
    ]);
    expect(e.aviso?.texto).toBe("Añadido a Alba: Deberes, Recoger mesa, Dientes.");
    const repetida = aplicar(e, {
      tipo: "tarea/anadir",
      personaId: "alba",
      texto: "deberes",
      frecuencia: "diaria",
    });
    expect(repetida.tareas).toHaveLength(3);
    expect(repetida.aviso?.texto).toBe("Ya estaba en la lista.");
    // Misma tarea para otra persona o con otra frecuencia sí se admite.
    expect(
      aplicar(e, {
        tipo: "tarea/anadir",
        personaId: "emma",
        texto: "deberes",
        frecuencia: "diaria",
      }).tareas,
    ).toHaveLength(4);
    expect(
      aplicar(e, {
        tipo: "tarea/anadir",
        personaId: "alba",
        texto: "deberes",
        frecuencia: "puntual",
      }).tareas,
    ).toHaveLength(4);
  });

  it("rechaza persona inexistente, vacío o textos demasiado largos", () => {
    expect(
      con({ tipo: "tarea/anadir", personaId: "nadie", texto: "x", frecuencia: "puntual" }).tareas,
    ).toEqual([]);
    expect(
      con({ tipo: "tarea/anadir", personaId: "ana", texto: " , ", frecuencia: "puntual" }).aviso
        ?.tipo,
    ).toBe("error");
    expect(
      con({ tipo: "tarea/anadir", personaId: "ana", texto: "x".repeat(81), frecuencia: "puntual" })
        .tareas,
    ).toEqual([]);
  });

  it("marcar, desmarcar y borrar; una diaria vuelve a estar pendiente al día siguiente", () => {
    let e = con({ tipo: "tarea/anadir", personaId: "ana", texto: "Cocina", frecuencia: "diaria" });
    const id = e.tareas[0]?.id ?? "";
    e = aplicar(e, { tipo: "tarea/alternar", id });
    expect(e.tareas[0]?.hechas).toEqual([e.hoy]);
    const mañana = aplicar(e, { tipo: "hogar/hoy", fecha: "2026-11-05" });
    expect(estaHechaHoy(mañana, id)).toBe(false);
    expect(aplicar(e, { tipo: "tarea/alternar", id }).tareas[0]?.hechas).toEqual([]);
    expect(aplicar(e, { tipo: "tarea/borrar", id }).tareas).toEqual([]);
  });
});
describe("estrellas y premios (D-117)", () => {
  const base = () => {
    let e = aplicar(estadoInicialDemo(), {
      tipo: "tarea/anadir",
      personaId: "ana",
      texto: "Cocina, Mesa, Cama",
      frecuencia: "diaria",
    });
    for (const t of e.tareas) e = aplicar(e, { tipo: "tarea/alternar", id: t.id });
    return aplicar(e, { tipo: "premio/guardar", nombre: "Peli", coste: 2, emoji: "🎬" });
  };

  it("canjear resta estrellas y no se puede sin saldo", () => {
    let e = base();
    const premio = e.premios[0]?.id ?? "";
    e = aplicar(e, { tipo: "premio/canjear", premioId: premio, personaId: "ana" });
    expect(e.canjes).toHaveLength(1);
    expect(e.aviso?.tipo).toBe("ok");
    e = aplicar(e, { tipo: "premio/canjear", premioId: premio, personaId: "ana" });
    expect(e.canjes).toHaveLength(1); // le quedaba 1 y cuesta 2
    expect(e.aviso?.tipo).toBe("error");
  });

  it("devolver un canje devuelve las estrellas", () => {
    let e = base();
    const premio = e.premios[0]?.id ?? "";
    e = aplicar(e, { tipo: "premio/canjear", premioId: premio, personaId: "ana" });
    e = aplicar(e, { tipo: "premio/devolver", canjeId: e.canjes[0]?.id ?? "" });
    expect(e.canjes).toEqual([]);
  });

  it("un premio con coste fuera de rango o repetido no se guarda", () => {
    const e = base();
    expect(
      aplicar(e, { tipo: "premio/guardar", nombre: "Gratis", coste: 0, emoji: "x" }).premios,
    ).toHaveLength(1);
    expect(
      aplicar(e, { tipo: "premio/guardar", nombre: " peli ", coste: 3, emoji: "x" }).premios,
    ).toHaveLength(1);
  });

  it("los premios de ejemplo se ponen una sola vez", () => {
    let e = aplicar(estadoInicialDemo(), { tipo: "premio/ejemplos" });
    const n = e.premios.length;
    expect(n).toBeGreaterThan(0);
    e = aplicar(e, { tipo: "premio/ejemplos" });
    expect(e.premios).toHaveLength(n);
  });

  it("editar un premio no cambia lo que costó un canje ya hecho", () => {
    let e = base();
    const premio = e.premios[0]?.id ?? "";
    e = aplicar(e, { tipo: "premio/canjear", premioId: premio, personaId: "ana" });
    e = aplicar(e, { tipo: "premio/guardar", id: premio, nombre: "Peli", coste: 9, emoji: "🎬" });
    expect(e.premios[0]?.coste).toBe(9);
    expect(e.canjes[0]?.coste).toBe(2);
  });
});

const estaHechaHoy = (e: EstadoHogar, id: string) => {
  const t = e.tareas.find((x) => x.id === id);
  return !!t && t.hechas.includes(e.hoy);
};

describe("apuntar a mano, también dictando", () => {
  it("«leche, pañales y pan» añade tres artículos, cada uno en su sección", () => {
    const e = aplicar(estadoInicialDemo(), {
      tipo: "manual/anadir",
      nombre: "leche fresca, pañales y pan",
    });
    const nuevos = e.manuales.slice(-3);
    expect(nuevos.map((m) => [m.nombre, m.categoria])).toEqual([
      ["Leche fresca", "lacteos"],
      ["Pañales", "higiene"],
      ["Pan", "panaderia"],
    ]);
    expect(new Set(e.manuales.map((m) => m.id)).size).toBe(e.manuales.length);
    expect(e.aviso?.texto).toBe("Añadido: Leche fresca, Pañales, Pan.");
  });

  it("no repite lo que ya está pendiente, pero sí lo ya comprado", () => {
    let e = aplicar(estadoInicialDemo(), { tipo: "manual/anadir", nombre: "Kéfir" });
    const antes = e.manuales.length;
    e = aplicar(e, { tipo: "manual/anadir", nombre: "kefir, yogures" });
    expect(e.manuales.length).toBe(antes + 1);
    expect(e.aviso?.texto).toBe("Añadido: Yogures.");
    const repetido = aplicar(e, { tipo: "manual/anadir", nombre: "Kéfir" });
    expect(repetido.manuales).toEqual(e.manuales);
    expect(repetido.aviso?.texto).toBe("Kéfir ya estaba en la lista.");
    expect(aplicar(e, { tipo: "manual/anadir", nombre: "kéfir, yogures" }).aviso?.texto).toBe(
      "Ya estaba todo en la lista.",
    );
    const comprado = aplicar(e, { tipo: "manual/alternar", id: e.manuales.at(-2)?.id ?? "" });
    expect(aplicar(comprado, { tipo: "manual/anadir", nombre: "Kéfir" }).manuales.length).toBe(
      comprado.manuales.length + 1,
    );
  });

  it("rechaza vacío o nombres de más de 80 caracteres", () => {
    const e = estadoInicialDemo();
    expect(reducir(e, { tipo: "manual/anadir", nombre: "  ,  " }).aviso?.tipo).toBe("error");
    expect(reducir(e, { tipo: "manual/anadir", nombre: "x".repeat(81) }).manuales).toBe(e.manuales);
  });
});

describe("varios platos en una cena", () => {
  const base = () =>
    aplicar(estadoInicialDemo(), {
      tipo: "menu/elegir",
      fecha: "2026-11-07",
      platoId: "salmon-plancha",
    });

  it("se puede añadir un segundo plato y la compra suma los dos", () => {
    const e0 = base();
    const e1 = aplicar(e0, { tipo: "menu/anadir", fecha: "2026-11-07", platoId: "huevos-patatas" });
    expect(comidasDe(e1, "2026-11-07").map((c) => c.plato.id)).toEqual([
      "salmon-plancha",
      "huevos-patatas",
    ]);
    expect(e1.aviso?.texto).toContain("Añadido al sábado");
    expect(pendientes(e1).huevo).toBeGreaterThan(pendientes(e0).huevo ?? 0);
  });

  it("no repite plato, no pasa de 3 y no añade en días saltados o fuera de plazo", () => {
    let e = base();
    e = aplicar(e, { tipo: "menu/anadir", fecha: "2026-11-07", platoId: "huevos-patatas" });
    expect(
      reducir(e, { tipo: "menu/anadir", fecha: "2026-11-07", platoId: "huevos-patatas" }),
    ).toBe(e);
    e = aplicar(e, { tipo: "menu/anadir", fecha: "2026-11-07", platoId: "pisto-huevo" });
    expect(comidasDe(e, "2026-11-07")).toHaveLength(3);
    expect(
      reducir(e, { tipo: "menu/anadir", fecha: "2026-11-07", platoId: "crema-zanahoria" }),
    ).toBe(e);
    const b = base();
    expect(reducir(b, { tipo: "menu/anadir", fecha: "2027-06-01", platoId: "tortilla" })).toBe(b);
    expect(reducir(b, { tipo: "menu/anadir", fecha: "2026-11-07", platoId: "nada" })).toBe(b);
    const saltado = aplicar(estadoInicialDemo(), { tipo: "menu/saltar", fecha: "2026-11-07" });
    expect(
      reducir(saltado, { tipo: "menu/anadir", fecha: "2026-11-07", platoId: "tortilla" }),
    ).toBe(saltado);
  });

  it("quitar con plato quita solo ese; sin plato quita todo el día", () => {
    const e = aplicar(base(), {
      tipo: "menu/anadir",
      fecha: "2026-11-07",
      platoId: "huevos-patatas",
    });
    const uno = aplicar(e, { tipo: "menu/quitar", fecha: "2026-11-07", platoId: "salmon-plancha" });
    expect(comidasDe(uno, "2026-11-07").map((c) => c.plato.id)).toEqual(["huevos-patatas"]);
    expect(
      comidasDe(aplicar(e, { tipo: "menu/quitar", fecha: "2026-11-07" }), "2026-11-07"),
    ).toEqual([]);
  });

  it("las opciones para añadir no incluyen lo ya elegido y prefieren lo pequeño", () => {
    let e = estadoInicialDemo();
    e = {
      ...e,
      platos: e.platos.map((p) => (p.id === "pisto-huevo" ? { ...p, ligero: true } : p)),
    };
    e = aplicar(e, { tipo: "menu/elegir", fecha: "2026-11-07", platoId: "salmon-plancha" });
    const ops = opcionesParaFecha(e, "2026-11-07", true);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.map((o) => o.plato.id)).not.toContain("salmon-plancha");
    expect(ops[0]?.plato.id).toBe("pisto-huevo");
  });

  it("solo se ofrece lo que cabe en el tiempo que queda (un día de prisas con un plato de 10 min)", () => {
    const e = aplicar(
      estadoInicialDemo(),
      { tipo: "menu/llegoTarde", fecha: "2026-11-07" },
      { tipo: "menu/elegir", fecha: "2026-11-07", platoId: "tortilla" }, // 10 de 15 min
    );
    expect(opcionesParaFecha(e, "2026-11-07", true)).toEqual([]);
  });

  it("cambiar de plato (elegir) sustituye todo el día", () => {
    const e = aplicar(
      base(),
      { tipo: "menu/anadir", fecha: "2026-11-07", platoId: "huevos-patatas" },
      { tipo: "menu/elegir", fecha: "2026-11-07", platoId: "hamburguesas" },
    );
    expect(comidasDe(e, "2026-11-07").map((c) => c.plato.id)).toEqual(["hamburguesas"]);
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
      personaId: "alba",
      puntos: 5,
    });
    const quitada = aplicar(base, {
      tipo: "valorar",
      platoId: "tortilla",
      personaId: "alba",
      puntos: 5,
    });
    expect(quitada.platos.find((p) => p.id === "tortilla")?.valoracion).toBeNull();
    const cero = aplicar(base, {
      tipo: "valorar",
      platoId: "tortilla",
      personaId: "alba",
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

describe("agenda: apuntes escritos como en una nota", () => {
  const con = (...a: Accion[]) => aplicar(estadoInicialDemo(), ...a);
  const hoy = estadoInicialDemo().hoy;
  const anio = Number(hoy.slice(0, 4)) + 1;

  it("apunta lo que tiene fecha, pasa lo demás a tareas de la persona y avisa de lo que no entiende", () => {
    const e = con({
      tipo: "agenda/anadir",
      texto: `[X] 17 Marzo ${anio} Excursión Alba\n[ ] Veterinario Punky\n31 Abril Mal`,
      personaId: "alba",
    });
    expect(e.agenda.map((a) => [a.fecha, a.titulo])).toEqual([[`${anio}-03-17`, "Excursión Alba"]]);
    expect(e.tareas.filter((t) => t.texto === "Veterinario Punky")).toMatchObject([
      { personaId: "alba", frecuencia: "puntual" },
    ]);
    expect(e.aviso).toMatchObject({ tipo: "ok" });
    expect(e.aviso?.texto).toContain("1 apunte y 1 tarea");
    expect(e.aviso?.texto).toContain("No he entendido: 31 Abril Mal");
  });

  it("no repite lo ya apuntado, no inventa dueño para las tareas y se puede quitar", () => {
    const a = con({
      tipo: "agenda/anadir",
      texto: `3 mayo ${anio} Cole\nLlamar Rosana`,
      personaId: null,
    });
    expect(a.agenda).toHaveLength(1);
    expect(a.tareas.some((t) => t.texto === "Llamar Rosana")).toBe(false);
    expect(a.aviso?.texto).toContain("No he entendido: Llamar Rosana");
    const dos = aplicar(a, {
      tipo: "agenda/anadir",
      texto: `3 mayo ${anio} cole`,
      personaId: null,
    });
    expect(dos.agenda).toHaveLength(1);
    expect(dos.aviso?.texto).toContain("nada nuevo");
    const sin = aplicar(dos, { tipo: "agenda/borrar", id: dos.agenda[0]?.id ?? "" });
    expect(sin.agenda).toEqual([]);
    const error = con({ tipo: "agenda/anadir", texto: "31 Abril Mal", personaId: "alba" });
    expect(error.aviso).toMatchObject({ tipo: "error" });
  });

  it("al recibir un estado de antes de la agenda, parte de una lista vacía", () => {
    const viejo: Partial<EstadoHogar> = { ...estadoInicialDemo() };
    delete viejo.agenda;
    const e = reducir(estadoInicialDemo(), {
      tipo: "hogar/sustituir",
      estado: viejo as unknown as EstadoHogar,
    });
    expect(e.agenda).toEqual([]);
  });
});

describe("el archivo de calendario incluye los apuntes", () => {
  it("cada apunte sale con su hora, sus días y aviso", async () => {
    const { eventosDeCalendario } = await import("./compartir");
    const base = estadoInicialDemo();
    const e = aplicar(base, {
      tipo: "agenda/anadir",
      texto: "5 Noviembre 18:15 Psicotécnico\n17-19 Noviembre Puente",
      personaId: null,
    });
    const eventos = eventosDeCalendario(e).filter((x) => x.titulo.startsWith("📌"));
    expect(eventos.map((x) => [x.titulo, x.hora, x.hasta, x.aviso])).toEqual([
      ["📌 Psicotécnico", "18:15", null, true],
      ["📌 Puente", null, "2026-11-19", true],
    ]);
  });
});

describe("casa: lo recurrente", () => {
  const con = (...a: Accion[]) => aplicar(estadoInicialDemo(), ...a);
  const hoy = estadoInicialDemo().hoy;

  it("la plantilla añade sábanas y toallas escalonadas, sin repetir al pulsar otra vez", () => {
    const e = con({ tipo: "casa/plantilla" });
    expect(e.casa.length).toBeGreaterThanOrEqual(10);
    expect(e.casa.some((t) => /sábanas/i.test(t.titulo))).toBe(true);
    expect(e.casa.every((t) => t.responsableId === null && t.ultimaVez === null)).toBe(true);
    expect(new Set(e.casa.map((t) => t.desde)).size).toBeGreaterThan(3);
    const otra = aplicar(e, { tipo: "casa/plantilla" });
    expect(otra.casa).toHaveLength(e.casa.length);
    expect(otra.aviso?.texto).toBe("Ya estaba toda la plantilla.");
  });

  it("añade una propia, no la repite y rechaza lo vacío o sin frecuencia", () => {
    const e = con({
      tipo: "casa/anadir",
      titulo: "  Regar   las plantas ",
      cadaDias: 3,
      responsableId: "ana",
    });
    expect(e.casa).toMatchObject([
      {
        titulo: "Regar las plantas",
        cadaDias: 3,
        responsableId: "ana",
        ultimaVez: null,
        desde: hoy,
      },
    ]);
    expect(
      aplicar(e, {
        tipo: "casa/anadir",
        titulo: "regar las PLANTAS",
        cadaDias: 7,
        responsableId: null,
      }).casa,
    ).toHaveLength(1);
    expect(
      con({ tipo: "casa/anadir", titulo: "", cadaDias: 3, responsableId: null }).aviso,
    ).toMatchObject({ tipo: "error" });
    expect(
      con({ tipo: "casa/anadir", titulo: "Algo", cadaDias: 0, responsableId: null }).casa,
    ).toEqual([]);
    // Un responsable que no existe se queda sin responsable.
    expect(
      con({ tipo: "casa/anadir", titulo: "Algo", cadaDias: 3, responsableId: "nadie" }).casa[0]
        ?.responsableId,
    ).toBeNull();
  });

  it("hecha se reprograma, «mañana» la aparta, se asigna, se reparte y se borra", () => {
    let e = con({ tipo: "casa/anadir", titulo: "Sábanas", cadaDias: 14, responsableId: null });
    const id = e.casa[0]?.id ?? "";
    e = aplicar(e, { tipo: "casa/aplazar", id });
    expect(e.casa[0]?.aplazadaHasta).not.toBeNull();
    e = aplicar(e, { tipo: "casa/hecha", id });
    expect(e.casa[0]).toMatchObject({ ultimaVez: hoy, aplazadaHasta: null });
    e = aplicar(e, { tipo: "casa/asignar", id, responsableId: "ana" });
    expect(e.casa[0]?.responsableId).toBe("ana");
    e = aplicar(e, { tipo: "casa/asignar", id, responsableId: "alguien-que-no-existe" });
    expect(e.casa[0]?.responsableId).toBeNull();
    const repartido = aplicar(con({ tipo: "casa/plantilla" }), { tipo: "casa/repartir" });
    const adultos = repartido.personas.filter((p) => p.tipo === "adulto").map((p) => p.id);
    expect(
      repartido.casa.every((t) => t.responsableId !== null && adultos.includes(t.responsableId)),
    ).toBe(true);
    const cuenta = adultos.map((a) => repartido.casa.filter((t) => t.responsableId === a).length);
    expect(Math.max(...cuenta) - Math.min(...cuenta)).toBeLessThanOrEqual(1);
    expect(aplicar(repartido, { tipo: "casa/repartir" }).aviso?.texto).toContain(
      "nada sin responsable",
    );
    expect(aplicar(e, { tipo: "casa/borrar", id }).casa).toEqual([]);
  });

  it("la plantilla de los gatos va aparte y «comprar arena» manda la arena a la lista de la compra", () => {
    const e = con({ tipo: "casa/plantilla", conjunto: "gatos" });
    expect(e.casa.some((t) => /areneros/i.test(t.titulo))).toBe(true);
    expect(e.casa.some((t) => /sábanas/i.test(t.titulo))).toBe(false);
    const arena = e.casa.find((t) => t.compra === "Arena para gatos");
    expect(arena).toBeDefined();
    const conLista = aplicar(e, { tipo: "casa/aListaCompra", id: arena?.id ?? "" });
    expect(conLista.manuales.map((m) => m.nombre)).toContain("Arena para gatos");
    // Una tarea sin nada que comprar no hace nada.
    const sinCompra = e.casa.find((t) => !t.compra);
    expect(aplicar(e, { tipo: "casa/aListaCompra", id: sinCompra?.id ?? "" })).toBe(e);
    // La de la casa se puede añadir después sin duplicar los gatos.
    expect(aplicar(e, { tipo: "casa/plantilla" }).casa.length).toBeGreaterThan(e.casa.length);
    expect(aplicar(e, { tipo: "casa/plantilla", conjunto: "gatos" }).casa).toHaveLength(
      e.casa.length,
    );
  });

  it("un estado antiguo sin casa se completa", () => {
    const viejo: Partial<EstadoHogar> = { ...estadoInicialDemo() };
    delete viejo.casa;
    const e = reducir(estadoInicialDemo(), {
      tipo: "hogar/sustituir",
      estado: viejo as EstadoHogar,
    });
    expect(e.casa).toEqual([]);
  });
});

describe("comida del mediodía (D-079)", () => {
  const base = estadoInicialDemo();
  const con = (...a: Accion[]) => aplicar(base, ...a);
  const hoy = base.hoy;
  const plato = base.platos.find((p) => !p.noProponer)!;

  it("apunta un texto libre o un plato del catálogo, sin repetir, y se quita", () => {
    let e = con({
      tipo: "almuerzo/anadir",
      fecha: hoy,
      texto: "  Comemos en casa   de los abuelos ",
    });
    expect(e.almuerzos).toMatchObject([
      { fecha: hoy, texto: "Comemos en casa de los abuelos", platoId: null },
    ]);
    e = aplicar(e, {
      tipo: "almuerzo/anadir",
      fecha: hoy,
      texto: "comemos en casa de los ABUELOS",
    });
    expect(e.almuerzos).toHaveLength(1);
    expect(e.aviso?.texto).toBe("Ya estaba apuntado.");
    e = aplicar(e, { tipo: "almuerzo/anadir", fecha: hoy, platoId: plato.id });
    expect(e.almuerzos[1]).toMatchObject({ texto: plato.nombre, platoId: plato.id });
    expect(e.almuerzos).toHaveLength(2);
    expect(
      aplicar(e, { tipo: "almuerzo/borrar", id: e.almuerzos[0]?.id ?? "" }).almuerzos,
    ).toHaveLength(1);
  });

  it("rechaza lo vacío, un plato que no existe y los días fuera de plazo", () => {
    for (const a of [
      { tipo: "almuerzo/anadir", fecha: hoy, texto: "  " },
      { tipo: "almuerzo/anadir", fecha: hoy, platoId: "no-existe" },
      { tipo: "almuerzo/anadir", fecha: "2020-01-01", texto: "Ayer" },
      { tipo: "almuerzo/anadir", fecha: sumarDias(hoy, 61), texto: "Lejos" },
      { tipo: "almuerzo/anadir", fecha: hoy, texto: "x".repeat(81) },
    ] as Accion[]) {
      const e = con(a);
      expect(e.almuerzos).toEqual([]);
      expect(e.aviso).toMatchObject({ tipo: "error" });
    }
  });

  it("los ingredientes de un plato de la comida entran en la lista de la compra", () => {
    const antes = articulosPendientes(con());
    const despues = articulosPendientes(
      con({ tipo: "almuerzo/anadir", fecha: hoy, platoId: plato.id }),
    );
    const suma = (l: typeof antes) => l.reduce((x, a) => x + a.cantidad, 0);
    expect(despues.length + suma(despues)).toBeGreaterThan(antes.length + suma(antes));
    // Un texto libre no cambia la compra, y un día ya pasado tampoco.
    expect(
      articulosPendientes(con({ tipo: "almuerzo/anadir", fecha: hoy, texto: "Restaurante" })),
    ).toEqual(antes);
  });

  it("sale en el archivo de calendario y un estado antiguo se completa", async () => {
    const { eventosDeCalendario } = await import("./compartir");
    const e = con({ tipo: "almuerzo/anadir", fecha: hoy, texto: "Paella" });
    expect(eventosDeCalendario(e).map((x) => x.titulo)).toContain("☀️ Comida: Paella");
    const viejo: Partial<EstadoHogar> = { ...base };
    delete viejo.almuerzos;
    expect(
      reducir(base, { tipo: "hogar/sustituir", estado: viejo as EstadoHogar }).almuerzos,
    ).toEqual([]);
  });
});

describe("compartir desde el estado de la app", () => {
  it("el menú lleva la comida apuntada y las fechas y la casa se preparan para enviar", async () => {
    const { planParaCompartir, fechasParaCompartir, casaParaCompartir } =
      await import("./compartir");
    const base = estadoInicialDemo();
    const hoy = base.hoy;
    let e = aplicar(
      base,
      { tipo: "almuerzo/anadir", fecha: hoy, texto: "Paella" },
      {
        tipo: "agenda/anadir",
        texto: `${Number(hoy.slice(8)) + 2} ${["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][Number(hoy.slice(5, 7)) - 1]} 18:15 Cita`,
        personaId: null,
      },
      { tipo: "casa/plantilla", conjunto: "gatos" },
    );
    expect(planParaCompartir(e).dias.find((d) => d.fecha === hoy)?.comida).toEqual(["Paella"]);
    const fechas = fechasParaCompartir(e);
    expect(fechas.map((f) => f.titulo)).toContain("Cita");
    expect(fechas.find((f) => f.titulo === "Cita")).toMatchObject({
      hora: "18:15",
      cuando: "en 2 días",
    });
    e = aplicar(e, { tipo: "casa/asignar", id: e.casa[0]?.id ?? "", responsableId: "ana" });
    const casa = casaParaCompartir(e);
    expect(casa.length).toBeGreaterThan(0);
    expect(casa.some((t) => t.quien === "Ana")).toBe(true);
    expect(casa.some((t) => t.quien === "Los dos")).toBe(true);
    expect(casa.every((t) => !t.cuando.startsWith("toca"))).toBe(true);
  });
});

describe("el archivo de calendario no destripa el regalo", () => {
  it("los avisos del regalo solo van a un adulto que no cumple, y sin saber quién baja el archivo no van", async () => {
    const { eventosDeCalendario } = await import("./compartir");
    const e = aplicar(estadoInicialDemo(), {
      tipo: "cumple/anadir",
      nombre: "Ana",
      dia: 7,
      mes: 11,
      relacion: "familia",
      personaId: "ana",
    });
    const regalos = (yo: string | null) =>
      eventosDeCalendario(e, yo)
        .filter((x) => x.titulo.startsWith("🎁"))
        .map((x) => x.titulo);
    const adultos = e.personas.filter((p) => p.tipo === "adulto").map((p) => p.id);
    const otro = adultos.find((id) => id !== "ana");
    expect(regalos(otro ?? null)).toEqual([
      "🎁 Pensar el regalo de Ana",
      "🎁 Comprar el regalo de Ana",
    ]);
    expect(regalos("ana")).toEqual([]);
    expect(regalos(null)).toEqual([]);
    expect(regalos("nadie")).toEqual([]);
    expect(eventosDeCalendario(e, "ana").some((x) => x.titulo === "🎂 Cumple de Ana")).toBe(true);
  });
});

describe("ids UUID derivados de idBase (D-089)", () => {
  const base = "0b1b0c1e-8f4e-4a4e-9c0e-2f0f7b6f0a11";

  it("la misma acción con el mismo idBase da los mismos ids, sin tocar el contador de ids", () => {
    const e = estadoInicialDemo();
    const a = reducir(e, { tipo: "casa/plantilla", conjunto: "gatos", idBase: base });
    const b = reducir(e, { tipo: "casa/plantilla", conjunto: "gatos", idBase: base });
    expect(a.casa.map((t) => t.id)).toEqual(b.casa.map((t) => t.id));
    expect(a.casa.every((t) => esUuid(t.id))).toBe(true);
    expect(new Set(a.casa.map((t) => t.id)).size).toBe(a.casa.length);
  });

  it("dos acciones con idBase distinto no chocan", () => {
    const e = estadoInicialDemo();
    const a = reducir(e, {
      tipo: "casa/anadir",
      titulo: "Cambiar filtros",
      cadaDias: 90,
      responsableId: null,
      idBase: base,
    });
    const b = reducir(a, {
      tipo: "casa/anadir",
      titulo: "Limpiar nevera",
      cadaDias: 30,
      responsableId: null,
      idBase: "1c2c1d2f-9a5f-4b5f-8d1f-3a1a8c7a1b22",
    });
    const ids = b.casa.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("los cumples importados en bloque reciben un id distinto cada uno", () => {
    const e = estadoInicialDemo();
    const r = reducir(e, {
      tipo: "cumple/importar",
      texto: "Lucía 3/4\nMartín 9/10",
      relacion: "amigo",
      idBase: base,
    });
    const nuevos = r.cumples.filter((c) => !e.cumples.some((x) => x.id === c.id));
    expect(nuevos).toHaveLength(2);
    expect(nuevos.every((c) => esUuid(c.id))).toBe(true);
    expect(new Set(nuevos.map((c) => c.id)).size).toBe(2);
  });

  it("agenda y tareas apuntadas de una vez tienen ids UUID únicos", () => {
    const e = estadoInicialDemo();
    const persona = e.personas.find((p) => p.activa)!;
    const r = reducir(e, {
      tipo: "agenda/anadir",
      texto: "17 marzo Reunión del cole\n20 marzo Médico\nComprar regalo",
      personaId: persona.id,
      idBase: base,
    });
    const ids = [...r.agenda, ...r.tareas].map((x) => x.id).filter(esUuid);
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sin idBase se usa el contador de siempre (datos antiguos y tests)", () => {
    const e = estadoInicialDemo();
    const r = reducir(e, {
      tipo: "casa/anadir",
      titulo: "Cambiar filtros",
      cadaDias: 90,
      responsableId: null,
    });
    expect(r.casa.at(-1)?.id).toBe(`c-${e.siguienteId}`);
  });

  it("conIdBase solo toca las acciones que crean y respeta el idBase que ya traen", () => {
    expect(conIdBase({ tipo: "cerrarAviso" }, () => base)).toEqual({ tipo: "cerrarAviso" });
    const a = conIdBase({ tipo: "casa/plantilla" }, () => base);
    expect(a).toMatchObject({ idBase: base });
    const b = conIdBase({ tipo: "casa/plantilla", idBase: "otro" }, () => base);
    expect(b).toMatchObject({ idBase: "otro" });
  });
});

describe("personas de la familia (D-092)", () => {
  const base = "0b1b0c1e-8f4e-4a4e-9c0e-2f0f7b6f0a11";

  it("añade una persona con id UUID, la edita y la desactiva", () => {
    const e = estadoInicialDemo();
    const a = reducir(e, {
      tipo: "persona/guardar",
      nombre: "  Lola ",
      personaTipo: "nino",
      factorRacion: 0.5,
      idBase: base,
    });
    const lola = a.personas.at(-1)!;
    expect(lola).toMatchObject({ nombre: "Lola", tipo: "nino", factorRacion: 0.5, activa: true });
    expect(esUuid(lola.id)).toBe(true);
    const b = reducir(a, {
      tipo: "persona/guardar",
      id: lola.id,
      nombre: "Lola B",
      personaTipo: "adulto",
      factorRacion: 1,
    });
    expect(b.personas.find((p) => p.id === lola.id)).toMatchObject({
      nombre: "Lola B",
      tipo: "adulto",
      factorRacion: 1,
    });
    expect(b.personas).toHaveLength(a.personas.length);
    const c = reducir(b, { tipo: "persona/activar", id: lola.id, activa: false });
    expect(c.personas.find((p) => p.id === lola.id)?.activa).toBe(false);
  });

  it("rechaza nombre vacío, repetido o ración fuera de rango", () => {
    const e = estadoInicialDemo();
    const existente = e.personas[0]!;
    for (const accion of [
      { tipo: "persona/guardar", nombre: "   ", personaTipo: "adulto", factorRacion: 1 },
      {
        tipo: "persona/guardar",
        nombre: existente.nombre.toUpperCase(),
        personaTipo: "adulto",
        factorRacion: 1,
      },
      { tipo: "persona/guardar", nombre: "X", personaTipo: "adulto", factorRacion: 0 },
      { tipo: "persona/guardar", nombre: "X", personaTipo: "adulto", factorRacion: 3 },
    ] as const) {
      const r = reducir(e, accion);
      expect(r.personas).toHaveLength(e.personas.length);
      expect(r.aviso?.tipo).toBe("error");
    }
  });

  it("no deja desactivar a la última persona que cuenta", () => {
    let e = estadoInicialDemo();
    const ids = e.personas.filter((p) => p.activa).map((p) => p.id);
    for (const id of ids.slice(0, -1))
      e = reducir(e, { tipo: "persona/activar", id, activa: false });
    const r = reducir(e, { tipo: "persona/activar", id: ids.at(-1)!, activa: false });
    expect(r.personas.filter((p) => p.activa)).toHaveLength(1);
    expect(r.aviso?.tipo).toBe("error");
  });
});

describe("plato nuevo al vuelo (plato/rapido)", () => {
  const base = "0b1b0c1e-8f4e-4a4e-9c0e-2f0f7b6f0a11";

  it("crea un plato sin ingredientes, que no se propone solo, y se puede elegir en seguida", () => {
    const e = estadoInicialDemo();
    const a = reducir(e, {
      tipo: "plato/rapido",
      nombre: " Fideuà ",
      grupo: "pasta",
      idBase: base,
    });
    const nuevo = a.platos.at(-1)!;
    expect(nuevo).toMatchObject({
      nombre: "Fideuà",
      grupo: "pasta",
      ingredientes: [],
      noProponer: true,
    });
    expect(nuevo.id).toBe(idDePlatoRapido(base));
    const fecha = sumarDias(e.hoy, 1);
    const b = reducir(a, { tipo: "menu/elegir", fecha, platoId: idDePlatoRapido(base) });
    expect(b.comidas.some((c) => c.fecha === fecha && c.plato.nombre === "Fideuà")).toBe(true);
    // Y no entra en la propuesta automática.
    expect(
      menuDeLaSemana(a)
        .dias.flatMap((d) => d.opciones ?? [])
        .some((o) => o.plato.id === nuevo.id),
    ).toBe(false);
  });

  it("no duplica un plato que ya existe (sin tildes ni mayúsculas) ni acepta nombres vacíos", () => {
    const e = estadoInicialDemo();
    const existente = e.platos[0]!;
    const a = reducir(e, {
      tipo: "plato/rapido",
      nombre: existente.nombre.toUpperCase(),
      grupo: "otro",
    });
    expect(a.platos).toHaveLength(e.platos.length);
    const b = reducir(e, { tipo: "plato/rapido", nombre: " ", grupo: "otro" });
    expect(b.platos).toHaveLength(e.platos.length);
    expect(b.aviso?.tipo).toBe("error");
  });

  it("al completarle ingredientes con `plato/guardar`, vuelve a proponerse", () => {
    const e = estadoInicialDemo();
    const a = reducir(e, { tipo: "plato/rapido", nombre: "Fideuà", grupo: "pasta", idBase: base });
    const id = idDePlatoRapido(base);
    const ing = e.ingredientes[0]!;
    const b = reducir(a, {
      tipo: "plato/guardar",
      id,
      plato: {
        nombre: "Fideuà",
        grupo: "pasta",
        minutosActivos: 30,
        pasos: null,
        ingredientes: [{ ingredienteId: ing.id, cantidadPorRacion: 100, opcional: false }],
      },
    });
    expect(b.platos.find((p) => p.id === id)?.noProponer).toBeUndefined();
  });
});

describe("nota de la cena (D-096)", () => {
  it("guarda, cambia y quita la nota de un día, recortada y sin espacios de más", () => {
    const e = estadoInicialDemo();
    const f = e.hoy;
    const a = reducir(e, { tipo: "menu/nota", fecha: f, texto: "  o igual   lomo, depende " });
    expect(a.notasMenu[f]).toBe("o igual lomo, depende");
    const b = reducir(a, { tipo: "menu/nota", fecha: f, texto: "mejor pollo" });
    expect(b.notasMenu[f]).toBe("mejor pollo");
    const c = reducir(b, { tipo: "menu/nota", fecha: f, texto: "   " });
    expect(c.notasMenu).not.toHaveProperty(f);
    const larga = reducir(e, { tipo: "menu/nota", fecha: f, texto: "x".repeat(500) });
    expect(larga.notasMenu[f]).toHaveLength(140);
  });

  it("lo guardado antes de que existieran las notas se completa al normalizar", () => {
    const viejo = { ...estadoInicialDemo(), notasMenu: undefined } as unknown as EstadoHogar;
    expect(normalizar(viejo).notasMenu).toEqual({});
  });
});

describe("lista de la compra editable (D-097)", () => {
  it("al apuntar se separa la cantidad y se puede editar nombre y cantidad", () => {
    const e = reducir(estadoInicialDemo(), {
      tipo: "manual/anadir",
      nombre: "huevos 12, 2 yogures",
    });
    const huevos = e.manuales.find((m) => m.nombre === "Huevos")!;
    expect(huevos.cantidad).toBe("12");
    expect(e.manuales.find((m) => m.nombre === "Yogures")?.cantidad).toBe("2");
    const a = reducir(e, {
      tipo: "manual/editar",
      id: huevos.id,
      nombre: "Huevos camperos",
      cantidad: "6",
    });
    expect(a.manuales.find((m) => m.id === huevos.id)).toMatchObject({
      nombre: "Huevos camperos",
      cantidad: "6",
    });
    const b = reducir(a, { tipo: "manual/editar", id: huevos.id, cantidad: "" });
    expect(b.manuales.find((m) => m.id === huevos.id)).not.toHaveProperty("cantidad");
    const c = reducir(b, { tipo: "manual/editar", id: huevos.id, nombre: "  " });
    expect(c.manuales.find((m) => m.id === huevos.id)?.nombre).toBe("Huevos camperos");
    expect(c.aviso?.tipo).toBe("error");
  });

  it("la cantidad de un artículo calculado se cambia, se quita y se restablece", () => {
    const e = estadoInicialDemo();
    const art = articulosPendientes(e)[0]!;
    const a = reducir(e, {
      tipo: "compra/cantidad",
      ingredienteId: art.ingredienteId,
      cantidad: art.cantidad + 100,
    });
    const editado = articulosPendientes(a).find((x) => x.ingredienteId === art.ingredienteId)!;
    expect(editado.cantidad).toBe(art.cantidad + 100);
    expect(editado.calculada).toBe(art.cantidad);
    // Poner la cantidad calculada borra el ajuste.
    const igual = reducir(a, {
      tipo: "compra/cantidad",
      ingredienteId: art.ingredienteId,
      cantidad: art.cantidad,
    });
    expect(igual.ajustesCompra).toEqual({});
    // 0 = no hace falta: desaparece de pendientes y aparece en quitados.
    const q = reducir(e, {
      tipo: "compra/cantidad",
      ingredienteId: art.ingredienteId,
      cantidad: 0,
    });
    expect(articulosPendientes(q).some((x) => x.ingredienteId === art.ingredienteId)).toBe(false);
    expect(articulosQuitados(q).some((x) => x.ingredienteId === art.ingredienteId)).toBe(true);
    const r = reducir(q, { tipo: "compra/restablecer", ingredienteId: art.ingredienteId });
    expect(articulosPendientes(r).some((x) => x.ingredienteId === art.ingredienteId)).toBe(true);
  });

  it("al comprar con cantidad editada se compra esa cantidad y se limpia el ajuste", () => {
    const e = estadoInicialDemo();
    const art = articulosPendientes(e)[0]!;
    const a = reducir(e, {
      tipo: "compra/cantidad",
      ingredienteId: art.ingredienteId,
      cantidad: art.cantidad + 250,
    });
    const b = reducir(a, { tipo: "comprar", ingredienteId: art.ingredienteId });
    expect(b.compras.at(-1)?.cantidad).toBe(art.cantidad + 250);
    expect(b.ajustesCompra).toEqual({});
  });

  it("rechaza cantidades negativas o de artículos que no están en la lista", () => {
    const e = estadoInicialDemo();
    const art = articulosPendientes(e)[0]!;
    expect(
      reducir(e, { tipo: "compra/cantidad", ingredienteId: art.ingredienteId, cantidad: -3 }),
    ).toBe(e);
    expect(reducir(e, { tipo: "compra/cantidad", ingredienteId: "no-existe", cantidad: 3 })).toBe(
      e,
    );
  });
});

describe("importar artículos propuestos (manual/importar, D-098)", () => {
  it("añade lo propuesto con cantidad y sección, sin repetir lo que ya estaba", () => {
    const e = estadoInicialDemo();
    const yaHay = e.manuales.find((m) => !m.comprado)!.nombre;
    const r = reducir(e, {
      tipo: "manual/importar",
      articulos: [
        { nombre: "  leche ", cantidad: "2", categoria: "lacteos" },
        { nombre: yaHay.toUpperCase(), cantidad: "", categoria: "otros" },
        { nombre: "Leche", cantidad: "9", categoria: "lacteos" },
        { nombre: "", cantidad: "", categoria: "otros" },
      ],
    });
    const nuevos = r.manuales.slice(e.manuales.length);
    expect(nuevos).toHaveLength(1);
    expect(nuevos[0]).toMatchObject({
      nombre: "Leche",
      cantidad: "2",
      categoria: "lacteos",
      comprado: false,
    });
  });

  it("no hace nada raro si no hay nada nuevo", () => {
    const e = estadoInicialDemo();
    const r = reducir(e, { tipo: "manual/importar", articulos: [] });
    expect(r.manuales).toEqual(e.manuales);
    expect(r.aviso?.tipo).toBe("ok");
  });
});

describe("aviso de error (D-102)", () => {
  it("muestra un aviso de error y no cambia nada más", () => {
    const e = estadoInicialDemo();
    const r = reducir(e, { tipo: "aviso/error", texto: "⚠️ Cambio NO guardado" });
    expect(r.aviso).toMatchObject({ tipo: "error", texto: "⚠️ Cambio NO guardado" });
    expect({ ...r, aviso: null, siguienteId: 0 }).toEqual({ ...e, aviso: null, siguienteId: 0 });
  });
});

describe("lo de hoy: quién ha hecho qué (D-108)", () => {
  const e = () => estadoInicialDemo();
  const persona = (x: EstadoHogar) => x.personas.find((p) => p.activa)!;

  it("un toque apunta a la persona y otro toque la quita", () => {
    const base = e();
    const p = persona(base);
    const a = reducir(base, {
      tipo: "registro/alternar",
      fecha: base.hoy,
      que: "cena",
      personaId: p.id,
    });
    expect(a.registro).toHaveLength(1);
    expect(a.registro[0]).toMatchObject({ fecha: base.hoy, que: "cena", personaId: p.id });
    expect(esUuid(a.registro[0]!.id)).toBe(true);
    const b = reducir(a, {
      tipo: "registro/alternar",
      fecha: base.hoy,
      que: " Cena ",
      personaId: p.id,
    });
    expect(b.registro).toHaveLength(0);
  });

  it("dos personas pueden apuntarse en la misma cosa", () => {
    const base = e();
    const [p, q] = base.personas.filter((x) => x.activa);
    const r = aplicar(
      base,
      { tipo: "registro/alternar", fecha: base.hoy, que: "Compra", personaId: p!.id },
      { tipo: "registro/alternar", fecha: base.hoy, que: "Compra", personaId: q!.id },
    );
    expect(r.registro).toHaveLength(2);
  });

  it("sin texto o con una persona que no existe, avisa del error y no apunta nada", () => {
    const base = e();
    const sinTexto = reducir(base, {
      tipo: "registro/alternar",
      fecha: base.hoy,
      que: " ",
      personaId: persona(base).id,
    });
    expect(sinTexto.registro).toHaveLength(0);
    expect(sinTexto.aviso?.tipo).toBe("error");
    const sinPersona = reducir(base, {
      tipo: "registro/alternar",
      fecha: base.hoy,
      que: "Cena",
      personaId: "nadie",
    });
    expect(sinPersona.registro).toHaveLength(0);
    expect(sinPersona.aviso?.tipo).toBe("error");
  });

  it("lo guardado antes de que existiera se completa al normalizar", () => {
    const viejo = { ...estadoInicialDemo(), registro: undefined } as unknown as EstadoHogar;
    expect(normalizar(viejo).registro).toEqual([]);
  });
});

describe("citas con día elegido (agenda/cita)", () => {
  const base = () => estadoInicialDemo();

  it("apunta una cita con hora y otra de varios días", () => {
    const e = base();
    const r = aplicar(
      e,
      { tipo: "agenda/cita", fecha: "2026-11-12", titulo: " Dentista  de Alba ", hora: "18:15" },
      { tipo: "agenda/cita", fecha: "2026-11-20", hasta: "2026-11-22", titulo: "Puente" },
    );
    const a = r.agenda.find((x) => x.titulo === "Dentista de Alba");
    expect(a).toMatchObject({ fecha: "2026-11-12", hora: "18:15", hasta: null });
    expect(r.agenda.find((x) => x.titulo === "Puente")).toMatchObject({
      hasta: "2026-11-22",
      hora: null,
    });
    expect(r.aviso?.tipo).toBe("ok");
  });

  it("lo mismo el mismo día no se duplica", () => {
    const e = base();
    const una = reducir(e, { tipo: "agenda/cita", fecha: "2026-11-12", titulo: "Dentista" });
    const dos = reducir(una, { tipo: "agenda/cita", fecha: "2026-11-12", titulo: "  dentista " });
    expect(dos.agenda).toHaveLength(una.agenda.length);
  });

  it("rechaza título vacío, hora mala o un último día que no es posterior", () => {
    const e = base();
    for (const accion of [
      { tipo: "agenda/cita", fecha: "2026-11-12", titulo: "  " },
      { tipo: "agenda/cita", fecha: "2026-11-12", titulo: "X", hora: "25:00" },
      { tipo: "agenda/cita", fecha: "2026-11-12", titulo: "X", hasta: "2026-11-12" },
      { tipo: "agenda/cita", fecha: "12/11", titulo: "X" },
    ] as const) {
      const r = reducir(e, accion);
      expect(r.agenda).toHaveLength(e.agenda.length);
      expect(r.aviso?.tipo).toBe("error");
    }
  });

  it("con idBase el id es un UUID estable (se sincroniza como fila de tabla)", () => {
    const e = base();
    const idBase = "11111111-1111-4111-8111-111111111111";
    const r = reducir(e, { tipo: "agenda/cita", fecha: "2026-11-12", titulo: "Dentista", idBase });
    const r2 = reducir(e, { tipo: "agenda/cita", fecha: "2026-11-12", titulo: "Dentista", idBase });
    expect(esUuid(r.agenda.at(-1)!.id)).toBe(true);
    expect(r.agenda.at(-1)!.id).toBe(r2.agenda.at(-1)!.id);
  });
});
