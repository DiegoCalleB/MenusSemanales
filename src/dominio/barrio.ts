import { z } from "zod";
import { type FechaIso, diaSemanaIso, sumarDias } from "./fechas";

/**
 * Planes del barrio (D-165): la agenda cultural abierta del Ayuntamiento de Madrid, filtrada al
 * distrito de San Blas-Canillejas (Las Rejas, Rosas, Arcos, Canillejas, El Salvador…): bibliotecas,
 * centros culturales, Quinta de los Molinos… Para enterarse de lo que hay cerca sin buscarlo. Puro.
 */

export const FUENTE_BARRIO =
  "https://datos.madrid.es/egob/catalogo/206974-0-agenda-eventos-culturales-100.json";
export const DISTRITO = "SanBlas-Canillejas";
/** Más días seguidos que esto es un curso o una tertulia semanal, no un plan: no se pone (salvo en la Quinta). */
const MAX_DIAS_SEGUIDOS = 20;
/** Los ciclos y talleres de la Quinta de los Molinos pueden durar meses (D-170): hasta este tope. */
const MAX_DIAS_CICLO = 250;

/** El Espacio Abierto y el parque de la Quinta de los Molinos: su programación es para ir en familia. */
export const esQuinta = (lugar: string): boolean => /quinta (de )?los molinos/i.test(lugar);

export interface PlanBarrio {
  /** Estable: sirve de clave en el calendario. */
  id: string;
  fecha: FechaIso;
  /** Último día, si dura varios (un festival, unos campamentos). */
  hasta: FechaIso | null;
  /** «18:00», o null si no se dice. */
  hora: string | null;
  titulo: string;
  lugar: string;
  /** «Rejas», «El Salvador»… */
  barrio: string;
  gratis: boolean;
  /** «3 euros», si se dice. */
  precio: string | null;
  /** Una búsqueda del plan: los enlaces de la propia agenda del Ayuntamiento no abren (D-169). */
  enlace: string | null;
  /** Para niños o para ir en familia: cuentacuentos, títeres, circo y magia, campamentos… */
  familiar: boolean;
  /** Ciclo o taller que dura meses (solo de la Quinta): no es un plan de un día, se enseña aparte. */
  serie: boolean;
  /** Para saber de un vistazo qué es: 🧸 cuentos, 🎬 cine, 💃 flamenco… */
  emoji: string;
}

const ref = z.object({ "@id": z.string().optional() }).partial().nullish();

const eventoSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  free: z.union([z.number(), z.string(), z.boolean()]).nullish(),
  price: z.string().nullish(),
  dtstart: z.string(),
  dtend: z.string().nullish(),
  time: z.string().nullish(),
  link: z.string().nullish(),
  /** La categoría de la agenda («…/actividades/CuentacuentosTiteresMarionetas»). */
  "@type": z.string().nullish(),
  "event-location": z.string().nullish(),
  address: z
    .object({ district: ref, area: z.object({ "@id": z.string().optional() }).partial().nullish() })
    .partial()
    .nullish(),
});

const respuestaSchema = z.object({ "@graph": z.array(z.unknown()).catch([]) });

/** «ElSalvador» → «El Salvador»; «Rejas» → «Rejas». */
const barrioLegible = (id: string) => id.replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, "$1 $2");

/** Categorías de la agenda que son para ir con niños. */
const CATEGORIAS_FAMILIARES =
  /(CuentacuentosTiteresMarionetas|CircoMagia|FiestasNavidadesReyes|ActividadesEscolares)$/;

const EMOJI_CATEGORIA: ReadonlyArray<[RegExp, string]> = [
  [/Cuentacuentos/, "🧸"],
  [/CircoMagia/, "🎪"],
  [/Cine/, "🎬"],
  [/Flamenco/, "💃"],
  [/Danza/, "💃"],
  [/Musica|Jazz/, "🎵"],
  [/Teatro|Comedia/, "🎭"],
  [/Exposiciones|Arte/, "🖼️"],
  [/Cursos|Capacitacion|Idiomas/, "🧑‍🏫"],
  [/Conferencias|Recitales|Literatura|ClubesLectura/, "📚"],
  [/Excursiones|Itinerarios|Historia/, "🚶"],
  [/Fiestas/, "🎉"],
  [/Deportivas/, "⚽"],
];

