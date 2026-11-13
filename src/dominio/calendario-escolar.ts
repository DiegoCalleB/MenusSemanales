import { type FechaIso, diaSemanaIso, sumarDias } from "./fechas";

/**
 * Calendario escolar (D-144): qué días hay cole y cuáles no, para no avisar de preparar la mochila
 * del cole cuando al día siguiente no hay clase y para enseñarlo en la app y en el calendario.
 *
 * Fuentes oficiales (copiadas a mano y revisadas una a una; ver `calendario-escolar.test.ts`):
 * - Orden 2034/2026, de 25 de mayo, calendario escolar 2026/2027 (BOCM núm. 131, 4-6-2026):
 *   Infantil (2.º ciclo) y Primaria del 7 de septiembre de 2026 al 18 de junio de 2027; Navidad del
 *   23 de diciembre al 6 de enero; Semana Santa del 20 al 28 de marzo; festivos 2026 (12 oct, 2 nov,
 *   7 y 8 dic); otros días no lectivos 7 y 8 ene, 12 y 15 feb, 19 y 29 mar de 2027.
 * - Decreto 82/2026, de 30 de septiembre, fiestas laborales 2027 (BOCM núm. 234, 1-10-2026).
 * - Fiestas locales de Madrid capital: la Almudena (9 nov 2026) y San Isidro (15 may 2027, sábado).
 *
 * Cada cole tiene además sus días de libre disposición: esos los apunta la familia (`AjusteCole`),
 * y lo que apunta la familia manda sobre lo oficial (también para decir «ese día sí hay cole»).
 *
 * Fuera de los cursos conocidos no se sabe: se supone que hay cole de lunes a viernes. Ante la duda,
 * la app prefiere avisar de más (preparar algo que no hacía falta) que de menos (ir sin ello).
 */

export interface TramoSinCole {
  desde: FechaIso;
  /** Inclusive. Igual que `desde` si es un solo día. */
  hasta: FechaIso;
  motivo: string;
}

export interface CursoEscolar {
  nombre: string;
  /** Primer y último día lectivo. */
  inicio: FechaIso;
  fin: FechaIso;
  /** Lo que cubre este calendario (incluye el verano de antes y de después). */
  cubreDesde: FechaIso;
  cubreHasta: FechaIso;
  /** Festivos, vacaciones y días no lectivos, en orden. */
  sinCole: readonly TramoSinCole[];
  fuente: string;
}

const dia = (f: FechaIso, motivo: string): TramoSinCole => ({ desde: f, hasta: f, motivo });

/** Madrid capital, Infantil (2.º ciclo) y Primaria, curso 2026/2027. */
export const CURSO_MADRID_2026_27: CursoEscolar = {
  nombre: "Curso 2026/2027 · Madrid capital",
  inicio: "2026-09-07",
  fin: "2027-06-18",
  cubreDesde: "2026-07-01",
  cubreHasta: "2027-08-31",
  sinCole: [
    { desde: "2026-07-01", hasta: "2026-09-06", motivo: "Vacaciones de verano" },
    dia("2026-10-12", "Fiesta Nacional de España"),
    dia("2026-11-02", "Todos los Santos"),
    dia("2026-11-09", "La Almudena (fiesta local)"),
    dia("2026-12-07", "Día de la Constitución"),
    dia("2026-12-08", "La Inmaculada"),
    { desde: "2026-12-23", hasta: "2027-01-06", motivo: "Vacaciones de Navidad" },
    { desde: "2027-01-07", hasta: "2027-01-08", motivo: "Día no lectivo" },
    dia("2027-02-12", "Día no lectivo"),
    dia("2027-02-15", "Día no lectivo"),
    dia("2027-03-19", "San José"),
    { desde: "2027-03-20", hasta: "2027-03-28", motivo: "Semana Santa" },
    dia("2027-03-29", "Día no lectivo"),
    dia("2027-05-01", "Fiesta del Trabajo"),
    dia("2027-05-15", "San Isidro (fiesta local)"),
    { desde: "2027-06-19", hasta: "2027-08-31", motivo: "Vacaciones de verano" },
  ],
  fuente:
    "Orden 2034/2026 (BOCM 4-6-2026), Decreto 82/2026 (BOCM 1-10-2026) y fiestas locales de Madrid capital",
};

