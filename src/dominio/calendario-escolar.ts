import { z } from "zod";
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

/** Los cursos revisados a mano: mandan sobre lo que se lea automáticamente del mismo curso. */
export const CURSOS: readonly CursoEscolar[] = [CURSO_MADRID_2026_27];

let leidos: readonly CursoEscolar[] = [];

/**
 * Los cursos leídos automáticamente (D-146), que guarda la base de datos. Se registran al cargar
 * (en el navegador) o en cada petición (en el servidor). Los de `CURSOS` siempre mandan.
 */
export function registrarCursos(cursos: readonly CursoEscolar[]): void {
  leidos = cursos.filter(
    (c) =>
      validarCurso(c).length === 0 &&
      !CURSOS.some((x) => x.inicio.slice(0, 4) === c.inicio.slice(0, 4)),
  );
}

/** Todos los cursos conocidos: los revisados a mano y los leídos que no chocan con ellos. */
export const cursosConocidos = (): readonly CursoEscolar[] => [...CURSOS, ...leidos];

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
  cursosConocidos().find((c) => c.cubreDesde <= f && f <= c.cubreHasta) ?? null;

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
  cursosConocidos().reduce((m, c) => (c.cubreHasta > m ? c.cubreHasta : m), "0000-00-00");

// ---------------------------------------------------------------------------------------------
// Leer el calendario de cada curso automáticamente (D-146)
// ---------------------------------------------------------------------------------------------

/** Lo que se saca del calendario oficial (con IA): solo Infantil (2.º ciclo) y Primaria. */
export interface CalendarioLeido {
  /** Primer y último día de clase. */
  inicio: FechaIso;
  fin: FechaIso;
  /** Vacaciones (Navidad, Semana Santa), ambos días incluidos. */
  periodos: ReadonlyArray<{ desde: FechaIso; hasta: FechaIso; motivo: string }>;
  /** Festivos y días no lectivos sueltos entre el inicio y el fin. */
  dias: ReadonlyArray<{ fecha: FechaIso; motivo: string }>;
}

