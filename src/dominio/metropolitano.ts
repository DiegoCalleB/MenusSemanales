import { z } from "zod";
import { proximaFecha } from "./cumples";
import { type FechaIso, sumarDias } from "./fechas";

/**
 * Lo que pasa en el estadio de al lado (D-159): los partidos del Atlético EN CASA (Liga, Champions,
 * Copa) y los conciertos y eventos grandes del Riyadh Air Metropolitano. Para estar prevenidos:
 * tráfico, calles cortadas, metro lleno y ruido. Puro: recibe lo que dan ESPN y Ticketmaster.
 */

export const ESTADIO = {
  nombre: "Metropolitano",
  /** Id del Atlético de Madrid en ESPN. */
  equipoEspn: "1068",
  latitud: 40.4362,
  longitud: -3.5995,
} as const;

export interface EventoEstadio {
  /** Estable: sirve de clave en el calendario y en los avisos. */
  id: string;
  fecha: FechaIso;
  /** «21:00» en hora de Madrid, o null si aún no está confirmada. */
  hora: string | null;
  tipo: "partido" | "concierto" | "evento";
  /** «Atlético – Real Betis (Liga)» o «Bad Bunny». */
  titulo: string;
}

const enMadrid = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
};

const COMPETICION: Record<string, string> = {
  "esp.1": "Liga",
  "uefa.champions": "Champions",
  "esp.copa_del_rey": "Copa",
  "uefa.europa": "Europa League",
  "esp.super_cup": "Supercopa",
  "uefa.nations": "Nations League",
  "fifa.friendly": "amistoso",
  "fifa.worldq.uefa": "clasificación para el Mundial",
  "uefa.euroq": "clasificación para la Eurocopa",
  "esp.w.1": "Liga F",
  "uefa.wchampions": "Champions femenina",
};

/** Los nombres de ESPN (en inglés) que más pueden jugar aquí, en español. */
const NOMBRES: Record<string, string> = {
  "Atlético Madrid": "Atlético",
  Spain: "España",
  England: "Inglaterra",
  France: "Francia",
  Germany: "Alemania",
  Italy: "Italia",
  Portugal: "Portugal",
  Netherlands: "Países Bajos",
  Belgium: "Bélgica",
  Croatia: "Croacia",
  Czechia: "Chequia",
  "Czech Republic": "Chequia",
  Switzerland: "Suiza",
  Denmark: "Dinamarca",
  Scotland: "Escocia",
  Wales: "Gales",
  "Northern Ireland": "Irlanda del Norte",
  "Republic of Ireland": "Irlanda",
  Norway: "Noruega",
  Sweden: "Suecia",
  Poland: "Polonia",
  Turkey: "Turquía",
  Türkiye: "Turquía",
  Greece: "Grecia",
  Serbia: "Serbia",
  Argentina: "Argentina",
  Brazil: "Brasil",
};

const espnSchema = z.object({
  events: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        timeValid: z.boolean().optional(),
        league: z.object({ slug: z.string().optional() }).optional(),
        competitions: z
          .array(
            z.object({
              /** En los listados por mes, ESPN dice aquí si la hora es oficial o provisional. */
              timeValid: z.boolean().optional(),
              venue: z.object({ fullName: z.string().optional() }).optional(),
              competitors: z.array(
                z.object({
                  homeAway: z.string(),
                  team: z.object({ id: z.string(), displayName: z.string() }),
                }),
              ),
            }),
          )
          .min(1),
      }),
    )
    .catch([]),
});

const corto = (n: string) => NOMBRES[n] ?? n;

/**
 * Los partidos en el Metropolitano de una lista de ESPN (los de una competición en un mes): los que
 * ESPN sitúa en el estadio, sea quien sea el local. Si ESPN no dice el estadio, cuenta si el
 * Atlético juega en casa.
 */
export function partidosEnCasa(json: unknown, liga: string): EventoEstadio[] {
  const r = espnSchema.safeParse(json);
  if (!r.success) return [];
  const out: EventoEstadio[] = [];
  for (const e of r.data.events) {
    const c = e.competitions[0]!;
    const local = c.competitors.find((t) => t.homeAway === "home");
    const visitante = c.competitors.find((t) => t.homeAway === "away");
    const estadio = c.venue?.fullName ?? "";
    const aqui = estadio ? /metropolitano/i.test(estadio) : local?.team.id === ESTADIO.equipoEspn;
    if (!aqui) continue;
    const cuando = enMadrid(e.date);
    if (!cuando) continue;
    const comp = COMPETICION[e.league?.slug ?? liga] ?? COMPETICION[liga] ?? "";
    out.push({
      id: `partido-${e.id}`,
      fecha: cuando.fecha,
      // La hora solo si ESPN la da por buena: la de la Liga es provisional hasta unas semanas antes.
      hora: (c.timeValid ?? e.timeValid) === false ? null : cuando.hora,
      tipo: "partido",
      titulo: `${corto(local?.team.displayName ?? "?")} – ${corto(visitante?.team.displayName ?? "?")}${comp ? ` (${comp})` : ""}`,
    });
  }
  return out;
}

