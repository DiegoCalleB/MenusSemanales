import { z } from "zod";
import type { Apunte } from "@/dominio/agenda";
import type { TareaCasa } from "@/dominio/casa";
import type { Cumple, EstadoRegalo } from "@/dominio/cumples";
import type { FechaIso } from "@/dominio/fechas";
import { esUuid, idDeLegado, idDerivado } from "@/dominio/identificadores";
import type { Tarea } from "@/dominio/tareas";
import type { Persona } from "@/dominio/tipos";
import type { EstadoHogar } from "./estado";

/**
 * Puente entre el estado de la app y las tablas del hogar (D-088, D-090). Es PURO: no habla con la
 * red. Tiene dos mitades:
 *
 *  · `diferencias(antes, despues, hogar)` calcula, por identificador, qué filas hay que crear,
 *    cambiar o borrar para que las tablas reflejen el estado nuevo. Es lo que se envía a
 *    `aplicar_cambios_tablas`. Solo se manda lo que cambió.
 *  · `aplicarLecturaDeTablas(estado, json)` pone en el estado lo que devuelve `leer_hogar_tablas`.
 *
 * Los ids antiguos (`c-3`, `diego`…) no son UUID: `aUuid` les da un UUID estable por hogar, así
 * que los datos de antes se pueden llevar a tablas sin cambiar el estado y sin duplicar al repetir.
 */

/** UUID para un id que puede ser antiguo. Los ids que ya son UUID se respetan. */
export function aUuid(hogarId: string, id: string): string {
  return esUuid(id) ? id : idDeLegado(hogarId, id);
}

const uuidONulo = (hogarId: string, id: string | null | undefined): string | null =>
  id ? aUuid(hogarId, id) : null;

// --------------------------------------------------------------------------------------------
// Forma de los cambios que entiende `aplicar_cambios_tablas`
// --------------------------------------------------------------------------------------------

export interface FilaPersona {
  id: string;
  nombre: string;
  tipo: Persona["tipo"];
  factorRacion: number;
  activa: boolean;
}

export interface FilaCumple {
  id: string;
  nombre: string;
  dia: number;
  mes: number;
  anio: number | null;
  relacion: Cumple["relacion"];
  personaId: string | null;
  /** Solo si cambió (o es nuevo): ausente = no tocar. */
  regalo?: { estado: EstadoRegalo; anioEstado: number | null; gustos: string[] };
  /** Solo si cambió (o es nuevo): presente = la lista completa. */
  ideas?: Array<{ id: string; texto: string; origen: "persona" }>;
}

export interface FilaApunte {
  id: string;
  fecha: FechaIso;
  hasta: FechaIso | null;
  hora: string | null;
  titulo: string;
}

export interface FilaFecha {
  fecha: FechaIso;
  titulo: string;
  emoji: string;
}

export interface FilaDia {
  fecha: FechaIso;
  llegaTarde: boolean;
  saltado: boolean;
}

export interface FilaCasa {
  id: string;
  titulo: string;
  emoji: string;
  cadaDias: number;
  responsableId: string | null;
  ultimaVez: FechaIso | null;
  desde: FechaIso;
  aplazadaHasta: FechaIso | null;
  compra: string | null;
}

export interface FilaTarea {
  id: string;
  personaId: string;
  texto: string;
  frecuencia: Tarea["frecuencia"];
  /** Solo si cambió (o es nueva): presente = la lista completa de días hechos. */
  hechas?: FechaIso[];
}

interface Grupo<T, B = string> {
  upsert?: T[];
  borrar?: B[];
}

export interface CambiosTablas {
  personas?: Grupo<FilaPersona>;
  horizonte?: EstadoHogar["horizonte"];
  dias?: Grupo<FilaDia, FechaIso>;
  cumples?: Grupo<FilaCumple>;
  agenda?: Grupo<FilaApunte>;
  fechas?: Grupo<FilaFecha, FechaIso>;
  casa?: Grupo<FilaCasa>;
  tareas?: Grupo<FilaTarea>;
}

// --------------------------------------------------------------------------------------------
// Estado → filas
// --------------------------------------------------------------------------------------------

const MAX_IDEAS = 50;

function filaPersona(h: string, p: Persona): FilaPersona {
  return {
    id: aUuid(h, p.id),
    nombre: p.nombre,
    tipo: p.tipo,
    factorRacion: p.factorRacion,
    activa: p.activa,
  };
}

