import { describe, expect, it } from "vitest";
import { esUuid } from "@/dominio/identificadores";
import { estadoInicialDemo } from "./datos-demo";
import { type EstadoHogar, reducir } from "./estado";
import { aUuid, migrarIdsDePersonas } from "./tablas";
import {
  aplicarCambiosALecturaMenu,
  aplicarLecturaDeMenu,
  cambiosCompletosMenu,
  conservarCamposDeMenu,
  diferenciasMenu,
  hayMenuEnTablas,
  ingredientesPorResolver,
  lecturaDeMenu,
  leerMenu,
  migrarIdsDeMenu,
} from "./tablas-menu";

const HOGAR = "5f3d4e1a-6b7c-4d8e-9f0a-1b2c3d4e5f60";
const BASE = "0b1b0c1e-8f4e-4a4e-9c0e-2f0f7b6f0a11";

/** Un catálogo «de la base de datos»: a cada id de texto le toca un UUID estable cualquiera. */
const catalogo = (e: EstadoHogar) =>
  Object.fromEntries(e.ingredientes.map((i) => [i.id, aUuid("catalogo", i.id)]));

/** El estado de ejemplo, ya con todos los ids del menú en UUID (como tras adoptar las tablas). */
const migrado = (e = estadoInicialDemo()) =>
  migrarIdsDePersonas(migrarIdsDeMenu(e, HOGAR, catalogo(e)), HOGAR);

describe("migrarIdsDeMenu", () => {
  it("pasa a UUID platos e ingredientes y lo que los nombra, sin romper ninguna referencia", () => {
    const origen = reducir(estadoInicialDemo(), { tipo: "comprar", ingredienteId: "calabacin" });
    const e = migrarIdsDeMenu(origen, HOGAR, catalogo(origen));
    expect(e.platos.every((p) => esUuid(p.id))).toBe(true);
    expect(e.ingredientes.every((i) => esUuid(i.id))).toBe(true);
    const ingredientes = new Set(e.ingredientes.map((i) => i.id));
    const platos = new Set(e.platos.map((p) => p.id));
    for (const p of e.platos)
      for (const i of p.ingredientes) expect(ingredientes.has(i.ingredienteId)).toBe(true);
    for (const d of e.despensa) expect(ingredientes.has(d.ingredienteId)).toBe(true);
    for (const c of e.compras) expect(ingredientes.has(c.ingredienteId)).toBe(true);
    for (const o of e.operaciones)
      for (const m of o.aplicados) expect(ingredientes.has(m.ingredienteId)).toBe(true);
    for (const c of e.comidas) expect(platos.has(c.plato.id)).toBe(true);
    for (const a of e.almuerzos) if (a.platoId) expect(platos.has(a.platoId)).toBe(true);
    expect(e.compras.length).toBeGreaterThan(0);
  });

  it("es idempotente y la compra pendiente no cambia", () => {
    const origen = estadoInicialDemo();
    const una = migrarIdsDeMenu(origen, HOGAR, catalogo(origen));
    expect(migrarIdsDeMenu(una, HOGAR, catalogo(origen))).toEqual(una);
    const totales = (x: EstadoHogar) => Object.values(x.despensa).length;
    expect(totales(una)).toBe(totales(origen));
  });

  it("une ingredientes con el mismo nombre (mismo id de catálogo)", () => {
    const e = estadoInicialDemo();
    const mapa = { ...catalogo(e), [e.ingredientes[1]!.id]: catalogo(e)[e.ingredientes[0]!.id]! };
    const r = migrarIdsDeMenu(e, HOGAR, mapa);
    expect(r.ingredientes).toHaveLength(e.ingredientes.length - 1);
  });

  it("los ids de texto sin resolver se detectan para pedir su resolución", () => {
    const e = estadoInicialDemo();
    expect(ingredientesPorResolver(e)).toHaveLength(e.ingredientes.length);
    expect(ingredientesPorResolver(migrado(e))).toHaveLength(0);
  });
});

describe("diferenciasMenu", () => {
  it("no devuelve nada si no cambió el menú (la despensa o la compra no son estas tablas)", () => {
    const e = migrado();
    expect(diferenciasMenu(e, e, HOGAR)).toBeNull();
    const otro = reducir(e, { tipo: "manual/anadir", nombre: "Leche" });
    expect(diferenciasMenu(e, otro, HOGAR)).toBeNull();
  });

  it("elegir y añadir platos a la cena es UNA cena con sus platos en orden", () => {
    const e = migrado();
    const fecha = "2026-11-09";
    const [a, b] = e.platos;
    const una = reducir(e, { tipo: "menu/elegir", fecha, platoId: a!.id });
    const dos = reducir(una, { tipo: "menu/anadir", fecha, platoId: b!.id });
    const c = diferenciasMenu(e, dos, HOGAR);
    expect(c?.comidas?.upsert).toHaveLength(1);
    expect(c?.comidas?.upsert?.[0]).toMatchObject({
      fecha,
      momento: "cena",
      platos: [a!.id, b!.id],
    });
    expect(Object.keys(c!)).toEqual(["comidas"]);
    const quitada = reducir(dos, { tipo: "menu/quitar", fecha });
    expect(diferenciasMenu(dos, quitada, HOGAR)?.comidas?.borrar).toEqual([`${fecha}|cena`]);
  });

  it("la nota de la cena, un plato nuevo, una valoración y una comida del mediodía", () => {
    const e = migrado();
    const nota = reducir(e, { tipo: "menu/nota", fecha: e.hoy, texto: "o igual lomo" });
    expect(diferenciasMenu(e, nota, HOGAR)?.notas?.upsert).toEqual([
      { fecha: e.hoy, momento: "cena", texto: "o igual lomo" },
    ]);
    expect(diferenciasMenu(nota, e, HOGAR)?.notas?.borrar).toEqual([`${e.hoy}|cena`]);

    const nuevo = reducir(e, {
      tipo: "plato/rapido",
      nombre: "Fideuà",
      grupo: "pasta",
      idBase: BASE,
    });
    const fila = diferenciasMenu(e, nuevo, HOGAR)?.platos?.upsert?.[0];
    expect(fila).toMatchObject({
      nombre: "Fideuà",
      noProponer: true,
      ingredientes: [],
      ligero: false,
    });
    expect(esUuid(fila!.id)).toBe(true);

    const persona = e.personas.find((p) => p.activa)!;
    const val = reducir(e, {
      tipo: "valorar",
      platoId: e.platos[0]!.id,
      personaId: persona.id,
      puntos: 4,
    });
    expect(diferenciasMenu(e, val, HOGAR)?.valoraciones?.upsert).toEqual([
      { platoId: e.platos[0]!.id, personaId: aUuid(HOGAR, persona.id), puntos: 4 },
    ]);

    const alm = reducir(e, {
      tipo: "almuerzo/anadir",
      fecha: "2026-11-10",
      texto: "Paella",
      idBase: BASE,
    });
    expect(diferenciasMenu(e, alm, HOGAR)?.almuerzos?.upsert?.[0]).toMatchObject({
      texto: "Paella",
      platoId: null,
    });
  });

  it("borrar un plato lo manda como baja", () => {
    const e = migrado();
    const quitado = reducir(e, { tipo: "plato/borrar", id: e.platos[0]!.id });
    expect(diferenciasMenu(e, quitado, HOGAR)?.platos?.borrar).toEqual([e.platos[0]!.id]);
  });
});

