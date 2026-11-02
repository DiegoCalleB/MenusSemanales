import type { FechaIso } from "./fechas";

/**
 * Tareas por persona: la lista que cada miembro de la familia tiene que hacer. Hay dos tipos:
 * las que se repiten cada día (lavarse los dientes, hacer la cama: se marcan cada día y al día
 * siguiente vuelven a estar pendientes) y las puntuales (un examen, bajar las sillas: se hacen una
 * vez). Es la misma idea que el reparto de la casa (D-032): hacer visible lo que cada uno lleva,
 * sin puntuaciones ni reproches.
 */

export type FrecuenciaTarea = "diaria" | "puntual";

export interface Tarea {
  id: string;
  personaId: string;
  texto: string;
  frecuencia: FrecuenciaTarea;
  /** Días en que se marcó como hecha (una puntual tiene a lo sumo uno). */
  hechas: FechaIso[];
}

export function estaHecha(t: Tarea, hoy: FechaIso): boolean {
  return t.frecuencia === "diaria" ? t.hechas.includes(hoy) : t.hechas.length > 0;
}

/** Marca o desmarca la tarea para hoy. Pura: devuelve la tarea nueva. */
export function alternarTarea(t: Tarea, hoy: FechaIso): Tarea {
  if (estaHecha(t, hoy)) {
    return { ...t, hechas: t.frecuencia === "diaria" ? t.hechas.filter((f) => f !== hoy) : [] };
  }
  return { ...t, hechas: t.frecuencia === "diaria" ? [...t.hechas, hoy] : [hoy] };
}

/**
 * Qué se enseña hoy de una persona: las diarias, las puntuales pendientes y las puntuales que se
 * hicieron hoy (para poder desmarcarlas). Las puntuales hechas otro día se esconden.
 */
export function tareasDeHoy(tareas: readonly Tarea[], personaId: string, hoy: FechaIso): Tarea[] {
  return tareas.filter(
    (t) =>
      t.personaId === personaId &&
      (t.frecuencia === "diaria" || t.hechas.length === 0 || t.hechas.includes(hoy)),
  );
}

export function resumenDeTareas(
  tareas: readonly Tarea[],
  personaId: string,
  hoy: FechaIso,
): { total: number; hechas: number } {
  const visibles = tareasDeHoy(tareas, personaId, hoy);
  return { total: visibles.length, hechas: visibles.filter((t) => estaHecha(t, hoy)).length };
}
