import { z } from "zod";
import type { PlanBarrio } from "./barrio";
import { type FechaIso, sumarDias } from "./fechas";

/**
 * Eventos del Centro Comercial Las Rosas (D-172). Su web es un WordPress con entradas de texto libre
 * («Durante los días 9, 10, 11, 12, 16, 17 y 18…»), no una agenda con fechas. Se leen las entradas
 * recientes y la IA saca de ellas los días y horas; aquí se valida todo antes de enseñarlo. Puro.
 */

export const WEB_CENTRO = "https://www.cclasrosas.es";
/** «Eventos» y «Actividades infantiles» de su WordPress (las ofertas y sorteos van en otra). */
export const CATEGORIAS_CENTRO = [1, 16] as const;
export const LUGAR_CENTRO = "C.C. Las Rosas";
export const esLasRosas = (lugar: string): boolean =>
  /c\.?c\.? las rosas|centro comercial las rosas/i.test(lugar);

/** Cuántos días hacia atrás se miran las entradas, y hacia delante los eventos que se aceptan. */
export const DIAS_ATRAS_ENTRADAS = 75;
const DIAS_ADELANTE = 150;
const MAX_TEXTO_ENTRADA = 2500;

export interface EntradaCentro {
  id: number;
  /** Fecha de publicación (AAAA-MM-DD). */
  fecha: FechaIso;
  titulo: string;
  enlace: string;
  texto: string;
}

const sinEtiquetas = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

const entradaSchema = z.object({
  id: z.number().int(),
  date: z.string(),
  link: z.string().url(),
  title: z.object({ rendered: z.string() }),
  content: z.object({ rendered: z.string() }),
});

/** Las entradas de la web (respuesta de `wp-json/wp/v2/posts`) como texto limpio. */
export function entradasDelCentro(json: unknown): EntradaCentro[] {
  if (!Array.isArray(json)) return [];
  const out: EntradaCentro[] = [];
  for (const crudo of json) {
    const p = entradaSchema.safeParse(crudo);
    if (!p.success) continue;
    const fecha = p.data.date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !p.data.link.startsWith(`${WEB_CENTRO}/`)) continue;
    out.push({
      id: p.data.id,
      fecha,
      titulo: sinEtiquetas(p.data.title.rendered).slice(0, 120),
      enlace: p.data.link,
      texto: sinEtiquetas(p.data.content.rendered).slice(0, MAX_TEXTO_ENTRADA),
    });
  }
  return out;
}

export const INSTRUCCIONES_CENTRO = `Eres un asistente que lee las novedades de un centro comercial de Madrid (C.C. Las Rosas) y saca
SOLO los eventos y actividades con día concreto a los que se puede ir: talleres, teatro de títeres,
espectáculos, experiencias, juegos, visitas de personajes, mercadillos, etc.
- NO incluyas sorteos, concursos, ofertas, aperturas de tiendas ni promociones sin actividad a la que acudir.
- Cada entrada trae su fecha de publicación. Si el texto da los días sin mes («los días 9, 10 y 11»),
  el mes y el año son los más cercanos POSTERIORES a la publicación. Si se dice que un evento «queda aplazado» a otras fechas, usa las nuevas.
- «fechas» son los días concretos (AAAA-MM-DD) en que ocurre. Si dura varios días seguidos, lista cada uno
  (como mucho 14). Si no puedes saber el día con certeza, no incluyas el evento.
- «hora»: la primera hora de inicio (HH:MM, 24 horas) o null si no se dice o varía mucho.
- «gratis»: true salvo que se diga que se paga.
- «familiar»: true si es para niños o para ir en familia.
- «tipo»: uno de «taller», «teatro», «juego», «otro».
- «entradaId»: el id de la entrada de la que sale.
No inventes nada.`;

export const mensajeCentro = (entradas: readonly EntradaCentro[], hoy: FechaIso): string =>
  `Hoy es ${hoy}. Entradas (id | publicada | título | texto):\n\n${entradas
    .map((e) => `### ${e.id} | ${e.fecha} | ${e.titulo}\n${e.texto}`)
    .join("\n\n")}\n\nDevuelve el JSON pedido.`;

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const respuestaCentroSchema = z.object({
  eventos: z
    .array(
      z.object({
        entradaId: z.number().int(),
        titulo: z
          .string()
          .trim()
          .min(1)
          .transform((t) => t.slice(0, 100)),
        fechas: z.array(fecha).min(1).max(14),
        hora: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .nullable()
          .catch(null),
        gratis: z.boolean().catch(true),
        familiar: z.boolean().catch(false),
        tipo: z.enum(["taller", "teatro", "juego", "otro"]).catch("otro"),
      }),
    )
    .max(30),
});
export type EventosLeidos = z.infer<typeof respuestaCentroSchema>;

const EMOJI = { taller: "🎨", teatro: "🎭", juego: "🎲", otro: "🛍️" } as const;

/**
 * De lo que dice la IA a planes del barrio: solo de entradas que existen, con días razonables (de
 * hoy a 150 días y a menos de 150 días de la publicación) y sin repetir. Un día por plan.
 */
export function planesDelCentro(
  leidos: EventosLeidos,
  entradas: readonly EntradaCentro[],
  hoy: FechaIso,
): PlanBarrio[] {
  const limite = sumarDias(hoy, DIAS_ADELANTE);
  const out: PlanBarrio[] = [];
  const vistos = new Set<string>();
  for (const e of leidos.eventos) {
    const entrada = entradas.find((x) => x.id === e.entradaId);
    if (!entrada) continue;
    for (const dia of new Set(e.fechas)) {
      if (dia < hoy || dia > limite || dia < sumarDias(entrada.fecha, -1)) continue;
      if (dia > sumarDias(entrada.fecha, DIAS_ADELANTE)) continue;
      if (Number.isNaN(Date.parse(`${dia}T12:00:00Z`))) continue;
      const clave = `${e.entradaId}|${dia}|${e.titulo.toLowerCase()}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push({
        id: `cc-${e.entradaId}-${out.length}`,
        fecha: dia,
        hasta: null,
        hora: e.hora,
        titulo: e.titulo,
        lugar: LUGAR_CENTRO,
        barrio: "Rosas",
        gratis: e.gratis,
        precio: null,
        enlace: entrada.enlace,
        familiar: e.familiar,
        serie: false,
        emoji: EMOJI[e.tipo],
      });
    }
  }
  return out;
}
