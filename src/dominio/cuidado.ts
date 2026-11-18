import { type FechaIso, diaSemanaIso, sumarDias } from "./fechas";

/**
 * Cuidarse (D-182): agua, ejercicio y hábitos sanos de cada persona de la familia. Es personal y
 * amable: se cuentan vasos y semanas (no se castiga un día fallado) y no sale de la app (ni búsqueda,
 * ni IA, ni calendario). Puro.
 */

export interface Habito {
  id: string;
  nombre: string;
}

export interface DiaDeCuidado {
  /** Vasos de agua bebidos ese día. */
  agua: number;
  /** Ids de los hábitos hechos ese día. */
  habitos: string[];
  /** Si hizo ejercicio ese día. */
  ejercicio: boolean;
}

export interface Cuidado {
  personaId: string;
  /** Vasos de agua al día que se propone. */
  metaAgua: number;
  habitos: Habito[];
  /** Qué ejercicio y qué días de la semana (1 = lunes … 7 = domingo); `null` si no se plantea. */
  ejercicio: { nombre: string; dias: number[] } | null;
  /** ¿Quiere avisos en el móvil (agua a media mañana y tarde, y el día de ejercicio)? */
  avisos: boolean;
  /** Lo hecho por día (solo los últimos, para no crecer sin fin). */
  dias: Record<FechaIso, DiaDeCuidado>;
}

export const META_AGUA_POR_DEFECTO = 8;
export const MAX_META_AGUA = 20;
export const MAX_VASOS_AL_DIA = 30;
export const MAX_HABITOS = 6;
export const MAX_NOMBRE_HABITO = 40;
const DIAS_QUE_SE_GUARDAN = 35;

export const diaVacio = (): DiaDeCuidado => ({ agua: 0, habitos: [], ejercicio: false });

/** Lo de esa persona, o lo de partida (8 vasos, sin hábitos ni ejercicio) si aún no ha tocado nada. */
export const cuidadoDe = (lista: readonly Cuidado[], personaId: string): Cuidado => {
  const c = lista.find((x) => x.personaId === personaId);
  // Lo guardado antes de los avisos no tiene el campo: cuenta como «sin avisos».
  if (c) return { ...c, avisos: c.avisos === true };
  return {
    personaId,
    metaAgua: META_AGUA_POR_DEFECTO,
    habitos: [],
    ejercicio: null,
    avisos: false,
    dias: {},
  };
};

export const diaDe = (c: Cuidado, fecha: FechaIso): DiaDeCuidado => c.dias[fecha] ?? diaVacio();

/** Quita lo anterior a cinco semanas. */
export function podarDias(c: Cuidado, hoy: FechaIso): Cuidado {
  const desde = sumarDias(hoy, -DIAS_QUE_SE_GUARDAN);
  const dias = Object.fromEntries(Object.entries(c.dias).filter(([f]) => f >= desde));
  return Object.keys(dias).length === Object.keys(c.dias).length ? c : { ...c, dias };
}

/** El lunes de la semana de ese día. */
export const lunesDe = (dia: FechaIso): FechaIso => sumarDias(dia, 1 - diaSemanaIso(dia));

/** ¿Hoy es día de ejercicio? */
export const tocaEjercicio = (c: Cuidado, dia: FechaIso): boolean =>
  c.ejercicio !== null && c.ejercicio.dias.includes(diaSemanaIso(dia));

function sesionesDeLaSemana(c: Cuidado, lunes: FechaIso): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (diaDe(c, sumarDias(lunes, i)).ejercicio) n++;
  return n;
}

/** «3 de 4 esta semana»: sesiones hechas en la semana de `hoy` y las que se plantean. */
export function semanaDeEjercicio(c: Cuidado, hoy: FechaIso): { hechas: number; objetivo: number } {
  return {
    hechas: sesionesDeLaSemana(c, lunesDe(hoy)),
    objetivo: c.ejercicio?.dias.length ?? 0,
  };
}

/**
 * Semanas seguidas en que se cumplió el objetivo de ejercicio (la de ahora suma si ya lo cumple).
 * Una semana floja corta la racha; un día suelto no.
 */
export function semanasSeguidas(c: Cuidado, hoy: FechaIso): number {
  if (!c.ejercicio || c.ejercicio.dias.length === 0) return 0;
  const objetivo = c.ejercicio.dias.length;
  const lunes = lunesDe(hoy);
  let racha = sesionesDeLaSemana(c, lunes) >= objetivo ? 1 : 0;
  for (let k = 1; k <= 4; k++) {
    if (sesionesDeLaSemana(c, sumarDias(lunes, -7 * k)) >= objetivo) racha++;
    else break;
  }
  return racha;
}

