import { type EventoExterno, parsearIcs } from "@/dominio/ics";
import { sumarDias } from "@/dominio/fechas";

const VIDA_CACHE_MS = 15 * 60 * 1000;
const DIAS_VISTA = 60;
let cache: { en: number; texto: string } | null = null;

/** El enlace secreto vive solo en el servidor (variable de entorno); jamás llega al navegador. */
export const enlaceConfigurado = (): boolean => Boolean(process.env.GOOGLE_CALENDAR_ICAL_URL);

/** ¿Es una URL de iCal de Google? Evita que una variable mal puesta haga peticiones a cualquier sitio. */
export function enlaceValido(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "calendar.google.com";
  } catch {
    return false;
  }
}

/** Descarga el calendario (con caché de 15 min) y devuelve los eventos de los próximos 60 días. */
export async function eventosDelCalendario(hoy: string): Promise<EventoExterno[]> {
  const url = process.env.GOOGLE_CALENDAR_ICAL_URL ?? "";
  if (!enlaceValido(url)) throw new Error("enlace-no-valido");
  if (!cache || Date.now() - cache.en > VIDA_CACHE_MS) {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!r.ok) throw new Error("google-no-responde");
    const texto = await r.text();
    if (texto.length > 5_000_000) throw new Error("demasiado-grande");
    cache = { en: Date.now(), texto };
  }
  return parsearIcs(cache.texto, hoy, sumarDias(hoy, DIAS_VISTA));
}
