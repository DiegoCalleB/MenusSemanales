import "server-only";
import { LUGAR_TIEMPO, type Pronostico, pronosticosDe } from "@/dominio/tiempo";

const URL_PREVISION =
  "https://api.open-meteo.com/v1/forecast" +
  `?latitude=${LUGAR_TIEMPO.latitud}&longitude=${LUGAR_TIEMPO.longitud}` +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum" +
  "&timezone=Europe%2FMadrid&forecast_days=3";

/**
 * La previsión de hoy, mañana y pasado en Madrid (D-145). Se guarda media hora (la previsión no
 * cambia más a menudo). Si Open-Meteo falla o tarda más de 5 s, devuelve `[]`: sin tiempo, pero
 * sin romper el aviso.
 */
export async function leerPrevision(pedir: typeof fetch = fetch): Promise<Pronostico[]> {
  try {
    const r = await pedir(URL_PREVISION, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 1800 },
    } as RequestInit);
    if (!r.ok) return [];
    return pronosticosDe(await r.json());
  } catch {
    return [];
  }
}