/** Domingo de Pascua (algoritmo de Gauss/Meeus, calendario gregoriano). */
export function domingoDePascua(anio: number): FechaIso {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Las dos fiestas locales de Madrid capital: la Almudena (9 de noviembre) y San Isidro (15 de
 * mayo). En domingo pasan al lunes, como ha hecho el Ayuntamiento; en sábado no quitan cole.
 */
export function fiestasLocalesMadrid(
  anioInicio: number,
): Array<{ fecha: FechaIso; motivo: string }> {
  const out: Array<{ fecha: FechaIso; motivo: string }> = [];
  for (const [f, motivo] of [
    [`${anioInicio}-11-09`, "La Almudena (fiesta local)"],
    [`${anioInicio + 1}-05-15`, "San Isidro (fiesta local)"],
  ] as const) {
    const d = diaSemanaIso(f);
    if (d === 7) out.push({ fecha: sumarDias(f, 1), motivo });
    else if (d !== 6) out.push({ fecha: f, motivo });
  }
  return out;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fechaValida = (f: string) =>
  FECHA.test(f) && new Date(`${f}T12:00:00Z`).toISOString().slice(0, 10) === f;
const recorta = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, MAX_LARGO_MOTIVO);

/**
 * Monta el curso a partir de lo leído: verano antes y después, vacaciones, días sueltos y las
 * fiestas locales de Madrid. Los días que caen dentro de unas vacaciones no se repiten.
 */
export function cursoDesdeLeido(l: CalendarioLeido, fuente: string): CursoEscolar {
  const y = Number(l.inicio.slice(0, 4));
  const cubreDesde = `${y}-07-01`;
  const cubreHasta = `${y + 1}-08-31`;
  // Con el inicio o el fin mal escritos no se monta nada: `validarCurso` lo rechazará.
  if (!fechaValida(l.inicio) || !fechaValida(l.fin)) {
    const nombre = `Curso ${l.inicio}`;
    return { nombre, inicio: l.inicio, fin: l.fin, cubreDesde, cubreHasta, sinCole: [], fuente };
  }
  const periodos = l.periodos
    .filter((p) => fechaValida(p.desde) && fechaValida(p.hasta) && p.desde <= p.hasta)
    .map((p) => ({ desde: p.desde, hasta: p.hasta, motivo: recorta(p.motivo) || "Vacaciones" }));
  const dentro = (f: FechaIso) => periodos.some((p) => p.desde <= f && f <= p.hasta);
  const sueltos = new Map<FechaIso, string>();
  for (const d of [...l.dias, ...fiestasLocalesMadrid(y)]) {
    if (!fechaValida(d.fecha) || dentro(d.fecha) || sueltos.has(d.fecha)) continue;
    sueltos.set(d.fecha, recorta(d.motivo) || "Día no lectivo");
  }
  const tramos: TramoSinCole[] = [
    { desde: cubreDesde, hasta: sumarDias(l.inicio, -1), motivo: "Vacaciones de verano" },
    ...periodos,
    ...[...sueltos].map(([f, motivo]) => dia(f, motivo)),
    { desde: sumarDias(l.fin, 1), hasta: cubreHasta, motivo: "Vacaciones de verano" },
  ]
    .filter((t) => t.desde <= t.hasta)
    .sort((a, b) => a.desde.localeCompare(b.desde));
  return {
    nombre: `Curso ${y}/${y + 1} · Madrid capital`,
    inicio: l.inicio,
    fin: l.fin,
    cubreDesde,
    cubreHasta,
    sinCole: tramos,
    fuente,
  };
}

/** Los días lectivos del curso (de lunes a viernes, sin vacaciones ni festivos). */
export function diasLectivos(c: CursoEscolar): FechaIso[] {
  const out: FechaIso[] = [];
  for (let f = c.inicio; f <= c.fin; f = sumarDias(f, 1)) {
    if (diaSemanaIso(f) <= 5 && !c.sinCole.some((t) => t.desde <= f && f <= t.hasta)) out.push(f);
  }
  return out;
}

/**
 * Todo lo que tiene que cumplir un calendario escolar para darlo por bueno. Vacío si vale; si
 * no, por qué. Un calendario que no pasa esto no se usa (la app sigue avisando de más).
 */
export function validarCurso(c: CursoEscolar): string[] {
  const errores: string[] = [];
  if (!fechaValida(c.inicio) || !fechaValida(c.fin))
    return ["Fechas de inicio o fin mal escritas."];
  const y = Number(c.inicio.slice(0, 4));
  if (c.inicio.slice(5, 7) !== "09" || diaSemanaIso(c.inicio) > 5)
    errores.push("El curso no empieza un día de septiembre entre semana.");
  if (c.fin.slice(0, 7) !== `${y + 1}-06` || diaSemanaIso(c.fin) > 5)
    errores.push("El curso no acaba un día de junio entre semana del año siguiente.");
  if (c.cubreDesde !== `${y}-07-01` || c.cubreHasta !== `${y + 1}-08-31`)
    errores.push("No cubre del 1 de julio al 31 de agosto.");
  let antes = "0000-00-00";
  for (const t of c.sinCole) {
    if (!fechaValida(t.desde) || !fechaValida(t.hasta) || t.desde > t.hasta) {
      errores.push(`Tramo mal escrito: ${t.desde}–${t.hasta}.`);
      continue;
    }
    if (t.desde <= antes) errores.push(`Tramos solapados o desordenados en ${t.desde}.`);
    if (t.desde < c.cubreDesde || t.hasta > c.cubreHasta)
      errores.push(`Tramo fuera del curso: ${t.desde}.`);
    if (!t.motivo || t.motivo.length > MAX_LARGO_MOTIVO)
      errores.push(`Motivo vacío en ${t.desde}.`);
    antes = t.hasta;
  }
  const libre = (f: FechaIso) => c.sinCole.some((t) => t.desde <= f && f <= t.hasta);
  if (!libre(`${y}-12-25`) || !libre(`${y + 1}-01-01`) || !libre(`${y + 1}-01-06`))
    errores.push("Falta la Navidad (25 de diciembre, 1 y 6 de enero).");
  const pascua = domingoDePascua(y + 1);
  if (!libre(sumarDias(pascua, -2)) || !libre(sumarDias(pascua, -3)))
    errores.push("Falta la Semana Santa (Jueves y Viernes Santo).");
  for (const fijo of [`${y}-10-12`, `${y}-12-08`]) {
    if (diaSemanaIso(fijo) <= 5 && !libre(fijo)) errores.push(`Falta el festivo del ${fijo}.`);
  }
  const n = errores.length === 0 ? diasLectivos(c).length : 0;
  if (errores.length === 0 && (n < 175 || n > 190))
    errores.push(`Salen ${n} días lectivos: lo normal es entre 175 y 190.`);
  return errores;
}

/** Un curso guardado en la base de datos (lo que se lee de ella se vuelve a comprobar). */
export const cursoEscolarSchema = z.object({
  nombre: z.string().max(80),
  inicio: z.string(),
  fin: z.string(),
  cubreDesde: z.string(),
  cubreHasta: z.string(),
  sinCole: z
    .array(z.object({ desde: z.string(), hasta: z.string(), motivo: z.string().max(80) }))
    .max(80),
  fuente: z.string().max(300),
});

/** Lo que devuelve `calendarios_escolares()`: los cursos que valen y la última comprobación. */
export const calendariosEscolaresSchema = z.object({
  cursos: z
    .array(
      z.object({
        anio: z.number().int(),
        curso: z.unknown(),
        cambiadoEn: z.string().nullish(),
      }),
    )
    .catch([]),
  comprobadoEn: z.string().nullish(),
  resultado: z.string().nullish(),
});

export interface CalendariosEscolares {
  cursos: Array<CursoEscolar & { cambiadoEn: string | null }>;
  comprobadoEn: string | null;
  resultado: string | null;
}

/** Interpreta la respuesta; los cursos mal formados o que no pasan `validarCurso` se descartan. */
export function calendariosEscolaresDe(json: unknown): CalendariosEscolares {
  const r = calendariosEscolaresSchema.safeParse(json);
  if (!r.success) return { cursos: [], comprobadoEn: null, resultado: null };
  const cursos: CalendariosEscolares["cursos"] = [];
  for (const c of r.data.cursos) {
    const v = cursoEscolarSchema.safeParse(c.curso);
    if (v.success && validarCurso(v.data).length === 0) {
      cursos.push({ ...v.data, cambiadoEn: c.cambiadoEn ?? null });
    }
  }
  return {
    cursos,
    comprobadoEn: r.data.comprobadoEn ?? null,
    resultado: r.data.resultado ?? null,
  };
}