/** El ánimo, según cómo va el agua (nunca un reproche). */
export function animoDeAgua(vasos: number, meta: number): string {
  if (vasos >= meta) return "¡Meta cumplida! 💧";
  if (vasos === 0) return "Empieza con un vaso ahora mismo.";
  if (vasos * 2 >= meta) return "Más de la mitad, ¡sigue así!";
  return "Buen comienzo, un vaso más.";
}

/** Limpia los ajustes que llegan del formulario; `null` si algo no vale. */
export function validarAjustes(entrada: {
  metaAgua: number;
  habitos: readonly string[];
  ejercicio: { nombre: string; dias: readonly number[] } | null;
  avisos: boolean;
}): {
  metaAgua: number;
  habitos: string[];
  ejercicio: { nombre: string; dias: number[] } | null;
  avisos: boolean;
} | null {
  if (
    !Number.isInteger(entrada.metaAgua) ||
    entrada.metaAgua < 1 ||
    entrada.metaAgua > MAX_META_AGUA
  ) {
    return null;
  }
  const habitos = [
    ...new Set(entrada.habitos.map((h) => h.replace(/\s+/g, " ").trim()).filter((h) => h !== "")),
  ];
  if (habitos.length > MAX_HABITOS || habitos.some((h) => h.length > MAX_NOMBRE_HABITO)) {
    return null;
  }
  let ejercicio: { nombre: string; dias: number[] } | null = null;
  if (entrada.ejercicio) {
    const dias = [...new Set(entrada.ejercicio.dias)]
      .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
      .sort((a, b) => a - b);
    const nombre = entrada.ejercicio.nombre.replace(/\s+/g, " ").trim() || "Ejercicio";
    if (nombre.length > MAX_NOMBRE_HABITO) return null;
    if (dias.length > 0) ejercicio = { nombre, dias };
  }
  return { metaAgua: entrada.metaAgua, habitos, ejercicio, avisos: entrada.avisos === true };
}

/** A qué horas (de Madrid) se recuerda el agua y el ejercicio (D-183). */
export const HORAS_DE_AGUA = [11, 17] as const;
export const HORA_DE_EJERCICIO = 18;

/** Lo mínimo que el servidor sabe de una persona para avisarle (sin hábitos). */
export interface CuidadoParaAvisos {
  personaId: string;
  metaAgua: number;
  ejercicio: { nombre: string; dias: readonly number[] } | null;
  dias: ReadonlyArray<{ fecha: FechaIso; agua: number; ejercicio: boolean }>;
}

export interface RecordatorioDeCuidado {
  personaId: string;
  persona: string;
  tipo: "agua" | "ejercicio";
  texto: string;
}

/**
 * Qué recordar a esa hora (D-183). Agua: a las 11 h si lleva menos de un cuarto de la meta y a las
 * 17 h si menos del 60 %; nunca si ya va bien. Ejercicio: a las 18 h si hoy toca y no lo ha marcado.
 * Solo avisa de lo que falta, sin reproches.
 */
export function recordatoriosDeCuidado(
  lista: readonly CuidadoParaAvisos[],
  personas: ReadonlyArray<{ id: string; nombre: string }>,
  hoy: FechaIso,
  hora: number,
): RecordatorioDeCuidado[] {
  const out: RecordatorioDeCuidado[] = [];
  for (const c of lista) {
    const persona = personas.find((p) => p.id === c.personaId)?.nombre ?? "";
    const dia = c.dias.find((d) => d.fecha === hoy);
    const agua = dia?.agua ?? 0;
    const minimo = hora === HORAS_DE_AGUA[0] ? 0.25 : hora === HORAS_DE_AGUA[1] ? 0.6 : 0;
    if (minimo > 0 && agua < c.metaAgua * minimo) {
      out.push({
        personaId: c.personaId,
        persona,
        tipo: "agua",
        texto: `Llevas ${agua} de ${c.metaAgua} vasos de agua. ¿Un vaso ahora?`,
      });
    }
    if (
      hora === HORA_DE_EJERCICIO &&
      c.ejercicio &&
      c.ejercicio.dias.includes(diaSemanaIso(hoy)) &&
      !dia?.ejercicio
    ) {
      out.push({
        personaId: c.personaId,
        persona,
        tipo: "ejercicio",
        texto: `Hoy toca: ${c.ejercicio.nombre}. Márcalo en «Hoy» cuando lo hagas.`,
      });
    }
  }
  return out;
}

/** La notificación del móvil: «💧 Diego, agua» o «🏃 Diego, ejercicio». */
export function notificacionDeCuidado(r: RecordatorioDeCuidado) {
  return {
    titulo:
      `${r.tipo === "agua" ? "💧" : "🏃"} ${r.persona ? `${r.persona}: ` : ""}${r.tipo === "agua" ? "agua" : "ejercicio"}`.slice(
        0,
        100,
      ),
    cuerpo: r.texto.slice(0, 240),
    tag: `cuidado-${r.personaId}-${r.tipo}`.replace(/[^a-z0-9-]/gi, "").slice(0, 40),
  };
}
