import { type FechaIso, enRango } from "./fechas";
import type { Carga, Persona, Turno } from "./tipos";

/**
 * Reparto de la carga mental (D-032). La carga de una persona en una semana es:
 *
 *   ejecución     minutos de los turnos que le tocan (cocinar, ir a comprar...)
 *   planificación minutos de trabajo INVISIBLE (acordarse, decidir, organizar) de las cargas de las
 *                 que es responsable
 *
 * El panel cuenta las dos: la planificación es justo lo que suele recaer en una sola persona y
 * pasa desapercibido. Todo es neutral y descriptivo: calcula minutos y porcentajes, no juzga.
 */

export interface CargaDePersona {
  personaId: string;
  ejecucionMin: number;
  planificacionMin: number;
  totalMin: number;
  /** Porcentaje del total del hogar (0-100). Si no hay carga, 0. */
  porcentaje: number;
}

export interface Reparto {
  personas: CargaDePersona[];
  totalMin: number;
  /** Cargas activas que nadie tiene asignadas: trabajo sin dueño. */
  sinResponsable: Carga[];
  /** Diferencia en puntos porcentuales entre quien más y quien menos carga. 0 con una sola persona. */
  diferenciaPuntos: number;
}

const adultasActivas = (personas: readonly Persona[]) =>
  personas.filter((p) => p.tipo === "adulto" && p.activa);

export function calcularReparto(args: {
  personas: readonly Persona[];
  cargas: readonly Carga[];
  turnos: readonly Turno[];
  semana: { desde: FechaIso; hasta: FechaIso };
}): Reparto {
  const { cargas, turnos, semana } = args;
  const adultas = adultasActivas(args.personas);
  const activas = cargas.filter((c) => c.activa);
  const porId = new Map(activas.map((c) => [c.id, c]));

  const ejecucion = new Map<string, number>(adultas.map((p) => [p.id, 0]));
  const planificacion = new Map<string, number>(adultas.map((p) => [p.id, 0]));

  for (const t of turnos) {
    const carga = porId.get(t.cargaId);
    if (!carga || t.estado === "saltado" || !enRango(t.fecha, semana.desde, semana.hasta)) continue;
    if (ejecucion.has(t.personaId))
      ejecucion.set(t.personaId, (ejecucion.get(t.personaId) ?? 0) + carga.esfuerzoMin);
  }
  for (const c of activas) {
    if (c.responsableId !== null && planificacion.has(c.responsableId)) {
      planificacion.set(
        c.responsableId,
        (planificacion.get(c.responsableId) ?? 0) + c.planificacionMin,
      );
    }
  }

  const filas = adultas.map((p) => {
    const e = ejecucion.get(p.id) ?? 0;
    const pl = planificacion.get(p.id) ?? 0;
    return { personaId: p.id, ejecucionMin: e, planificacionMin: pl, totalMin: e + pl };
  });
  const totalMin = filas.reduce((s, f) => s + f.totalMin, 0);
  const personas = filas.map((f) => ({
    ...f,
    porcentaje: totalMin === 0 ? 0 : Math.round((f.totalMin / totalMin) * 1000) / 10,
  }));
  const porcentajes = personas.map((p) => p.porcentaje);
  const diferenciaPuntos =
    personas.length < 2
      ? 0
      : Math.round((Math.max(...porcentajes) - Math.min(...porcentajes)) * 10) / 10;

  const ids = new Set(adultas.map((p) => p.id));
  const sinResponsable = activas.filter(
    (c) => c.responsableId === null || !ids.has(c.responsableId),
  );
  return { personas, totalMin, sinResponsable, diferenciaPuntos };
}

export interface Ocurrencia {
  cargaId: string;
  fecha: FechaIso;
}

export interface PropuestaRotacion {
  turnos: Turno[];
  /** Ocurrencias que nadie puede hacer (todas las personas no disponibles ese día). */
  sinAsignar: Ocurrencia[];
}

/**
 * Propone quién ejecuta cada ocurrencia para igualar los minutos totales de cada persona.
 *
 * Reparto voraz determinista: las ocurrencias más costosas primero, cada una a la persona con
 * menos carga en ese momento (contando la planificación de la que ya es responsable y lo ya
 * asignado). A igualdad de carga gana quien es responsable de esa carga, y después el orden por id.
 */
export function proponerRotacion(args: {
  personas: readonly Persona[];
  cargas: readonly Carga[];
  ocurrencias: readonly Ocurrencia[];
  /** Turnos ya repartidos que cuentan como carga de partida. */
  turnosExistentes?: readonly Turno[];
  /** Personas que no pueden ese día (viaje, turno de trabajo...). */
  noDisponible?: ReadonlyArray<{ personaId: string; fecha: FechaIso }>;
}): PropuestaRotacion {
  const adultas = adultasActivas(args.personas).sort((a, b) => a.id.localeCompare(b.id));
  const activas = new Map(args.cargas.filter((c) => c.activa).map((c) => [c.id, c]));
  const indisponibles = new Set((args.noDisponible ?? []).map((n) => `${n.personaId}|${n.fecha}`));

  const carga = new Map<string, number>(adultas.map((p) => [p.id, 0]));
  for (const c of activas.values()) {
    if (c.responsableId !== null && carga.has(c.responsableId)) {
      carga.set(c.responsableId, (carga.get(c.responsableId) ?? 0) + c.planificacionMin);
    }
  }
  for (const t of args.turnosExistentes ?? []) {
    const c = activas.get(t.cargaId);
    if (c && t.estado !== "saltado" && carga.has(t.personaId)) {
      carga.set(t.personaId, (carga.get(t.personaId) ?? 0) + c.esfuerzoMin);
    }
  }

  const pendientes = args.ocurrencias
    .filter((o) => activas.has(o.cargaId))
    .map((o) => ({ ...o, esfuerzo: activas.get(o.cargaId)?.esfuerzoMin ?? 0 }))
    .sort(
      (a, b) =>
        b.esfuerzo - a.esfuerzo ||
        a.fecha.localeCompare(b.fecha) ||
        a.cargaId.localeCompare(b.cargaId),
    );

  const turnos: Turno[] = [];
  const sinAsignar: Ocurrencia[] = [];
  for (const o of pendientes) {
    const candidatas = adultas.filter((p) => !indisponibles.has(`${p.id}|${o.fecha}`));
    if (candidatas.length === 0) {
      sinAsignar.push({ cargaId: o.cargaId, fecha: o.fecha });
      continue;
    }
    const responsable = activas.get(o.cargaId)?.responsableId ?? null;
    const elegida = [...candidatas].sort(
      (a, b) =>
        (carga.get(a.id) ?? 0) - (carga.get(b.id) ?? 0) ||
        Number(b.id === responsable) - Number(a.id === responsable),
    )[0];
    if (!elegida) continue; // inalcanzable: candidatas no está vacía
    carga.set(elegida.id, (carga.get(elegida.id) ?? 0) + o.esfuerzo);
    turnos.push({ cargaId: o.cargaId, fecha: o.fecha, personaId: elegida.id, estado: "pendiente" });
  }

  turnos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cargaId.localeCompare(b.cargaId));
  sinAsignar.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cargaId.localeCompare(b.cargaId));
  return { turnos, sinAsignar };
}