export const CURSOS: readonly CursoEscolar[] = [CURSO_MADRID_2026_27];

/** Lo que apunta la familia para un día: que no hay cole (y por qué) o que sí lo hay. */
export interface AjusteCole {
  fecha: FechaIso;
  hay: boolean;
  /** Por qué no hay cole («Día de libre disposición»). Vacío si `hay`. */
  motivo: string;
}

export const MAX_LARGO_MOTIVO = 60;

export type OrigenCole = "fin-de-semana" | "oficial" | "familia" | "sin-datos";

export interface DiaDeCole {
  hay: boolean;
  /** Por qué no hay cole; `null` si hay. */
  motivo: string | null;
  origen: OrigenCole | "lectivo";
}

export const cursoDe = (f: FechaIso): CursoEscolar | null =>
  CURSOS.find((c) => c.cubreDesde <= f && f <= c.cubreHasta) ?? null;

const tramoOficial = (f: FechaIso): TramoSinCole | null =>
  cursoDe(f)?.sinCole.find((t) => t.desde <= f && f <= t.hasta) ?? null;

/** Lo que dice el calendario oficial de ese día (sin lo que apunta la familia). */
export function diaOficial(f: FechaIso): DiaDeCole {
  if (diaSemanaIso(f) >= 6) return { hay: false, motivo: "Fin de semana", origen: "fin-de-semana" };
  if (!cursoDe(f)) return { hay: true, motivo: null, origen: "sin-datos" };
  const t = tramoOficial(f);
  return t
    ? { hay: false, motivo: t.motivo, origen: "oficial" }
    : { hay: true, motivo: null, origen: "lectivo" };
}

/** ¿Hay cole ese día? Lo que apunta la familia manda; el fin de semana nunca hay. */
export function diaDeCole(f: FechaIso, ajustes: readonly AjusteCole[]): DiaDeCole {
  if (diaSemanaIso(f) >= 6) return diaOficial(f);
  const a = ajustes.find((x) => x.fecha === f);
  if (a) {
    return a.hay
      ? { hay: true, motivo: null, origen: "familia" }
      : { hay: false, motivo: a.motivo || "No hay cole", origen: "familia" };
  }
  return diaOficial(f);
}

export const hayCole = (f: FechaIso, ajustes: readonly AjusteCole[]): boolean =>
  diaDeCole(f, ajustes).hay;

/** Una función «¿hay cole este día?» para pasar a quien la necesite. */
export const consultaCole =
  (ajustes: readonly AjusteCole[]) =>
  (f: FechaIso): boolean =>
    hayCole(f, ajustes);

/**
 * Los tramos de días SIN cole entre semana desde `desde` durante `dias` días, juntando los seguidos
 * con el mismo motivo (el fin de semana de en medio no corta unas vacaciones). Para el calendario y
 * la lista de «próximos días sin cole».
 */
export function tramosSinCole(
  ajustes: readonly AjusteCole[],
  desde: FechaIso,
  dias: number,
): Array<TramoSinCole & { origen: OrigenCole }> {
  const out: Array<TramoSinCole & { origen: OrigenCole }> = [];
  for (let i = 0; i < dias; i++) {
    const f = sumarDias(desde, i);
    if (diaSemanaIso(f) >= 6) continue;
    const d = diaDeCole(f, ajustes);
    if (d.hay || d.motivo === null) continue;
    const origen = d.origen as OrigenCole;
    const ultimo = out.at(-1);
    // Seguido si entre el último día y este solo hay fin de semana.
    let seguido = false;
    if (ultimo && ultimo.motivo === d.motivo) {
      seguido = true;
      for (let g = sumarDias(ultimo.hasta, 1); g < f; g = sumarDias(g, 1)) {
        if (diaSemanaIso(g) < 6) {
          seguido = false;
          break;
        }
      }
    }
    if (seguido && ultimo) ultimo.hasta = f;
    else out.push({ desde: f, hasta: f, motivo: d.motivo, origen });
  }
  return out;
}

/** ¿Llega el calendario conocido hasta esa fecha? (Para avisar de que falta el del curso siguiente.) */
export const calendarioConocidoHasta = (): FechaIso =>
  CURSOS.reduce((m, c) => (c.cubreHasta > m ? c.cubreHasta : m), "0000-00-00");
