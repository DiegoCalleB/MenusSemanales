import "server-only";
import { sumarDias } from "@/dominio/fechas";
import {
  ESTADIO,
  type EventoEstadio,
  PAGINA_PROGRAMACION,
  eventosDeLaWeb,
  eventosDeTicketmaster,
  juntarEventos,
  partidosEnCasa,
} from "@/dominio/metropolitano";

/**
 * Las competiciones que se miran en ESPN, mes a mes: de cada una, TODOS sus partidos, y se queda
 * con los que se juegan en el Metropolitano (sea quien sea: el Atlético, la selección, una final…).
 */
const COMPETICIONES = [
  "esp.1",
  "uefa.champions",
  "uefa.europa",
  "esp.copa_del_rey",
  "esp.super_cup",
  "uefa.nations",
  "fifa.friendly",
  "fifa.worldq.uefa",
  "uefa.euroq",
  "esp.w.1",
  "uefa.wchampions",
] as const;
const MESES = 4;
const DIAS = 120;
/** Los conciertos se anuncian con mucha antelación (los de verano, en otoño): se miran más lejos. */
const DIAS_CONCIERTOS = 450;

async function json(url: string, pedir: typeof fetch): Promise<unknown> {
  const r = await pedir(url, {
    signal: AbortSignal.timeout(4000),
    // Los partidos y conciertos cambian poco: se miran cada seis horas.
    next: { revalidate: 6 * 3600 },
  } as RequestInit);
  if (!r.ok) throw new Error(`http-${r.status}`);
  return r.json();
}

/**
 * Lo que hay en el Metropolitano en los próximos cuatro meses (D-159): los partidos que se juegan
 * allí, del Atlético o de la selección (ESPN, sin clave) y, si hay `TICKETMASTER_API_KEY`, los conciertos y otros eventos. Lo que
 * falle se queda fuera sin romper nada (sin datos, sin avisos del estadio).
 */
export async function leerEventosEstadio(
  hoy: string,
  pedir: typeof fetch = fetch,
  /** Cómo ha ido cada fuente, sin datos secretos: «sin-clave», «ok: 12 eventos (3 en el estadio)»… */
  informe: { ticketmaster?: string; web?: string } = {},
): Promise<EventoEstadio[]> {
  const meses = Array.from({ length: MESES }, (_, i) => {
    const d = new Date(`${hoy.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const partidos = await Promise.all(
    COMPETICIONES.flatMap((liga) =>
      meses.map((mes) =>
        json(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${liga}/scoreboard?dates=${mes}&limit=500`,
          pedir,
        )
          .then((j) => partidosEnCasa(j, liga))
          .catch(() => [] as EventoEstadio[]),
      ),
    ),
  );
  const hasta = sumarDias(hoy, DIAS);
  const hastaConciertos = sumarDias(hoy, DIAS_CONCIERTOS);
  // La programación oficial de la web del estadio (D-164): conciertos y eventos con su fecha.
  let delEstadio: EventoEstadio[] = [];
  try {
    const r = await pedir(PAGINA_PROGRAMACION, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 6 * 3600 },
    } as RequestInit);
    if (!r.ok) throw new Error(`http-${r.status}`);
    delEstadio = eventosDeLaWeb(await r.text(), hoy);
    informe.web = `ok: ${delEstadio.length} eventos`;
  } catch (e) {
    informe.web = `error: ${e instanceof Error ? e.message.slice(0, 40) : "desconocido"}`;
  }
  const clave = process.env.TICKETMASTER_API_KEY?.trim();
  let conciertos: EventoEstadio[] = [];
  if (!clave) {
    informe.ticketmaster = "sin-clave";
  } else {
    try {
      // Un radio de 2 km alrededor del estadio, con los nombres en cualquier idioma y desde hoy.
      const j = await json(
        "https://app.ticketmaster.com/discovery/v2/events.json" +
          `?apikey=${encodeURIComponent(clave)}&latlong=${ESTADIO.latitud},${ESTADIO.longitud}` +
          `&radius=2&unit=km&locale=*&size=200&sort=date,asc&countryCode=ES` +
          `&startDateTime=${hoy}T00:00:00Z&endDateTime=${hastaConciertos}T23:59:59Z`,
        pedir,
      );
      conciertos = eventosDeTicketmaster(j);
      const brutos = (j as { page?: { totalElements?: number } } | null)?.page?.totalElements;
      informe.ticketmaster = `ok: ${typeof brutos === "number" ? brutos : "?"} eventos cerca, ${conciertos.length} en el estadio`;
    } catch (e) {
      informe.ticketmaster = `error: ${e instanceof Error ? e.message.slice(0, 40) : "desconocido"}`;
    }
  }
  const lejos = (e: EventoEstadio) => e.fecha <= (e.tipo === "partido" ? hasta : hastaConciertos);
  return juntarEventos(...partidos, conciertos, delEstadio).filter(
    (e) => e.fecha >= hoy && lejos(e),
  );
}
