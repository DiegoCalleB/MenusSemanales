import { z } from "zod";
import type { FechaIso } from "./fechas";

/**
 * El tiempo (D-145): la previsión del día en Madrid y qué ponerse o llevar. Va en el aviso de la
 * mañana (el de hoy) y en el de la noche (el de mañana), junto a la mochila, y en «Hoy».
 *
 * Fuente: Open-Meteo (gratis y sin clave). Si no responde, no hay avisos del tiempo y todo lo
 * demás sigue igual: el tiempo nunca bloquea un aviso.
 */

/**
 * Las Musas (San Blas), junto al cole (CEIP Mariano José de Larra, D-148). Redondeado a dos
 * decimales (~1 km): basta para la previsión y no apunta a ninguna casa.
 */
export const LUGAR_TIEMPO = { nombre: "Las Musas", latitud: 40.43, longitud: -3.61 } as const;

/**
 * Las horas en que se está en la calle por el cole (D-148): la ida (de 7 a 10) y la vuelta (de 13
 * a 17, cubre la salida a las 13, a las 14 y a las 16). En Open-Meteo, la hora «08:00» es lo que
 * llueve de 7 a 8: por eso las franjas van por horas de fin.
 */
export const FRANJAS_COLE = {
  ida: { nombre: "de camino al cole", desde: 7, hasta: 10 },
  vuelta: { nombre: "a la salida del cole", desde: 13, hasta: 17 },
} as const;
export type FranjaCole = keyof typeof FRANJAS_COLE;

/** Lo que se espera en una hora (la que acaba a `hora`). */
export interface HoraDeLluvia {
  /** Hora de fin, 0-23: 8 es «de 7 a 8». */
  hora: number;
  prob: number;
  mm: number;
  codigo: number;
}

export interface Pronostico {
  fecha: FechaIso;
  /** Código WMO del tiempo que hará. */
  codigo: number;
  max: number;
  min: number;
  /** Probabilidad máxima de lluvia del día (0-100). */
  probLluvia: number;
  /** Lluvia total prevista (mm). */
  lluviaMm: number;
  /** Hora a hora (D-148), si vino en la respuesta. */
  horas?: HoraDeLluvia[];
}

/** Umbrales: ante la duda, avisar (mejor llevar el chubasquero y no usarlo). */
export const UMBRAL = {
  probLluvia: 50,
  lluviaMm: 1,
  frio: 4,
  calor: 30,
  /**
   * Una hora de camino al cole cuenta como de lluvia con mucho menos (D-148): un chubasco con un
   * 25 % de probabilidad también moja. Basta una de las tres: 30 %, 0,1 mm o el código de lluvia.
   */
  horaProb: 30,
  horaMm: 0.1,
} as const;

const lista = <T extends z.ZodType>(t: T) => z.array(t.nullable());

/** La respuesta de Open-Meteo (`daily`), tal cual la da, convertida en días. */
export const respuestaOpenMeteo = z.object({
  daily: z.object({
    time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    weather_code: lista(z.number()),
    temperature_2m_max: lista(z.number()),
    temperature_2m_min: lista(z.number()),
    precipitation_probability_max: lista(z.number()),
    precipitation_sum: lista(z.number()),
  }),
  /** Hora a hora (D-148). Opcional: sin ella, el aviso es el del día, como antes. */
  hourly: z
    .object({
      time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
      precipitation_probability: lista(z.number()),
      precipitation: lista(z.number()),
      weather_code: lista(z.number()),
    })
    .optional()
    .catch(undefined),
});

/** Los días de la respuesta; los que vienen incompletos se descartan (mejor nada que inventar). */
export function pronosticosDe(json: unknown): Pronostico[] {
  const r = respuestaOpenMeteo.safeParse(json);
  if (!r.success) return [];
  const d = r.data.daily;
  const porDia = new Map<string, HoraDeLluvia[]>();
  const h = r.data.hourly;
  h?.time.forEach((t, i) => {
    const prob = h.precipitation_probability[i];
    const mm = h.precipitation[i];
    const codigo = h.weather_code[i];
    // Una hora a medias no se usa; si falta alguna de la franja, se avisa por el día (ver abajo).
    if (prob == null || mm == null || codigo == null) return;
    const fecha = t.slice(0, 10);
    porDia.set(fecha, [
      ...(porDia.get(fecha) ?? []),
      { hora: Number(t.slice(11, 13)), prob, mm, codigo },
    ]);
  });
  const out: Pronostico[] = [];
  d.time.forEach((fecha, i) => {
    const codigo = d.weather_code[i];
    const max = d.temperature_2m_max[i];
    const min = d.temperature_2m_min[i];
    if (codigo == null || max == null || min == null) return;
    out.push({
      fecha,
      codigo,
      max,
      min,
      probLluvia: d.precipitation_probability_max[i] ?? 0,
      lluviaMm: d.precipitation_sum[i] ?? 0,
      ...(porDia.has(fecha) ? { horas: porDia.get(fecha) } : {}),
    });
  });
  return out;
}

const esTormenta = (c: number) => c >= 95 && c <= 99;
const esNieve = (c: number) => (c >= 71 && c <= 77) || c === 85 || c === 86;

