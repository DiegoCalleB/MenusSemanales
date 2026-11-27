import { type FechaIso, sumarDias } from "./fechas";

/**
 * Recordatorios con hora de Conchi (D-216): «recuérdame a las seis sacar la basura» pone un
 * recordatorio de Alexa y el Echo lo dice en voz alta a esa hora. Aquí se decide el día y la hora
 * exactos (las seis, ¿de la mañana o de la tarde?) y se arma lo que pide la API de Alexa. Puro.
 */

export interface Ahora {
  fecha: FechaIso;
  /** Minutos desde las 00:00, hora de Madrid. */
  minutos: number;
}

/** Ahora, en hora de Madrid. */
export function ahoraEnMadrid(d: Date = new Date()): Ahora {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  return {
    fecha: `${v("year")}-${v("month")}-${v("day")}`,
    minutos: Number(v("hour")) * 60 + Number(v("minute")),
  };
}

const aMinutos = (hora: string): number => {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const aHora = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Cuándo suena. `hora` es «HH:MM»; si `ambigua`, no se dijo «de la mañana» ni «de la tarde» y la
 * hora vale en cualquiera de las dos mitades del día. Sin día, es la próxima vez que llega esa hora.
 * Con día, de 1 a 7 se entiende de la tarde, de 8 a 11 de la mañana y las 12 al mediodía.
 */
export function resolverRecordatorio(
  hora: string,
  ambigua: boolean,
  fecha: FechaIso | null,
  ahora: Ahora,
): { fecha: FechaIso; hora: string } | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  const min = aMinutos(hora);
  const h = Math.floor(min / 60);
  const mitades =
    ambigua && h >= 1 && h <= 12
      ? [min % 720, (min % 720) + 720] // la de la mañana y la de la tarde
      : [min];
  // Con ambigüedad, la mitad que se suele querer: 1–7 tarde; 8–11 mañana; 12, mediodía.
  const habitual =
    mitades.length === 1
      ? (mitades[0] as number)
      : h >= 1 && h <= 7
        ? (mitades[1] as number)
        : h === 12
          ? 720
          : (mitades[0] as number);
  if (fecha) {
    if (fecha < ahora.fecha) return null;
    if (fecha === ahora.fecha && habitual <= ahora.minutos) {
      const otra = mitades.find((m) => m > ahora.minutos);
      return otra === undefined ? null : { fecha, hora: aHora(otra) };
    }
    return { fecha, hora: aHora(habitual) };
  }
  if (habitual > ahora.minutos) return { fecha: ahora.fecha, hora: aHora(habitual) };
  const otra = mitades.find((m) => m > ahora.minutos);
  if (otra !== undefined) return { fecha: ahora.fecha, hora: aHora(otra) };
  return { fecha: sumarDias(ahora.fecha, 1), hora: aHora(habitual) };
}

/** «hoy a las 18:00», «mañana a las 9:30» o «el 3 de diciembre a las 18:00». */
export function cuandoSuena(fecha: FechaIso, hora: string, hoy: FechaIso): string {
  const dia =
    fecha === hoy
      ? "hoy"
      : fecha === sumarDias(hoy, 1)
        ? "mañana"
        : `el ${Number(fecha.slice(8))} del ${Number(fecha.slice(5, 7))}`;
  return `${dia} a las ${hora.replace(/^0/, "")}`;
}

export const PERMISO_RECORDATORIOS = "alexa::alerts:reminders:skill:readwrite";

/** El cuerpo de `POST /v1/alerts/reminders` de Alexa para un recordatorio puntual, en español de España. */
export function cuerpoDeRecordatorio(texto: string, fecha: FechaIso, hora: string, ahora: Date) {
  return {
    requestTime: ahora.toISOString(),
    trigger: {
      type: "SCHEDULED_ABSOLUTE",
      scheduledTime: `${fecha}T${hora}:00.000`,
      timeZoneId: "Europe/Madrid",
    },
    alertInfo: {
      spokenInfo: { content: [{ locale: "es-ES", text: texto.slice(0, 200) }] },
    },
    pushNotification: { status: "ENABLED" },
  };
}
