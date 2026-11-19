import { type FechaIso, diasEntre, sumarDias } from "./fechas";

/**
 * Qué apartados de «Hoy» se usan (D-189). Es solo local (en cada móvil): cuenta toques por apartado
 * y día, sin saber qué se tocó ni quién. Sirve para recortar con datos: un apartado que lleva dos
 * semanas sin tocarse se pliega solo y vuelve a su sitio con un toque. Puro.
 */

export interface UsoSeccion {
  nombre: string;
  /** El primer día en que se vio (para no juzgar un apartado recién llegado). */
  visto: FechaIso;
  /** Toques por día (solo los últimos). */
  usos: Record<FechaIso, number>;
}

export type UsoHoy = Record<string, UsoSeccion>;

const DIAS_QUE_SE_GUARDAN = 45;
export const DIAS_SIN_USO = 14;

/** Apunta que ese apartado existe (sin contar un toque). Devuelve el mismo objeto si nada cambia. */
export function verSeccion(u: UsoHoy, id: string, nombre: string, hoy: FechaIso): UsoHoy {
  const actual = u[id];
  if (actual && actual.nombre === nombre) return u;
  return { ...u, [id]: { nombre, visto: actual?.visto ?? hoy, usos: actual?.usos ?? {} } };
}

/** Cuenta un toque en ese apartado hoy. */
export function usarSeccion(u: UsoHoy, id: string, nombre: string, hoy: FechaIso): UsoHoy {
  const base = verSeccion(u, id, nombre, hoy)[id]!;
  const desde = sumarDias(hoy, -DIAS_QUE_SE_GUARDAN);
  const usos = Object.fromEntries(Object.entries(base.usos).filter(([f]) => f >= desde));
  usos[hoy] = (usos[hoy] ?? 0) + 1;
  return { ...u, [id]: { ...base, nombre, usos } };
}

/** Toques de los últimos `dias` días (hoy incluido). */
export function usosRecientes(u: UsoHoy, id: string, hoy: FechaIso, dias = DIAS_SIN_USO): number {
  const desde = sumarDias(hoy, -(dias - 1));
  return Object.entries(u[id]?.usos ?? {})
    .filter(([f]) => f >= desde && f <= hoy)
    .reduce((n, [, c]) => n + c, 0);
}

/** ¿Lleva `dias` días visible sin que nadie lo toque? (Uno recién visto no cuenta.) */
export function sinUso(u: UsoHoy, id: string, hoy: FechaIso, dias = DIAS_SIN_USO): boolean {
  const s = u[id];
  if (!s) return false;
  return diasEntre(s.visto, hoy) >= dias && usosRecientes(u, id, hoy, dias) === 0;
}

/** Para la pantalla de cuenta: cada apartado con sus toques de las dos últimas semanas. */
export function resumenDeUso(
  u: UsoHoy,
  hoy: FechaIso,
  dias = DIAS_SIN_USO,
): Array<{ id: string; nombre: string; usos: number; sinUso: boolean }> {
  return Object.entries(u)
    .map(([id, s]) => ({
      id,
      nombre: s.nombre,
      usos: usosRecientes(u, id, hoy, dias),
      sinUso: sinUso(u, id, hoy, dias),
    }))
    .sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre, "es"));
}

/** Lo guardado en el móvil, ya limpio (por si lo escrito no tiene la forma esperada). */
export function usoDeAlmacen(crudo: unknown): UsoHoy {
  if (!crudo || typeof crudo !== "object") return {};
  const out: UsoHoy = {};
  for (const [id, v] of Object.entries(crudo as Record<string, unknown>).slice(0, 60)) {
    const s = v as Partial<UsoSeccion> | null;
    if (!s || typeof s.nombre !== "string" || typeof s.visto !== "string") continue;
    const usos: Record<FechaIso, number> = {};
    if (s.usos && typeof s.usos === "object") {
      for (const [f, n] of Object.entries(s.usos)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(f) && Number.isInteger(n) && n > 0) usos[f as FechaIso] = n;
      }
    }
    out[id] = { nombre: s.nombre.slice(0, 60), visto: s.visto as FechaIso, usos };
  }
  return out;
}