function regaloDe(c: Cumple): NonNullable<FilaCumple["regalo"]> {
  return {
    estado: c.estado,
    anioEstado: c.anioEstado ?? null,
    gustos: c.gustos ?? [],
  };
}

/** Las ideas son texto en la app; en la tabla tienen id. Se deriva del cumple y del texto. */
function ideasDe(h: string, c: Cumple): NonNullable<FilaCumple["ideas"]> {
  const cumpleId = aUuid(h, c.id);
  const vistas = new Set<string>();
  const salida: NonNullable<FilaCumple["ideas"]> = [];
  for (const texto of c.ideas.slice(0, MAX_IDEAS)) {
    const id = idDerivado(cumpleId, `idea:${texto.trim().toLowerCase()}`);
    if (vistas.has(id)) continue;
    vistas.add(id);
    salida.push({ id, texto, origen: "persona" });
  }
  return salida;
}

function filaCumple(h: string, c: Cumple): FilaCumple {
  return {
    id: aUuid(h, c.id),
    nombre: c.nombre,
    dia: c.dia,
    mes: c.mes,
    anio: c.anio ?? null,
    relacion: c.relacion,
    personaId: uuidONulo(h, c.personaId),
    regalo: regaloDe(c),
    ideas: ideasDe(h, c),
  };
}

function filaApunte(h: string, a: Apunte): FilaApunte {
  return {
    id: aUuid(h, a.id),
    fecha: a.fecha,
    hasta: a.hasta,
    hora: a.hora,
    titulo: a.titulo,
  };
}

function filaCasa(h: string, t: TareaCasa): FilaCasa {
  return {
    id: aUuid(h, t.id),
    titulo: t.titulo,
    emoji: t.emoji,
    cadaDias: t.cadaDias,
    responsableId: uuidONulo(h, t.responsableId),
    ultimaVez: t.ultimaVez,
    desde: t.desde,
    aplazadaHasta: t.aplazadaHasta ?? null,
    compra: t.compra ?? null,
  };
}

function filaTarea(h: string, t: Tarea): FilaTarea {
  return {
    id: aUuid(h, t.id),
    personaId: aUuid(h, t.personaId),
    texto: t.texto,
    frecuencia: t.frecuencia,
    hechas: [...t.hechas].sort(),
  };
}

function filasDia(e: EstadoHogar): Map<FechaIso, FilaDia> {
  const mapa = new Map<FechaIso, FilaDia>();
  for (const f of e.llegoTarde) mapa.set(f, { fecha: f, llegaTarde: true, saltado: false });
  for (const f of e.saltados) {
    mapa.set(f, { fecha: f, llegaTarde: mapa.get(f)?.llegaTarde ?? false, saltado: true });
  }
  return mapa;
}

// --------------------------------------------------------------------------------------------
// Diferencias
// --------------------------------------------------------------------------------------------

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Compara dos listas de filas por clave y devuelve las filas nuevas o cambiadas y las claves borradas. */
function comparar<T>(
  antes: Map<string, T>,
  despues: Map<string, T>,
  cambiada: (a: T, d: T) => T | null,
): { upsert: T[]; borrar: string[] } {
  const upsert: T[] = [];
  for (const [clave, d] of despues) {
    const a = antes.get(clave);
    if (a === undefined) upsert.push(d);
    else {
      const c = cambiada(a, d);
      if (c) upsert.push(c);
    }
  }
  const borrar = [...antes.keys()].filter((k) => !despues.has(k));
  return { upsert, borrar };
}

const porId = <T extends { id: string }>(filas: T[]) => new Map(filas.map((f) => [f.id, f]));

function conGrupo<K extends keyof CambiosTablas>(
  salida: CambiosTablas,
  clave: K,
  r: { upsert: unknown[]; borrar: string[] },
): void {
  if (r.upsert.length === 0 && r.borrar.length === 0) return;
  const grupo: Grupo<unknown> = {};
  if (r.upsert.length > 0) grupo.upsert = r.upsert;
  if (r.borrar.length > 0) grupo.borrar = r.borrar;
  (salida as Record<string, unknown>)[clave] = grupo;
}

/**
 * Qué hay que escribir en las tablas para pasar de `antes` a `despues`. Devuelve `null` si no hay
 * nada que escribir (la mayoría de los cambios del estado no tocan estas tablas).
 */
