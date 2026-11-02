import { describe, expect, it } from "vitest";
import { esUuid, idDeLegado } from "@/dominio/identificadores";
import { estadoInicialDemo } from "./datos-demo";
import { type EstadoHogar, reducir } from "./estado";
import {
  aUuid,
  aplicarLecturaDeTablas,
  cambiosCompletos,
  cambiosParaImportar,
  diferencias,
  leerTablas,
  resumenDeCambios,
} from "./tablas";

const HOGAR = "5f3d4e1a-6b7c-4d8e-9f0a-1b2c3d4e5f60";
const BASE = "0b1b0c1e-8f4e-4a4e-9c0e-2f0f7b6f0a11";

const base = (): EstadoHogar => estadoInicialDemo();
/** Estado con un cumpleaños de familia ya creado. */
const conCumple = (): EstadoHogar =>
  reducir(base(), {
    tipo: "cumple/anadir",
    nombre: "Alba",
    dia: 4,
    mes: 2,
    relacion: "familia",
    idBase: BASE,
  });

describe("aUuid", () => {
  it("respeta los UUID y convierte los ids antiguos de forma estable", () => {
    expect(aUuid(HOGAR, BASE)).toBe(BASE);
    expect(aUuid(HOGAR, "c-3")).toBe(idDeLegado(HOGAR, "c-3"));
    expect(esUuid(aUuid(HOGAR, "diego"))).toBe(true);
  });
});

