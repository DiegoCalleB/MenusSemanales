import { type FechaIso, diasEntre } from "./fechas";

/**
 * Pendientes sin fecha (D-175): lo que hay que hacer «algún día» y no tiene un día concreto (llamar al
 * fontanero, arreglar la persiana, pedir cita…). Se apuntan en dos toques, se marcan al hacerlos y no
 * se quedan olvidados: en «Hoy» salen los más importantes o más antiguos y el domingo se recuerda
 * cuántos hay. Distinto de las tareas de casa (que se repiten) y de las citas (que tienen día). Puro.
 */

export interface Pendiente {
  id: string;
  texto: string;
  /** Quién lo tiene que hacer; null si le da igual a quien pueda. */
  personaId: string | null;
  /** Marcado con la estrella: va por delante. */
  importante: boolean;
  /** El día en que se apuntó (para saber cuánto lleva esperando). */
  creadoEn: FechaIso;
  /** El día en que se hizo; null si sigue pendiente. */
  hechoEn: FechaIso | null;
}

export const MAX_TEXTO_PENDIENTE = 120;
export const MAX_PENDIENTES = 200;
/** Cuánto tiempo se enseña lo hecho (después se olvida solo). */
export const DIAS_HECHOS = 14;

export const texto = (t: string): string => t.replace(/\s+/g, " ").trim();

/** Primero lo importante y, dentro de cada grupo, lo que más lleva esperando. */
export const porUrgencia = (a: Pendiente, b: Pendiente): number =>
  Number(b.importante) - Number(a.importante) ||
  a.creadoEn.localeCompare(b.creadoEn) ||
  a.texto.localeCompare(b.texto, "es");

export const abiertos = (ps: readonly Pendiente[]): Pendiente[] =>
  ps.filter((p) => p.hechoEn === null).sort(porUrgencia);

/** Los hechos en los últimos días, el más reciente primero. */
export const hechosRecientes = (ps: readonly Pendiente[], hoy: FechaIso): Pendiente[] =>
  ps
    .filter((p) => p.hechoEn !== null && diasEntre(p.hechoEn, hoy) <= DIAS_HECHOS)
    .sort((a, b) => (b.hechoEn ?? "").localeCompare(a.hechoEn ?? ""));

/** Quita los hechos que ya no se enseñan, para que la lista no crezca sin fin. */
export const sinHechosViejos = (ps: readonly Pendiente[], hoy: FechaIso): Pendiente[] =>
  ps.filter((p) => p.hechoEn === null || diasEntre(p.hechoEn, hoy) <= DIAS_HECHOS);

/** «de hoy», «de ayer», «hace 5 días», «hace 3 semanas», «hace 2 meses». */
export function textoEspera(creadoEn: FechaIso, hoy: FechaIso): string {
  const d = Math.max(0, diasEntre(creadoEn, hoy));
  if (d === 0) return "de hoy";
  if (d === 1) return "de ayer";
  if (d < 14) return `hace ${d} días`;
  if (d < 60) return `hace ${Math.floor(d / 7)} semanas`;
  return `hace ${Math.floor(d / 30)} meses`;
}

/** Lo de una persona (y lo que no es de nadie), para «Hoy» y para el filtro. */
export const deLaPersona = (ps: readonly Pendiente[], personaId: string | null): Pendiente[] =>
  ps.filter((p) => p.personaId === null || p.personaId === personaId);

/** Lo que merece estar en «Hoy»: como mucho tres, lo importante y lo más antiguo primero. */
export function paraHoy(ps: readonly Pendiente[], personaId: string | null, max = 3): Pendiente[] {
  return abiertos(deLaPersona(ps, personaId)).slice(0, max);
}

/**
 * El recordatorio del domingo: cuántos pendientes hay y el que más lleva (o el más importante). null
 * si no hay nada o todo es de esta misma semana y sin importancia (no se agobia por poco).
 */
export function recordatorioSemanal(
  ps: readonly Pendiente[],
  hoy: FechaIso,
): { cuantos: number; primero: Pendiente } | null {
  const a = abiertos(ps);
  const primero = a[0];
  if (!primero) return null;
  const merece = a.some((p) => p.importante) || diasEntre(primero.creadoEn, hoy) >= 7;
  return merece ? { cuantos: a.length, primero } : null;
}

export interface DatosPendiente {
  texto: string;
  personaId: string | null;
  importante: boolean;
}

export function validarPendiente(
  d: DatosPendiente,
  personasValidas: ReadonlySet<string>,
): { ok: true; datos: DatosPendiente } | { ok: false; motivo: string } {
  const t = texto(d.texto);
  if (t === "" || t.length > MAX_TEXTO_PENDIENTE) {
    return {
      ok: false,
      motivo: `Escribe qué hay que hacer (hasta ${MAX_TEXTO_PENDIENTE} letras).`,
    };
  }
  if (d.personaId !== null && !personasValidas.has(d.personaId)) {
    return { ok: false, motivo: "Esa persona no está en la familia." };
  }
  return {
    ok: true,
    datos: { texto: t, personaId: d.personaId, importante: d.importante === true },
  };
}