export function diferencias(
  antes: EstadoHogar,
  despues: EstadoHogar,
  hogarId: string,
): CambiosTablas | null {
  const salida: CambiosTablas = {};

  conGrupo(
    salida,
    "personas",
    comparar(
      porId(antes.personas.map((p) => filaPersona(hogarId, p))),
      porId(despues.personas.map((p) => filaPersona(hogarId, p))),
      (a, d) => (igual(a, d) ? null : d),
    ),
  );

  if (antes.horizonte !== despues.horizonte) salida.horizonte = despues.horizonte;

  conGrupo(
    salida,
    "dias",
    comparar(filasDia(antes), filasDia(despues), (a, d) => (igual(a, d) ? null : d)),
  );

  conGrupo(
    salida,
    "cumples",
    comparar(
      porId(antes.cumples.map((c) => filaCumple(hogarId, c))),
      porId(despues.cumples.map((c) => filaCumple(hogarId, c))),
      (a, d) => {
        const base = { ...d };
        delete base.regalo;
        delete base.ideas;
        const baseA = { ...a };
        delete baseA.regalo;
        delete baseA.ideas;
        const cambioBase = !igual(baseA, base);
        const cambioRegalo = !igual(a.regalo, d.regalo);
        const cambioIdeas = !igual(a.ideas, d.ideas);
        if (!cambioBase && !cambioRegalo && !cambioIdeas) return null;
        // Lo que no cambió no se manda: quien cumple no puede escribir su propio regalo, y así
        // cambiar el nombre de su cumple no se lo reescribe.
        return {
          ...base,
          ...(cambioRegalo ? { regalo: d.regalo } : {}),
          ...(cambioIdeas ? { ideas: d.ideas } : {}),
        };
      },
    ),
  );

  conGrupo(
    salida,
    "agenda",
    comparar(
      porId(antes.agenda.map((a) => filaApunte(hogarId, a))),
      porId(despues.agenda.map((a) => filaApunte(hogarId, a))),
      (a, d) => (igual(a, d) ? null : d),
    ),
  );

  const fechas = (e: EstadoHogar) =>
    new Map<string, FilaFecha>(
      Object.entries(e.eventos).map(([fecha, v]) => [
        fecha,
        { fecha: fecha as FechaIso, titulo: v.titulo, emoji: v.emoji },
      ]),
    );
  conGrupo(
    salida,
    "fechas",
    comparar(fechas(antes), fechas(despues), (a, d) => (igual(a, d) ? null : d)),
  );

  conGrupo(
    salida,
    "casa",
    comparar(
      porId(antes.casa.map((t) => filaCasa(hogarId, t))),
      porId(despues.casa.map((t) => filaCasa(hogarId, t))),
      (a, d) => (igual(a, d) ? null : d),
    ),
  );

  conGrupo(
    salida,
    "tareas",
    comparar(
      porId(antes.tareas.map((t) => filaTarea(hogarId, t))),
      porId(despues.tareas.map((t) => filaTarea(hogarId, t))),
      (a, d) => {
        const { hechas: ha, ...ba } = a;
        const { hechas: hd, ...bd } = d;
        const cambioBase = !igual(ba, bd);
        const cambioHechas = !igual(ha, hd);
        if (!cambioBase && !cambioHechas) return null;
        return { ...bd, ...(cambioHechas ? { hechas: hd } : {}) };
      },
    ),
  );

  return Object.keys(salida).length > 0 ? salida : null;
}

/** Todo lo que hay en el estado, como si fuera nuevo: para la importación única a tablas. */
export function cambiosCompletos(e: EstadoHogar, hogarId: string): CambiosTablas {
  const vacio = {
    ...e,
    personas: [],
    cumples: [],
    agenda: [],
    eventos: {},
    casa: [],
    tareas: [],
    llegoTarde: [],
    saltados: [],
    horizonte: "semana" as const,
  };
  return diferencias(vacio, e, hogarId) ?? {};
}

// --------------------------------------------------------------------------------------------
// Lectura: JSON de `leer_hogar_tablas` → estado
// --------------------------------------------------------------------------------------------

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

