import { type FechaIso, diaSemanaIso, sumarDias } from "./fechas";

/**
 * Medicación (D-166): lo que cada persona tiene que tomar a una hora y ciertos días de la semana
 * («la pastilla de la noche, a las 21:00, de lunes a viernes»). Como la mochila, pero para
 * medicamentos: la app avisa a esa hora, en el móvil de esa persona, y se marca como tomada en «Hoy».
 * El nombre lo pone la familia («Pastilla» basta): es un dato personal y no sale de aquí más que en
 * el aviso al móvil de esa persona. Puro.
 */

export interface Medicamento {
  id: string;
  personaId: string;
  nombre: string;
  /** La hora del aviso, de 0 a 23 (los avisos del servidor salen cada hora en punto). */
  hora: number;
  /** Días de la semana en que se toma (1 = lunes … 7 = domingo). */
  dias: number[];
  /** Días en que ya se ha tomado (solo los últimos, para no crecer sin fin). */
  tomadas: FechaIso[];
}

export const MAX_NOMBRE_MEDICAMENTO = 60;
/** Cuántos días de «tomada» se guardan. */
const DIAS_QUE_SE_GUARDAN = 14;

/** ¿Hay que tomarlo ese día de la semana? */
export const tocaTomar = (m: Pick<Medicamento, "dias">, dia: FechaIso): boolean =>
  m.dias.includes(diaSemanaIso(dia));

/** ¿Falta por tomar ese día? Toca y aún no se ha marcado. */
export const faltaTomar = (m: Medicamento, dia: FechaIso): boolean =>
  tocaTomar(m, dia) && !m.tomadas.includes(dia);

/**
 * Lo que hay que recordar a esa hora (la del reloj, 0-23) de ese día: lo que toca, tiene esa hora y
 * no se ha marcado ya como tomado (si se tomó antes, no se insiste).
 */
export const medicacionesDeLaHora = (
  meds: readonly Medicamento[],
  hoy: FechaIso,
  hora: number,
): Medicamento[] => meds.filter((m) => m.hora === hora && faltaTomar(m, hoy));

/** Quita las marcas viejas. */
export function podarTomadas(m: Medicamento, hoy: FechaIso): Medicamento {
  const desde = sumarDias(hoy, -DIAS_QUE_SE_GUARDAN);
  const tomadas = m.tomadas.filter((f) => f >= desde);
  return tomadas.length === m.tomadas.length ? m : { ...m, tomadas };
}

/** «21:00». */
export const horaTexto = (hora: number): string => `${String(hora).padStart(2, "0")}:00`;

const CORTO = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/** «todos los días», «de lunes a viernes» o «lun, mié y vie». */
export function resumenDeDias(dias: readonly number[]): string {
  const d = [...new Set(dias)].sort((a, b) => a - b);
  if (d.length === 7) return "todos los días";
  if (d.length === 5 && d.every((x, i) => x === i + 1)) return "de lunes a viernes";
  if (d.length === 2 && d[0] === 6 && d[1] === 7) return "los fines de semana";
  const nombres = d.map((x) => CORTO[x - 1] ?? "");
  return nombres.length <= 1
    ? nombres.join("")
    : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

export interface RecordatorioDeMedicacion {
  personaId: string;
  /** El nombre de la persona, para el título. */
  persona: string;
  /** Lo que le toca a esa hora, con el nombre que le ha puesto la familia. */
  nombres: string[];
  hora: number;
}

/**
 * Qué avisar a esa hora, agrupado por persona (una notificación por persona, aunque tome dos cosas
 * a la vez). Solo lo que toca ese día y no está ya marcado como tomado.
 */
export function recordatoriosDeMedicacion(
  meds: readonly Medicamento[],
  personas: ReadonlyArray<{ id: string; nombre: string }>,
  hoy: FechaIso,
  hora: number,
): RecordatorioDeMedicacion[] {
  const porPersona = new Map<string, string[]>();
  for (const m of medicacionesDeLaHora(meds, hoy, hora)) {
    porPersona.set(m.personaId, [...(porPersona.get(m.personaId) ?? []), m.nombre]);
  }
  return [...porPersona.entries()].map(([personaId, nombres]) => ({
    personaId,
    persona: personas.find((p) => p.id === personaId)?.nombre ?? "",
    nombres,
    hora,
  }));
}

/** La notificación del móvil (D-166): «💊 Diego: Pastilla» y qué hacer después. */
export function notificacionDeMedicacion(r: RecordatorioDeMedicacion) {
  return {
    titulo: `💊 ${r.persona ? `${r.persona}: ` : ""}${r.nombres.join(" y ")}`.slice(0, 100),
    cuerpo: `Son las ${horaTexto(r.hora)}. Márcalo como tomado en «Hoy».`,
    // Una por persona: la de una no tapa la de otra (ni los demás avisos del día).
    tag: `medicacion-${r.personaId}`.replace(/[^a-z0-9-]/gi, "").slice(0, 40),
  };
}
