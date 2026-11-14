import { z } from "zod";
import type { FechaIso } from "./fechas";

/**
 * El tiempo (D-145): la previsión del día en Madrid y qué ponerse o llevar. Va en el aviso de la
 * mañana (el de hoy) y en el de la noche (el de mañana), junto a la mochila, y en «Hoy».
 *
 * Fuente: Open-Meteo (gratis y sin clave). Si no responde, no hay avisos del tiempo y todo lo
 * demás sigue igual: el tiempo nunca bloquea un aviso.
 */

/** Madrid capital (Puerta del Sol). */
export const LUGAR_TIEMPO = { nombre: "Madrid", latitud: 40.4168, longitud: -3.7038 } as const;

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
}

/** Umbrales: ante la duda, avisar (mejor llevar el chubasquero y no usarlo). */
export const UMBRAL = {
  probLluvia: 50,
  lluviaMm: 1,
  frio: 4,
  calor: 30,
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
});

/** Los días de la respuesta; los que vienen incompletos se descartan (mejor nada que inventar). */
export function pronosticosDe(json: unknown): Pronostico[] {
  const r = respuestaOpenMeteo.safeParse(json);
  if (!r.success) return [];
  const d = r.data.daily;
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
    });
  });
  return out;
}

const esTormenta = (c: number) => c >= 95 && c <= 99;
const esNieve = (c: number) => (c >= 71 && c <= 77) || c === 85 || c === 86;

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
