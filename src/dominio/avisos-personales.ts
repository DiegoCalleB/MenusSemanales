/**
 * Los avisos del móvil de cada persona (D-204): qué avisos quiere y a qué hora. Todo son interruptores
 * y horas: el servidor no sabe nada más. De 22 a 7 h no se avisa de nada (silencio de la noche): las
 * horas que se pueden elegir van de las 7 a las 21. Puro.
 */

export interface AvisosCfg {
  /** Agua: a qué horas (hasta 4) y, a cada una, solo si va corto. */
  agua: { on: boolean; horas: number[] };
  /** Ejercicio: a esa hora, solo si hoy toca y no está hecho. */
  ejercicio: { on: boolean; hora: number };
  /** Objetivos que se repiten y ya tocan. */
  objetivos: { on: boolean; hora: number };
  /** Revisión del domingo: ideas sin resolver, objetivos parados. */
  revision: { on: boolean; hora: number };
}

/** Las horas que se pueden elegir (el resto es silencio de la noche). */
export const HORA_PRIMERA = 7;
export const HORA_ULTIMA = 21;
export const MAX_HORAS_DE_AGUA = 4;

export const horasPermitidas = (): number[] =>
  Array.from({ length: HORA_ULTIMA - HORA_PRIMERA + 1 }, (_, i) => HORA_PRIMERA + i);

/** Lo de siempre: agua a las 11 y a las 17, ejercicio a las 18, objetivos a las 12, revisión a las 19. */
export const CFG_POR_DEFECTO: AvisosCfg = {
  agua: { on: true, horas: [11, 17] },
  ejercicio: { on: true, hora: 18 },
  objetivos: { on: true, hora: 12 },
  revision: { on: true, hora: 19 },
};

const esHora = (x: unknown): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= HORA_PRIMERA && x <= HORA_ULTIMA;

const interruptor = (x: unknown, defecto: boolean): boolean =>
  typeof x === "boolean" ? x : defecto;

const objeto = (x: unknown): Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

/** Lo que haya, completado con lo de siempre y sin nada fuera de las horas permitidas. */
export function limpiarCfg(x: unknown): AvisosCfg {
  const c = objeto(x);
  const agua = objeto(c.agua);
  const ejercicio = objeto(c.ejercicio);
  const objetivos = objeto(c.objetivos);
  const revision = objeto(c.revision);
  const horas = Array.isArray(agua.horas)
    ? [...new Set(agua.horas.filter(esHora))].sort((a, b) => a - b).slice(0, MAX_HORAS_DE_AGUA)
    : CFG_POR_DEFECTO.agua.horas;
  return {
    agua: { on: interruptor(agua.on, CFG_POR_DEFECTO.agua.on), horas },
    ejercicio: {
      on: interruptor(ejercicio.on, CFG_POR_DEFECTO.ejercicio.on),
      hora: esHora(ejercicio.hora) ? ejercicio.hora : CFG_POR_DEFECTO.ejercicio.hora,
    },
    objetivos: {
      on: interruptor(objetivos.on, CFG_POR_DEFECTO.objetivos.on),
      hora: esHora(objetivos.hora) ? objetivos.hora : CFG_POR_DEFECTO.objetivos.hora,
    },
    revision: {
      on: interruptor(revision.on, CFG_POR_DEFECTO.revision.on),
      hora: esHora(revision.hora) ? revision.hora : CFG_POR_DEFECTO.revision.hora,
    },
  };
}

/**
 * Cuánto del agua de la meta se espera llevar a esa hora para no avisar. A las 11 h, un cuarto; a las
 * 17 h, el 60 % (D-183); a otra hora, en proporción (0,8 × lo que ha pasado del día de 8 a 20 h).
 */
export function minimoDeAgua(hora: number): number {
  if (hora === 11) return 0.25;
  if (hora === 17) return 0.6;
  return Math.min(0.9, Math.max(0.15, (0.8 * (hora - 8)) / 12));
}