describe("diferencias", () => {
  it("devuelve null si no cambió nada de lo que vive en tablas", () => {
    const e = base();
    expect(diferencias(e, e, HOGAR)).toBeNull();
    // Cambios de despensa o de compra no tocan estas tablas.
    const otro = reducir(e, { tipo: "comprar", ingredienteId: "calabacin" });
    expect(diferencias(e, otro, HOGAR)).toBeNull();
  });

  it("una tarea de casa nueva es un alta con el id derivado de idBase", () => {
    const e = base();
    const d = reducir(e, {
      tipo: "casa/anadir",
      titulo: "Cambiar filtros",
      cadaDias: 90,
      responsableId: null,
      idBase: BASE,
    });
    const c = diferencias(e, d, HOGAR);
    expect(c?.casa?.upsert).toHaveLength(1);
    expect(c?.casa?.upsert?.[0]).toMatchObject({
      titulo: "Cambiar filtros",
      cadaDias: 90,
      responsableId: null,
    });
    expect(esUuid(c!.casa!.upsert![0]!.id)).toBe(true);
    expect(c?.casa?.borrar).toBeUndefined();
    expect(Object.keys(c!)).toEqual(["casa"]);
  });

  it("marcar hecha una tarea manda solo esa fila, y borrarla manda su id", () => {
    const e = reducir(base(), { tipo: "casa/plantilla", conjunto: "gatos", idBase: BASE });
    const id = e.casa[0]!.id;
    const hecha = reducir(e, { tipo: "casa/hecha", id });
    const c = diferencias(e, hecha, HOGAR);
    expect(c?.casa?.upsert).toHaveLength(1);
    expect(c?.casa?.upsert?.[0]?.ultimaVez).toBe(e.hoy);
    const borrada = reducir(e, { tipo: "casa/borrar", id });
    expect(diferencias(e, borrada, HOGAR)?.casa?.borrar).toEqual([id]);
  });

  it("los ids antiguos se convierten a UUID en el borde, también en las referencias", () => {
    const e = base();
    const persona = e.personas[0]!;
    const conCasa = reducir(e, {
      tipo: "casa/anadir",
      titulo: "Regar plantas",
      cadaDias: 3,
      responsableId: persona.id,
    });
    const c = diferencias(e, conCasa, HOGAR);
    expect(c?.casa?.upsert?.[0]?.responsableId).toBe(aUuid(HOGAR, persona.id));
  });

  it("alternar una tarea manda las fechas hechas; cambiar solo el texto no las toca", () => {
    const e0 = base();
    const persona = e0.personas.find((p) => p.activa)!;
    const e = reducir(e0, {
      tipo: "tarea/anadir",
      personaId: persona.id,
      texto: "Hacer la cama",
      frecuencia: "diaria",
      idBase: BASE,
    });
    const id = e.tareas.at(-1)!.id;
    const hecha = reducir(e, { tipo: "tarea/alternar", id });
    const c = diferencias(e, hecha, HOGAR);
    expect(c?.tareas?.upsert?.[0]?.hechas).toEqual([e.hoy]);
    const renombrada: EstadoHogar = {
      ...e,
      tareas: e.tareas.map((t) => (t.id === id ? { ...t, texto: "Cama hecha" } : t)),
    };
    const r = diferencias(e, renombrada, HOGAR)?.tareas?.upsert?.[0];
    expect(r?.texto).toBe("Cama hecha");
    expect(r).not.toHaveProperty("hechas");
  });

  it("cambiar el estado del regalo manda `regalo` pero no las ideas; añadir una idea manda las ideas", () => {
    const e = conCumple();
    const cumple = e.cumples[0]!;
    const conEstado = reducir(e, { tipo: "cumple/estado", id: cumple.id, estado: "comprado" });
    const c1 = diferencias(e, conEstado, HOGAR)?.cumples?.upsert?.[0];
    expect(c1?.regalo?.estado).toBe("comprado");
    expect(c1).not.toHaveProperty("ideas");
    const conIdea = reducir(e, { tipo: "cumple/idea", id: cumple.id, texto: "Un libro nuevo" });
    const c2 = diferencias(e, conIdea, HOGAR)?.cumples?.upsert?.[0];
    expect(c2?.ideas?.map((i) => i.texto)).toContain("Un libro nuevo");
    // Apuntar una idea pasa el regalo de «sin pensar» a «idea»: también cambia el estado.
    expect(c2?.regalo?.estado).toBe("idea");
  });

  it("un cumple nuevo manda regalo e ideas completos", () => {
    const e = base();
    const d = reducir(e, {
      tipo: "cumple/anadir",
      nombre: "Lucía",
      dia: 3,
      mes: 4,
      relacion: "amigo",
      idBase: BASE,
    });
    const fila = diferencias(e, d, HOGAR)?.cumples?.upsert?.[0];
    expect(fila).toMatchObject({
      nombre: "Lucía",
      dia: 3,
      mes: 4,
      regalo: { estado: "sin-pensar" },
      ideas: [],
    });
  });

  it("los ids de las ideas dependen del cumple y del texto, no del orden", () => {
    const e = conCumple();
    const cumple = e.cumples[0]!;
    const a = reducir(reducir(e, { tipo: "cumple/idea", id: cumple.id, texto: "Libro" }), {
      tipo: "cumple/idea",
      id: cumple.id,
      texto: "Puzle",
    });
    const b = reducir(reducir(e, { tipo: "cumple/idea", id: cumple.id, texto: "Puzle" }), {
      tipo: "cumple/idea",
      id: cumple.id,
      texto: "Libro",
    });
    const ia = diferencias(e, a, HOGAR)!.cumples!.upsert![0]!.ideas!;
    const ib = diferencias(e, b, HOGAR)!.cumples!.upsert![0]!.ideas!;
    const porTexto = (l: typeof ia) => Object.fromEntries(l.map((i) => [i.texto, i.id]));
    expect(porTexto(ia)).toEqual(porTexto(ib));
  });

  it("apuntes y fechas señaladas", () => {
    const e = base();
    const p = e.personas.find((x) => x.activa)!;
    const d = reducir(e, {
      tipo: "agenda/anadir",
      texto: "17 marzo 2027 Reunión del cole",
      personaId: p.id,
      idBase: BASE,
    });
    const c = diferencias(e, d, HOGAR);
    expect(c?.agenda?.upsert).toHaveLength(1);
    expect(c?.agenda?.upsert?.[0]).toMatchObject({
      fecha: "2027-03-17",
      titulo: "Reunión del cole",
    });
    const borrado = reducir(d, { tipo: "agenda/borrar", id: d.agenda.at(-1)!.id });
    expect(diferencias(d, borrado, HOGAR)?.agenda?.borrar).toHaveLength(1);
    const conFecha: EstadoHogar = {
      ...e,
      eventos: { ...e.eventos, "2027-05-01": { titulo: "Fiesta", emoji: "🎉" } },
    };
    expect(diferencias(e, conFecha, HOGAR)?.fechas?.upsert).toEqual([
      { fecha: "2027-05-01", titulo: "Fiesta", emoji: "🎉" },
    ]);
    expect(diferencias(conFecha, e, HOGAR)?.fechas?.borrar).toEqual(["2027-05-01"]);
  });

  it("horizonte, llego tarde y días saltados", () => {
    const e = base();
    expect(
      diferencias(
        e,
        reducir(e, {
          tipo: "menu/horizonte",
          horizonte: e.horizonte === "semana" ? "quincena" : "semana",
        }),
        HOGAR,
      )?.horizonte,
    ).toBeDefined();
    const fecha = e.hoy;
    const tarde = reducir(e, { tipo: "menu/llegoTarde", fecha });
    const c = diferencias(e, tarde, HOGAR);
    expect(c?.dias?.upsert?.[0]).toMatchObject({ fecha, llegaTarde: true, saltado: false });
    const quitado = diferencias(tarde, e, HOGAR);
    expect(quitado?.dias?.borrar).toEqual([fecha]);
  });

  it("una persona nueva y una baja", () => {
    const e = base();
    const nueva: EstadoHogar = {
      ...e,
      personas: [
        ...e.personas,
        { id: BASE, nombre: "Lola", tipo: "adulto", activa: true, factorRacion: 1 },
      ],
    };
    expect(diferencias(e, nueva, HOGAR)?.personas?.upsert).toEqual([
      { id: BASE, nombre: "Lola", tipo: "adulto", activa: true, factorRacion: 1 },
    ]);
    expect(diferencias(nueva, e, HOGAR)?.personas?.borrar).toEqual([BASE]);
  });
});