const ticketmasterSchema = z.object({
  _embedded: z
    .object({
      events: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          dates: z.object({
            start: z.object({
              localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              localTime: z.string().optional(),
              timeTBA: z.boolean().optional(),
            }),
            status: z.object({ code: z.string().optional() }).optional(),
          }),
          classifications: z
            .array(z.object({ segment: z.object({ name: z.string().optional() }).optional() }))
            .optional(),
          _embedded: z
            .object({ venues: z.array(z.object({ name: z.string().optional() })).optional() })
            .optional(),
        }),
      ),
    })
    .optional(),
});

/** Los conciertos y eventos del Metropolitano que vende Ticketmaster (sin los partidos, ni cancelados). */
export function eventosDeTicketmaster(json: unknown): EventoEstadio[] {
  const r = ticketmasterSchema.safeParse(json);
  if (!r.success) return [];
  const out: EventoEstadio[] = [];
  const vistos = new Set<string>();
  for (const e of r.data._embedded?.events ?? []) {
    const lugar = e._embedded?.venues?.[0]?.name ?? "";
    if (!/metropolitano/i.test(lugar)) continue;
    if (["cancelled", "canceled", "postponed"].includes(e.dates.status?.code ?? "")) continue;
    const segmento = e.classifications?.[0]?.segment?.name ?? "";
    if (/sport/i.test(segmento)) continue; // los partidos vienen de ESPN
    // Ticketmaster repite un mismo concierto con varios nombres (VIP, paquetes…): uno por día.
    const titulo = e.name.replace(/\s*[-|–]\s*(vip|paquete|package|hospitality).*$/i, "").trim();
    const k = `${e.dates.start.localDate}|${titulo.toLowerCase()}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    const hora =
      !e.dates.start.timeTBA && /^\d{2}:\d{2}/.test(e.dates.start.localTime ?? "")
        ? e.dates.start.localTime!.slice(0, 5)
        : null;
    out.push({
      id: `evento-${e.id}`,
      fecha: e.dates.start.localDate,
      hora,
      tipo: /music|música/i.test(segmento) ? "concierto" : "evento",
      titulo: titulo.slice(0, 100),
    });
  }
  return out;
}

/**
 * La clave de un evento para no repetirlo: su día y el primer nombre del artista («Karol», «Harry»…),
 * porque la web y Ticketmaster lo llaman distinto («Karol G» y «KAROL G - VIAJANDO…»).
 */
const claveDeRepetido = (e: EventoEstadio) => {
  const primera = e.titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .find((p) => p.length > 1);
  return `${e.fecha}|${primera ?? e.titulo.toLowerCase()}`;
};

/**
 * Junta y ordena. Un mismo concierto que llega de dos fuentes cuenta una vez, y se queda la versión
 * con hora (la de Ticketmaster, que sí la da). Los partidos no se repiten entre sí.
 */
export function juntarEventos(...listas: ReadonlyArray<readonly EventoEstadio[]>): EventoEstadio[] {
  const todos = listas.flat();
  const mejor = new Map<string, EventoEstadio>();
  const sinRepetir: EventoEstadio[] = [];
  for (const e of todos) {
    if (e.tipo === "partido") {
      if (!sinRepetir.some((x) => x.fecha === e.fecha && x.titulo === e.titulo)) sinRepetir.push(e);
      continue;
    }
    const k = claveDeRepetido(e);
    const actual = mejor.get(k);
    if (!actual || (!actual.hora && e.hora)) mejor.set(k, e);
  }
  return [...sinRepetir, ...mejor.values()].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? ""),
  );
}

/** «⚽ Partido en el Metropolitano a las 21:00: Atlético – Real Betis (Liga)». */
export function textoDelEvento(e: EventoEstadio): string {
  const emoji = e.tipo === "partido" ? "⚽" : e.tipo === "concierto" ? "🎤" : "🏟️";
  const que = e.tipo === "partido" ? "Partido" : e.tipo === "concierto" ? "Concierto" : "Evento";
  const cuando = e.hora ? `a las ${e.hora}` : "(hora por confirmar)";
  return `${emoji} ${que} en el ${ESTADIO.nombre} ${cuando}: ${e.titulo}`;
}

/**
 * El título corto del calendario (D-161): el emoji ya dice que es un partido o un concierto y el
 * sitio es el de siempre, así que solo queda quién: «⚽ España – Inglaterra», «🎤 Bad Bunny».
 */
export function tituloCortoDelEvento(e: EventoEstadio): string {
  const emoji = e.tipo === "partido" ? "⚽" : e.tipo === "concierto" ? "🎤" : "🏟️";
  const que = e.tipo === "partido" ? e.titulo.replace(/\s*\([^)]*\)\s*$/, "") : e.titulo;
  return `${emoji} ${que}`;
}

/** Lo que el hogar tiene apuntado, para ver si choca con algo del estadio (D-163). */
export interface PlanesDelHogar {
  agenda: ReadonlyArray<{ fecha: FechaIso; hasta?: FechaIso | null; titulo: string }>;
  /** Fechas señaladas (fiestas…): fecha → título. */
  eventos: Readonly<Record<string, { titulo: string }>>;
  cumples: ReadonlyArray<{ nombre: string; dia: number; mes: number }>;
}

/**
 * Lo demás que se hace ese día (citas, fiestas señaladas y cumpleaños): si hay algo, el partido o el
 * concierto del estadio de al lado puede liar el tráfico, el aparcamiento y la llegada (D-163).
 */
export function planesDelDia(f: FechaIso, p: PlanesDelHogar): string[] {
  const out: string[] = [];
  for (const a of p.agenda) if (a.fecha <= f && f <= (a.hasta ?? a.fecha)) out.push(a.titulo);
  const ev = p.eventos[f];
  if (ev) out.push(ev.titulo);
  for (const c of p.cumples) if (proximaFecha(c, f) === f) out.push(`Cumple de ${c.nombre}`);
  return out;
}

/** «Partido», «Concierto» o «Evento», con mayúscula, para los títulos cortos. */
export const queEs = (e: EventoEstadio) =>
  e.tipo === "partido" ? "Partido" : e.tipo === "concierto" ? "Concierto" : "Evento";

/** La programación oficial del estadio (D-164): la web que lista los conciertos con su fecha. */
export const PAGINA_PROGRAMACION = "https://www.riyadhairmetropolitano.com/programacion";

const MESES_ES: Record<string, string> = {
  ENERO: "01",
  FEBRERO: "02",
  MARZO: "03",
  ABRIL: "04",
  MAYO: "05",
  JUNIO: "06",
  JULIO: "07",
  AGOSTO: "08",
  SEPTIEMBRE: "09",
  OCTUBRE: "10",
  NOVIEMBRE: "11",
  DICIEMBRE: "12",
};
const NO_SON_NOMBRE =
  /^(COMPRAR|MÁS INFORMACIÓN|Sold-out|Próximamente|POR CONFIRMAR|CATEGORÍA|FECHA|MÚSICA|FÚTBOL|DEPORTE)/i;
const FECHA_WEB = /^(\d{1,2}) · ([A-ZÁÉÍÓÚÑ]+) · (\d{4})(?:\s*-\s*(\d{2}):(\d{2})H)?/;

/**
 * Los eventos de la programación de la web del estadio (D-164): cada bloque es un nombre seguido
 * de una o varias fechas «D · MES · AAAA». Los partidos del Atlético («X vs Y») ya los da ESPN y se
 * dejan fuera para no repetirlos. Puro: recibe el HTML de la página.
 */
export function eventosDeLaWeb(html: string, hoy: string): EventoEstadio[] {
  const texto = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
  const lineas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const hasta = sumarDias(hoy, 450);
  const out: EventoEstadio[] = [];
  let nombre = "";
  for (const linea of lineas) {
    // Varias fechas pueden ir en la misma línea, separadas por «|».
    const partes = linea.split("|").map((p) => p.trim());
    for (const l of partes) {
      const f = FECHA_WEB.exec(l);
      if (!f) {
        // Los nombres son las líneas de texto que no son botones ni etiquetas ni slugs.
        if (!NO_SON_NOMBRE.test(l) && !/^[a-z0-9-]+$/.test(l) && l.length <= 120) nombre = l;
        continue;
      }
      const mes = MESES_ES[f[2]!.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()];
      if (!mes || !nombre) continue;
      const fecha = `${f[3]}-${mes}-${f[1]!.padStart(2, "0")}`;
      if (fecha < hoy || fecha > hasta) continue;
      // Los partidos del Atlético («X vs Y») ya llegan de ESPN: aquí solo los conciertos y eventos.
      if (/\bvs\b/i.test(nombre)) continue;
      const hora = f[4] ? `${f[4]}:${f[5]}` : null;
      const esFinal = /final/i.test(nombre);
      out.push({
        id: `web-${nombre
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}-${fecha}`,
        fecha,
        hora,
        tipo: esFinal ? "evento" : "concierto",
        titulo: nombre.slice(0, 100),
      });
    }
  }
  return out;
}