describe("ida y vuelta con las tablas", () => {
  it("lo que se escribe se lee igual: platos, ingredientes, cenas, notas, almuerzos y valoraciones", () => {
    let e = migrado();
    const persona = e.personas.find((p) => p.activa)!;
    e = reducir(e, { tipo: "menu/elegir", fecha: "2026-11-09", platoId: e.platos[0]!.id });
    e = reducir(e, { tipo: "menu/anadir", fecha: "2026-11-09", platoId: e.platos[1]!.id });
    e = reducir(e, { tipo: "menu/nota", fecha: "2026-11-09", texto: "depende" });
    e = reducir(e, { tipo: "valorar", platoId: e.platos[0]!.id, personaId: persona.id, puntos: 5 });
    e = reducir(e, {
      tipo: "almuerzo/anadir",
      fecha: "2026-11-10",
      platoId: e.platos[2]!.id,
      idBase: BASE,
    });
    const lectura = aplicarCambiosALecturaMenu(
      {
        ...lecturaDeMenu(
          { ...e, platos: [], comidas: [], notasMenu: {}, almuerzos: [], valoraciones: {} },
          HOGAR,
        ),
      },
      cambiosCompletosMenu(e, HOGAR),
    );
    const json = JSON.parse(JSON.stringify(lectura));
    const leido = aplicarLecturaDeMenu(migrado(), leerMenu(json));
    expect(leido.platos.map((p) => [p.id, p.nombre, p.grupo, p.ingredientes.length])).toEqual(
      e.platos.map((p) => [p.id, p.nombre, p.grupo, p.ingredientes.length]),
    );
    expect(leido.comidas.map((c) => [c.fecha, c.plato.id])).toEqual(
      e.comidas.map((c) => [c.fecha, c.plato.id]),
    );
    expect(leido.notasMenu).toEqual(e.notasMenu);
    expect(leido.almuerzos).toEqual(e.almuerzos);
    expect(leido.valoraciones).toEqual(e.valoraciones);
    expect(leido.platos[0]!.valoracion).toBe(5);
    // Los ingredientes que solo usa la despensa (no un plato) se conservan.
    expect(leido.ingredientes.length).toBeGreaterThanOrEqual(e.ingredientes.length - 5);
    expect(hayMenuEnTablas(leerMenu(json))).toBe(true);
  });

  it("borrar un plato lo quita de las cenas y valoraciones, como la base de datos", () => {
    const e = migrado();
    const conCena = reducir(e, {
      tipo: "menu/elegir",
      fecha: "2026-11-09",
      platoId: e.platos[0]!.id,
    });
    const base = lecturaDeMenu(conCena, HOGAR);
    const sin = aplicarCambiosALecturaMenu(base, { platos: { borrar: [e.platos[0]!.id] } });
    expect(sin.platos.some((p) => p.id === e.platos[0]!.id)).toBe(false);
    expect(sin.comidas.every((c) => !c.platos.includes(e.platos[0]!.id))).toBe(true);
  });

  it("rechaza un formato inesperado", () => {
    expect(() => leerMenu({ platos: "no" })).toThrow();
  });
});

describe("conservarCamposDeMenu", () => {
  it("lo que llega del documento no pisa el menú de las tablas, pero sí trae la despensa con ids nuevos", () => {
    const e = migrado();
    const conCena = reducir(e, {
      tipo: "menu/elegir",
      fecha: "2026-11-09",
      platoId: e.platos[0]!.id,
    });
    const delDocumento = reducir(estadoInicialDemo(), {
      tipo: "comprar",
      ingredienteId: "calabacin",
    });
    const r = conservarCamposDeMenu(delDocumento, conCena, HOGAR, catalogo(estadoInicialDemo()));
    expect(r.comidas).toEqual(conCena.comidas);
    expect(r.platos).toEqual(conCena.platos);
    expect(r.compras.length).toBeGreaterThan(0);
    expect(r.compras.every((c) => esUuid(c.ingredienteId))).toBe(true);
    expect(r.ingredientes.every((i) => esUuid(i.id))).toBe(true);
  });
});
