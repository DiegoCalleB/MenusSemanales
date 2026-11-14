import "server-only";
import { LUGAR_TIEMPO, type Pronostico, pronosticosDe } from "@/dominio/tiempo";

const URL_PREVISION =
  "https://api.open-meteo.com/v1/forecast" +
  `?latitude=${LUGAR_TIEMPO.latitud}&longitude=${LUGAR_TIEMPO.longitud}` +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum" +
  "&hourly=precipitation_probability,precipitation,weather_code" +
  "&timezone=Europe%2FMadrid&forecast_days=3";

/**
 * La previsión de hoy, mañana y pasado junto al cole (D-145, D-148), con la lluvia hora a hora. Se
 * guarda media hora (la previsión no cambia más a menudo), salvo con `fresco` (el aviso de antes
 * de salir de casa la quiere recién leída). Si Open-Meteo falla o tarda más de 5 s, devuelve `[]`:
 * sin tiempo, pero sin romper el aviso.
 */
export async function leerPrevision(
  pedir: typeof fetch = fetch,
  { fresco = false }: { fresco?: boolean } = {},
): Promise<Pronostico[]> {
  try {
    const r = await pedir(URL_PREVISION, {
      signal: AbortSignal.timeout(5000),
      ...(fresco ? { cache: "no-store" } : { next: { revalidate: 1800 } }),
    } as RequestInit);
    if (!r.ok) return [];
    return pronosticosDe(await r.json());
  } catch {
    return [];
  }
}