const FAMILIAR =
  /infantil|familia|niñ|peque|cuentacuentos|cuentos|títeres|titeres|magia|circo|juvenil|campamento|ludoteca|payas/i;

/** La agenda trae un `link` a madrid.es que responde «Contenido no disponible»: se busca el plan. */
const buscar = (titulo: string, lugar: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent(`${titulo} ${lugar.replace(/\s*\(.*$/, "")} Madrid`.replace(/\s+/g, " ").trim())}`;

const dia = (s: string): FechaIso | null => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1]! : null;
};
const dias = (a: FechaIso, b: FechaIso) =>
  (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5;

/** Los planes de San Blas-Canillejas de la agenda, de hoy en adelante, ordenados por fecha. */
export function planesDelBarrio(json: unknown, hoy: FechaIso): PlanBarrio[] {
  const r = respuestaSchema.safeParse(json);
  if (!r.success) return [];
  const out: PlanBarrio[] = [];
  for (const crudo of r.data["@graph"]) {
    const e = eventoSchema.safeParse(crudo);
    if (!e.success) continue;
    const v = e.data;
    const distrito = v.address?.district?.["@id"] ?? "";
    if (!distrito.endsWith(`/${DISTRITO}`)) continue;
    const inicio = dia(v.dtstart);
    if (!inicio) continue;
    const fin = (v.dtend && dia(v.dtend)) || inicio;
    const lugarCrudo = v["event-location"] ?? "";
    const duracion = dias(inicio, fin);
    const serie = duracion > MAX_DIAS_SEGUIDOS;
    if (fin < hoy || duracion > (esQuinta(lugarCrudo) ? MAX_DIAS_CICLO : MAX_DIAS_SEGUIDOS))
      continue;
    const hora = /^([01]\d|2[0-3]):[0-5]\d$/.test(v.time ?? "") ? v.time! : null;
    const gratis =
      v.free === 1 || v.free === "1" || v.free === true || /gratuit/i.test(v.price ?? "");
    const precio = (v.price ?? "").trim();
    const titulo = v.title.replace(/\s+/g, " ").trim().slice(0, 100);
    if (titulo === "") continue;
    out.push({
      id: v.id,
      fecha: inicio < hoy ? hoy : inicio,
      hasta: fin > (inicio < hoy ? hoy : inicio) ? fin : null,
      hora,
      titulo,
      lugar: (v["event-location"] ?? "").replace(/\s*\(San Blas ?- ?Canillejas\)\s*$/i, "").trim(),
      barrio: barrioLegible((v.address?.area?.["@id"] ?? "").split("/").pop() ?? ""),
      gratis,
      precio: !gratis && precio !== "" ? precio.slice(0, 40) : null,
      enlace: buscar(titulo, v["event-location"] ?? ""),
      familiar:
        CATEGORIAS_FAMILIARES.test(v["@type"] ?? "") ||
        FAMILIAR.test(titulo) ||
        esQuinta(lugarCrudo),
      serie,
      emoji: EMOJI_CATEGORIA.find(([r]) => r.test(v["@type"] ?? ""))?.[1] ?? "🎨",
    });
  }
  return out.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? ""),
  );
}

/** «sáb 21 · 18:00 · Cuentacuentos (Biblioteca Canillejas)»: una línea para el aviso. */
const NOMBRE_DIA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
export function lineaDelPlan(p: PlanBarrio): string {
  const d = `${NOMBRE_DIA[diaSemanaIso(p.fecha) - 1]} ${Number(p.fecha.slice(8))}`;
  return `${d}${p.hora ? ` ${p.hora}` : ""} ${p.titulo}${p.lugar ? ` (${p.lugar.replace(/^(Centro Cultural|Biblioteca Pública Municipal|Espacio Abierto) /, "")})` : ""}`;
}

/** Los planes para la familia del fin de semana que viene (sábado y domingo), para el aviso del viernes. */
export function planesDelFinde(planes: readonly PlanBarrio[], viernes: FechaIso): PlanBarrio[] {
  const sab = sumarDias(viernes, 1);
  const dom = sumarDias(viernes, 2);
  return planes.filter(
    (p) => p.familiar && !p.serie && p.fecha <= dom && (p.hasta ?? p.fecha) >= sab,
  );
}