/** ¿Moja esa hora? Ante la duda, sí (D-148). Llovizna, lluvia, chubascos, nieve y tormenta. */
export const horaDeLluvia = (h: HoraDeLluvia) =>
  h.prob >= UMBRAL.horaProb || h.mm >= UMBRAL.horaMm || h.codigo >= 51;

export interface LluviaEnFranja {
  franja: FranjaCole;
  /** Primera y última hora con lluvia, como horas de reloj: «de 8 a 9». */
  desde: number;
  hasta: number;
  prob: number;
  mm: number;
  /** No vino la previsión hora a hora de la franja: se avisa por el día, por si acaso. */
  sinDetalle: boolean;
}

/**
 * ¿Llueve en esa franja del cole (D-148)? Con la previsión hora a hora; si falta alguna hora de la
 * franja, se mira el día entero (ante la duda, avisar).
 */
export function lluviaEnFranja(p: Pronostico, franja: FranjaCole): LluviaEnFranja | null {
  const { desde, hasta } = FRANJAS_COLE[franja];
  const horas = (p.horas ?? []).filter((h) => h.hora > desde && h.hora <= hasta);
  if (horas.length < hasta - desde) {
    const llueve =
      p.probLluvia >= UMBRAL.probLluvia || p.lluviaMm >= UMBRAL.lluviaMm || p.codigo >= 51;
    return llueve
      ? { franja, desde, hasta, prob: p.probLluvia, mm: p.lluviaMm, sinDetalle: true }
      : null;
  }
  const mojan = horas.filter(horaDeLluvia);
  if (mojan.length === 0) return null;
  return {
    franja,
    desde: Math.min(...mojan.map((h) => h.hora)) - 1,
    hasta: Math.max(...mojan.map((h) => h.hora)),
    prob: Math.max(...mojan.map((h) => h.prob)),
    mm: Math.round(mojan.reduce((t, h) => t + h.mm, 0) * 10) / 10,
    sinDetalle: false,
  };
}

/** «de camino al cole (de 8 a 9 h, 70 %)». */
export function textoDeLluvia(l: LluviaEnFranja): string {
  return `${FRANJAS_COLE[l.franja].nombre} (de ${l.desde} a ${l.hasta} h, ${Math.round(l.prob)} %)`;
}

/**
 * «llueve de camino al cole (de 8 a 9 h, 70 %) y a la salida del cole (…)» o, si no vino la
 * previsión hora a hora, «puede llover a la hora del cole (70 % en el día)». Vacío si no moja.
 */
export function textoDeLluviaDelCole(l: readonly LluviaEnFranja[]): string {
  if (l.length === 0) return "";
  const sinDetalle = l.find((x) => x.sinDetalle);
  if (sinDetalle) {
    return `puede llover a la hora del cole (${Math.round(sinDetalle.prob)} % en el día)`;
  }
  return `llueve ${l.map(textoDeLluvia).join(" y ")}`;
}

export interface ConsejoTiempo {
  clave: "tormenta" | "nieve" | "lluvia" | "frio" | "calor";
  emoji: string;
  /** «Lluvia (65 %)». */
  que: string;
  /** «chubasquero y botas». */
  llevar: string;
}

/** Qué ponerse o llevar ese día. Vacío si hace un día normal. */
export function consejosDelTiempo(p: Pronostico): ConsejoTiempo[] {
  const out: ConsejoTiempo[] = [];
  const grados = (n: number) => `${Math.round(n)} °C`;
  if (esTormenta(p.codigo)) {
    out.push({ clave: "tormenta", emoji: "⛈️", que: "Tormentas", llevar: "chubasquero y botas" });
  } else if (esNieve(p.codigo)) {
    out.push({ clave: "nieve", emoji: "❄️", que: "Nieve", llevar: "abrigo, guantes y botas" });
  } else if (p.probLluvia >= UMBRAL.probLluvia || p.lluviaMm >= UMBRAL.lluviaMm) {
    out.push({
      clave: "lluvia",
      emoji: "🌧️",
      que: `Lluvia (${Math.round(p.probLluvia)} %)`,
      llevar: "chubasquero y botas",
    });
  }
  if (p.min <= UMBRAL.frio && !out.some((c) => c.clave === "nieve")) {
    out.push({
      clave: "frio",
      emoji: "🧣",
      que: `Frío (mín. ${grados(p.min)})`,
      llevar: "abrigo, gorro y guantes",
    });
  }
  if (p.max >= UMBRAL.calor) {
    out.push({
      clave: "calor",
      emoji: "☀️",
      que: `Calor (máx. ${grados(p.max)})`,
      llevar: "gorra, crema y agua",
    });
  }
  return out;
}

/** «🌦️ 10–14 °C» para enseñar el día de un vistazo. */
export function resumenDelTiempo(p: Pronostico): string {
  const c = p.codigo;
  const emoji = esTormenta(c)
    ? "⛈️"
    : esNieve(c)
      ? "❄️"
      : c >= 51
        ? "🌧️"
        : c >= 45
          ? "🌫️"
          : c >= 3
            ? "☁️"
            : c >= 1
              ? "⛅"
              : "☀️";
  return `${emoji} ${Math.round(p.min)}–${Math.round(p.max)} °C`;
}