describe("ida y vuelta", () => {
  it("lo que se escribe con `diferencias` se lee igual con `aplicarLecturaDeTablas`", () => {
    // Estado con ids ya UUID, para que escribir y leer sea comparable.
    let e = base();
    const mapa = (id: string | null | undefined) => (id ? aUuid(HOGAR, id) : null);
    e = {
      ...e,
      personas: e.personas.map((p) => ({ ...p, id: aUuid(HOGAR, p.id) })),
      cumples: e.cumples.map((c) => ({
        ...c,
        id: aUuid(HOGAR, c.id),
        personaId: mapa(c.personaId),
      })),
      agenda: e.agenda.map((a) => ({ ...a, id: aUuid(HOGAR, a.id) })),
      casa: e.casa.map((t) => ({
        ...t,
        id: aUuid(HOGAR, t.id),
        responsableId: mapa(t.responsableId),
      })),
      tareas: e.tareas.map((t) => ({
        ...t,
        id: aUuid(HOGAR, t.id),
        personaId: aUuid(HOGAR, t.personaId),
      })),
    };
    const c = cambiosCompletos(e, HOGAR);
    // Lo que devolvería la base de datos: las mismas filas, con la forma de `leer_hogar_tablas`.
    const json = {
      personas: (c.personas?.upsert ?? []).map((p) => ({ ...p, vinculada: false })),
      horizonte: e.horizonte,
      llegoTarde: e.llegoTarde,
      saltados: e.saltados,
      cumples: (c.cumples?.upsert ?? []).map((x) => ({
        ...x,
        regalo: x.regalo ?? null,
        ideas: x.ideas ?? [],
      })),
      agenda: c.agenda?.upsert ?? [],
      fechas: c.fechas?.upsert ?? [],
      casa: c.casa?.upsert ?? [],
      tareas: (c.tareas?.upsert ?? []).map((t) => ({ ...t, hechas: t.hechas ?? [] })),
    };
    const leido = aplicarLecturaDeTablas(base(), leerTablas(json));
    const sinRuido = (x: EstadoHogar) => ({
      personas: x.personas,
      cumples: x.cumples.map((c) => ({
        ...c,
        gustos: c.gustos ?? [],
        anio: c.anio ?? null,
        anioEstado: c.anioEstado ?? null,
      })),
      agenda: x.agenda,
      eventos: x.eventos,
      casa: x.casa.map((t) => ({
        ...t,
        aplazadaHasta: t.aplazadaHasta ?? null,
        compra: t.compra ?? null,
      })),
      tareas: x.tareas.map((t) => ({ ...t, hechas: [...t.hechas].sort() })),
      llegoTarde: x.llegoTarde,
      saltados: x.saltados,
      horizonte: x.horizonte,
    });
    const ordenado = (x: ReturnType<typeof sinRuido>) => JSON.parse(JSON.stringify(x));
    expect(ordenado(sinRuido(leido)).personas).toEqual(ordenado(sinRuido(e)).personas);
    expect(ordenado(sinRuido(leido)).casa).toEqual(ordenado(sinRuido(e)).casa);
    expect(ordenado(sinRuido(leido)).agenda).toEqual(ordenado(sinRuido(e)).agenda);
    expect(ordenado(sinRuido(leido)).tareas).toEqual(ordenado(sinRuido(e)).tareas);
    expect(ordenado(sinRuido(leido)).eventos).toEqual(ordenado(sinRuido(e)).eventos);
    expect(sinRuido(leido).cumples.map((c) => [c.nombre, c.estado, c.ideas])).toEqual(
      sinRuido(e).cumples.map((c) => [c.nombre, c.estado, c.ideas]),
    );
  });

  it("para quien cumple el regalo llega nulo: queda «sin pensar» y sin ideas", () => {
    const lectura = leerTablas({
      personas: [],
      horizonte: "semana",
      llegoTarde: [],
      saltados: [],
      agenda: [],
      fechas: [],
      casa: [],
      tareas: [],
      cumples: [
        {
          id: BASE,
          nombre: "Ana",
          dia: 7,
          mes: 11,
          anio: 1984,
          relacion: "familia",
          personaId: null,
          regalo: null,
          ideas: [],
        },
      ],
    });
    const e = aplicarLecturaDeTablas(base(), lectura);
    expect(e.cumples).toHaveLength(1);
    expect(e.cumples[0]).toMatchObject({ nombre: "Ana", estado: "sin-pensar", ideas: [] });
  });

  it("rechaza un formato inesperado", () => {
    expect(() => leerTablas({ personas: "no" })).toThrow();
  });

  it("cambiar el nombre de un cumple no reescribe su regalo (quien cumple no puede escribirlo)", () => {
    const e = conCumple();
    const c0 = e.cumples[0]!;
    const renombrado: EstadoHogar = {
      ...e,
      cumples: e.cumples.map((c) => (c.id === c0.id ? { ...c, nombre: "Otro nombre" } : c)),
    };
    const fila = diferencias(e, renombrado, HOGAR)?.cumples?.upsert?.[0];
    expect(fila?.nombre).toBe("Otro nombre");
    expect(fila).not.toHaveProperty("regalo");
    expect(fila).not.toHaveProperty("ideas");
  });
});