export const lecturaTablasSchema = z.object({
  personas: z.array(
    z.object({
      id: uuid,
      nombre: z.string().min(1),
      tipo: z.enum(["adulto", "nino"]),
      activa: z.boolean(),
      factorRacion: z.number().positive().max(2),
      vinculada: z.boolean().optional(),
    }),
  ),
  horizonte: z.enum(["semana", "quincena"]),
  llegoTarde: z.array(fechaIso),
  saltados: z.array(fechaIso),
  cumples: z.array(
    z.object({
      id: uuid,
      nombre: z.string().min(1),
      dia: z.number().int().min(1).max(31),
      mes: z.number().int().min(1).max(12),
      anio: z.number().int().nullable(),
      relacion: z.enum(["familia", "amigo", "cole", "otro"]),
      personaId: uuid.nullable(),
      regalo: z
        .object({
          estado: z.enum(["sin-pensar", "idea", "comprado", "entregado"]),
          anioEstado: z.number().int().nullable(),
          gustos: z.array(z.string()),
        })
        .nullable(),
      ideas: z.array(z.object({ id: uuid, texto: z.string(), origen: z.string() })),
    }),
  ),
  agenda: z.array(
    z.object({
      id: uuid,
      fecha: fechaIso,
      hasta: fechaIso.nullable(),
      hora: z.string().nullable(),
      titulo: z.string(),
    }),
  ),
  fechas: z.array(z.object({ fecha: fechaIso, titulo: z.string(), emoji: z.string() })),
  casa: z.array(
    z.object({
      id: uuid,
      titulo: z.string(),
      emoji: z.string(),
      cadaDias: z.number().int().min(1),
      responsableId: uuid.nullable(),
      ultimaVez: fechaIso.nullable(),
      desde: fechaIso,
      aplazadaHasta: fechaIso.nullable(),
      compra: z.string().nullable(),
    }),
  ),
  tareas: z.array(
    z.object({
      id: uuid,
      personaId: uuid,
      texto: z.string(),
      frecuencia: z.enum(["diaria", "puntual"]),
      hechas: z.array(fechaIso),
    }),
  ),
});
export type LecturaTablas = z.infer<typeof lecturaTablasSchema>;

/** Valida lo que devuelve `leer_hogar_tablas`. Lanza si el formato no es el esperado. */
export function leerTablas(json: unknown): LecturaTablas {
  return lecturaTablasSchema.parse(json);
}

/**
 * Pone en el estado lo que hay en las tablas (las secciones que ya viven en tablas). Lo demás del
 * estado (platos, despensa, compra…) no se toca. Para quien cumple, `regalo` llega `null`: el
 * cumple se queda «sin pensar» y sin ideas, que es lo que debe ver.
 */
export function aplicarLecturaDeTablas(e: EstadoHogar, lectura: LecturaTablas): EstadoHogar {
  const eventos: EstadoHogar["eventos"] = {};
  for (const f of lectura.fechas)
    eventos[f.fecha as FechaIso] = { titulo: f.titulo, emoji: f.emoji };
  return {
    ...e,
    personas: lectura.personas.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      activa: p.activa,
      factorRacion: p.factorRacion,
    })),
    horizonte: lectura.horizonte,
    llegoTarde: lectura.llegoTarde as FechaIso[],
    saltados: lectura.saltados as FechaIso[],
    cumples: lectura.cumples.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      dia: c.dia,
      mes: c.mes,
      anio: c.anio,
      relacion: c.relacion,
      personaId: c.personaId,
      gustos: c.regalo?.gustos ?? [],
      ideas: c.ideas.map((i) => i.texto),
      estado: c.regalo?.estado ?? "sin-pensar",
      anioEstado: c.regalo?.anioEstado ?? null,
    })),
    agenda: lectura.agenda.map((a) => ({
      id: a.id,
      fecha: a.fecha as FechaIso,
      hasta: a.hasta as FechaIso | null,
      hora: a.hora,
      titulo: a.titulo,
    })),
    eventos,
    casa: lectura.casa.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      emoji: t.emoji,
      cadaDias: t.cadaDias,
      responsableId: t.responsableId,
      ultimaVez: t.ultimaVez as FechaIso | null,
      desde: t.desde as FechaIso,
      aplazadaHasta: t.aplazadaHasta as FechaIso | null,
      compra: t.compra,
    })),
    tareas: lectura.tareas.map((t) => ({
      id: t.id,
      personaId: t.personaId,
      texto: t.texto,
      frecuencia: t.frecuencia,
      hechas: t.hechas as FechaIso[],
    })),
  };
}
