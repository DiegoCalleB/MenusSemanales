import { type FechaIso, diaSemanaIso, sumarDias } from "./fechas";

/**
 * Qué llevar (D-136): lo que cada niño tiene que llevar al cole o a una actividad. La carpeta de
 * piano los martes, los patines los viernes, la autorización de la excursión el día 20… Es la carga
 * mental que no está en ningún sitio: la app avisa **el día que hay que dejarlo preparado** (por
 * defecto, la víspera) y lo enseña en «Hoy».
 */

export interface CosaQueLlevar {
  id: string;
  personaId: string;
  texto: string;
  /** Días de la semana en que se lleva (1 = lunes … 7 = domingo). Vacío si es de un día suelto. */
  dias: number[];
  /** Un día suelto (excursión, disfraz). Si hay `fecha`, `dias` no cuenta. */
  fecha: FechaIso | null;
  /** Con cuántos días de antelación hay que dejarlo preparado (0 = el mismo día, 1 = la víspera). */
  antes: number;
  /** Días de uso (no de preparación) ya marcados como preparados. */
  preparadas: FechaIso[];
}

export const NOMBRE_DIA_CORTO = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;
export const NOMBRE_DIA_LARGO = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

/** Máximo de días de antelación (una semana). */
export const MAX_ANTES = 7;

/** ¿Se lleva ese día? */
export function tocaLlevar(c: CosaQueLlevar, dia: FechaIso): boolean {
  return c.fecha ? c.fecha === dia : c.dias.includes(diaSemanaIso(dia));
}

/** Lo que hay que llevar ese día. */
export function paraLlevar(cosas: readonly CosaQueLlevar[], dia: FechaIso): CosaQueLlevar[] {
  return cosas.filter((c) => tocaLlevar(c, dia));
}

export interface Preparar {
  cosa: CosaQueLlevar;
  /** El día en que se lleva. */
  para: FechaIso;
  hecho: boolean;
}

/** Lo que hay que dejar preparado HOY (para el día que toque según su antelación). */
export function paraPreparar(cosas: readonly CosaQueLlevar[], hoy: FechaIso): Preparar[] {
  const out: Preparar[] = [];
  for (const c of cosas) {
    const para = sumarDias(hoy, c.antes);
    if (tocaLlevar(c, para)) out.push({ cosa: c, para, hecho: c.preparadas.includes(para) });
  }
  return out;
}

/** Los días de preparación desde `desde` durante `dias` días: para el calendario y el plan semanal. */
export function preparacionesEntre(
  cosas: readonly CosaQueLlevar[],
  desde: FechaIso,
  dias: number,
): Array<{ dia: FechaIso; cosa: CosaQueLlevar; para: FechaIso }> {
  const out: Array<{ dia: FechaIso; cosa: CosaQueLlevar; para: FechaIso }> = [];
  for (let i = 0; i < dias; i++) {
    const dia = sumarDias(desde, i);
    for (const p of paraPreparar(cosas, dia)) out.push({ dia, cosa: p.cosa, para: p.para });
  }
  return out;
}

/** «los martes», «los lunes y jueves», «el viernes 20». */
export function cuandoSeLleva(c: CosaQueLlevar): string {
  if (c.fecha) {
    const d = Number(c.fecha.slice(8, 10));
    return `el ${NOMBRE_DIA_LARGO[diaSemanaIso(c.fecha) - 1]} ${d}`;
  }
  const nombres = [...c.dias].sort((a, b) => a - b).map((d) => NOMBRE_DIA_LARGO[d - 1] ?? "");
  // «los martes», «los sábados»: el plural de lunes a viernes es igual; sábado y domingo llevan «s».
  const plural = nombres.map((n) => (n.endsWith("s") ? n : `${n}s`));
  if (plural.length === 0) return "";
  if (plural.length === 1) return `los ${plural[0]}`;
  return `los ${plural.slice(0, -1).join(", ")} y ${plural.at(-1)}`;
}

/** «la víspera», «el mismo día», «2 días antes». */
export function cuandoSePrepara(antes: number): string {
  if (antes <= 0) return "el mismo día";
  if (antes === 1) return "la víspera";
  return `${antes} días antes`;
}

/** Quita de `preparadas` los días ya pasados (para que no crezca sin fin). */
export function podarPreparadas(c: CosaQueLlevar, hoy: FechaIso): CosaQueLlevar {
  const desde = sumarDias(hoy, -14);
  const quedan = c.preparadas.filter((f) => f >= desde);
  return quedan.length === c.preparadas.length ? c : { ...c, preparadas: quedan };
}