describe("importación única (D-094)", () => {
  const conCumples = (): EstadoHogar => {
    let e = base();
    e = reducir(e, {
      tipo: "cumple/anadir",
      nombre: "Ana",
      dia: 7,
      mes: 11,
      relacion: "familia",
      idBase: BASE,
    });
    e = reducir(e, { tipo: "cumple/idea", id: e.cumples[0]!.id, texto: "Sorpresa" });
    return e;
  };

  it("lleva todo lo que el documento tiene, con ids UUID, y es repetible", () => {
    const e = conCumples();
    const a = cambiosParaImportar(e, HOGAR, null);
    const b = cambiosParaImportar(e, HOGAR, null);
    expect(a).toEqual(b);
    expect(a.personas?.upsert?.length).toBe(e.personas.length);
    expect(a.cumples?.upsert?.[0]?.regalo?.estado).toBe("idea");
    expect(a.cumples?.upsert?.[0]?.ideas).toHaveLength(1);
    for (const f of a.personas!.upsert!) expect(esUuid(f.id)).toBe(true);
  });

  it("no manda el regalo ni las ideas del cumple de quien importa", () => {
    const e = conCumples();
    const ana = e.personas[0]!;
    const conVinculo: EstadoHogar = {
      ...e,
      cumples: e.cumples.map((c) => ({ ...c, personaId: ana.id })),
    };
    const sinMia = cambiosParaImportar(conVinculo, HOGAR, null).cumples!.upsert![0]!;
    expect(sinMia.regalo).toBeDefined();
    const conMia = cambiosParaImportar(conVinculo, HOGAR, ana.id).cumples!.upsert![0]!;
    expect(conMia).not.toHaveProperty("regalo");
    expect(conMia).not.toHaveProperty("ideas");
    expect(conMia.nombre).toBe("Ana");
  });

  it("los resúmenes cuentan filas", () => {
    const e = conCumples();
    const r = resumenDeCambios(cambiosParaImportar(e, HOGAR, null));
    expect(r.personas).toBe(e.personas.length);
    expect(r.cumples).toBe(1);
  });
});
