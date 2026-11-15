import "server-only";
import { sumarDias } from "@/dominio/fechas";
import {
  ESTADIO,
  type EventoEstadio,
  eventosDeTicketmaster,
  juntarEventos,
  partidosEnCasa,
} from "@/dominio/metropolitano";

/** Las competiciones del Atlético en ESPN: Liga, Champions, Copa y, por si acaso, Europa League. */
const LIGAS = ["esp.1", "uefa.champions", "esp.copa_del_rey", "uefa.europa"] as const;
const DIAS = 120;

async function json(url: string, pedir: typeof fetch): Promise<unknown> {
  const r = await pedir(url, {
    signal: AbortSignal.timeout(6000),
    // Los partidos y conciertos cambian poco: se miran cada seis horas.
    next: { revalidate: 6 * 3600 },
  } as RequestInit);
  if (!r.ok) throw new Error(`http-${r.status}`);
  return r.json();
}

/**
 * Lo que hay en el Metropolitano en los próximos cuatro meses (D-159): los partidos del Atlético en
 * casa (ESPN, sin clave) y, si hay `TICKETMASTER_API_KEY`, los conciertos y otros eventos. Lo que
 * falle se queda fuera sin romper nada (sin datos, sin avisos del estadio).
 */
export async function leerEventosEstadio(
  hoy: string,
  pedir: typeof fetch = fetch,
): Promise<EventoEstadio[]> {
  const partidos = await Promise.all(
    LIGAS.map((liga) =>
      json(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${liga}/teams/${ESTADIO.equipoEspn}/schedule?fixture=true`,
        pedir,
      )
        .then((j) => partidosEnCasa(j, liga))
        .catch(() => [] as EventoEstadio[]),
    ),
  );
  const clave = process.env.TICKETMASTER_API_KEY?.trim();
  const conciertos = clave
    ? await json(
        "https://app.ticketmaster.com/discovery/v2/events.json" +
          `?apikey=${encodeURIComponent(clave)}&latlong=${ESTADIO.latitud},${ESTADIO.longitud}` +
          "&radius=1&unit=km&size=100&sort=date,asc&countryCode=ES",
        pedir,
      )
        .then(eventosDeTicketmaster)
        .catch(() => [] as EventoEstadio[])
    : [];
  const hasta = sumarDias(hoy, DIAS);
  return juntarEventos(...partidos, conciertos).filter((e) => e.fecha >= hoy && e.fecha <= hasta);
}
