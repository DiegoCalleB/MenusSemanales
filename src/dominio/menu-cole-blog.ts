import { z } from "zod";
import { type FechaIso, diaSemanaIso, sumarDias } from "./fechas";
import type { MenuColeLeido } from "./menu-cole";

/**
 * El menú del cole leído solo desde el blog del colegio (D-173). El colegio publica cada mes una
 * entrada (etiqueta COMEDOR) con un enlace a su nube (educaMadrid) donde está el PDF del menú. Aquí:
 * leer la lista de entradas, quedarse con las que son un menú y comprobar que lo leído por la IA
 * tiene sentido antes de cargarlo. Puro.
 */

export const HOST_NUBE = "cloud.educa.madrid.org";
/** El menú «normal» del mes; las demás hojas de la carpeta son dietas especiales. */
export const NOMBRE_MENU_BASAL = "Menu_Basal.pdf";

export interface EntradaBlog {
  /** Estable: la dirección de la entrada. */
  enlace: string;
  titulo: string;
  publicada: FechaIso;
  /** El código de la carpeta compartida (`/s/<código>`) de la nube. */
  carpeta: string | null;
}

const feedSchema = z.object({
  feed: z.object({
    entry: z
      .array(
        z.object({
          title: z.object({ $t: z.string() }),
          published: z.object({ $t: z.string() }),
          link: z.array(z.object({ rel: z.string(), href: z.string() })),
          content: z.object({ $t: z.string() }).optional(),
        }),
      )
      .catch([]),
  }),
});

const CARPETA = /https:\/\/cloud\.educa\.madrid\.org\/s\/([A-Za-z0-9]{8,40})/;

/** Las entradas del feed JSON de Blogger (`/feeds/posts/default/-/ETIQUETA?alt=json`). */
export function entradasDelBlog(json: unknown): EntradaBlog[] {
  const f = feedSchema.safeParse(json);
  if (!f.success) return [];
  const out: EntradaBlog[] = [];
  for (const e of f.data.feed.entry) {
    const enlace = e.link.find((l) => l.rel === "alternate")?.href;
    const publicada = e.published.$t.slice(0, 10);
    if (!enlace || !/^https:\/\/[a-z0-9.-]+\.blogspot\.com\//.test(enlace)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publicada)) continue;
    out.push({
      enlace,
      titulo: e.title.$t.replace(/\s+/g, " ").trim().slice(0, 120),
      publicada,
      carpeta: CARPETA.exec(e.content?.$t ?? "")?.[1] ?? null,
    });
  }
  return out.sort((a, b) => b.publicada.localeCompare(a.publicada));
}

/** Las entradas que parecen un menú, con su carpeta, de las últimas semanas. Las más nuevas, primero. */
export function entradasDeMenu(entradas: readonly EntradaBlog[], hoy: FechaIso): EntradaBlog[] {
  return entradas.filter(
    (e) =>
      e.carpeta !== null &&
      /men[uú]/i.test(e.titulo) &&
      !/precio/i.test(e.titulo) &&
      e.publicada >= sumarDias(hoy, -100),
  );
}

export interface Comprobacion {
  ok: boolean;
  motivo: string;
}

/**
 * ¿Tiene sentido lo que ha leído la IA? Mes cercano a hoy, días de entre semana del propio mes, una
 * cantidad normal de días, casi todos con primero y segundo plato. Si no, no se carga nada.
 */
export function comprobarMenuLeido(m: MenuColeLeido, hoy: FechaIso): Comprobacion {
  const mal = (motivo: string): Comprobacion => ({ ok: false, motivo });
  if (m.anio < 2020 || m.mes < 1 || m.mes > 12) return mal("sin-mes");
  const inicio = `${m.anio}-${String(m.mes).padStart(2, "0")}-01`;
  if (inicio < sumarDias(hoy, -62) || inicio > sumarDias(hoy, 100)) return mal("mes-lejano");
  if (m.dias.length < 10 || m.dias.length > 23) return mal(`dias-${m.dias.length}`);
  const vistos = new Set<string>();
  let completos = 0;
  for (const d of m.dias) {
    if (!d.fecha.startsWith(inicio.slice(0, 7))) return mal("dia-de-otro-mes");
    if (diaSemanaIso(d.fecha) > 5) return mal("fin-de-semana");
    if (vistos.has(d.fecha)) return mal("dia-repetido");
    vistos.add(d.fecha);
    if (d.primero && d.segundo) completos += 1;
  }
  if (completos / m.dias.length < 0.9) return mal("platos-incompletos");
  return { ok: true, motivo: "ok" };
}

/** Los días como los espera la base de datos (`registrar_menu_cole_automatico`). */
export function diasParaGuardar(m: MenuColeLeido) {
  return m.dias.map((d) => ({
    fecha: d.fecha,
    primero: d.primero,
    segundo: d.segundo,
    postre: d.postre,
    guarnicion: d.guarnicion,
    kcal: d.kcal ?? null,
    grupoPrimero: d.grupoPrimero,
    grupoSegundo: d.grupoSegundo,
  }));
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
export const nombreDelMes = (mes: number): string => MESES[mes - 1] ?? "";

/**
 * Saca un archivo de un ZIP en memoria (lo justo para la carpeta de la nube si no se puede bajar el
 * PDF suelto): lee el directorio central y descomprime con `inflateRaw`. `null` si no está o no se
 * entiende. Solo métodos «sin comprimir» (0) y «deflate» (8), con un tope de tamaño.
 */
export function extraerDeZip(
  zip: Buffer,
  esElQueBusco: (nombre: string) => boolean,
  descomprimir: (datos: Buffer) => Buffer,
  maxBytes = 10 * 1024 * 1024,
): Buffer | null {
  // Fin del directorio central (EOCD): firma 0x06054b50, en los últimos 64 KB.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const total = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let n = 0; n < total && p + 46 <= zip.length; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) return null;
    const metodo = zip.readUInt16LE(p + 10);
    const tamComprimido = zip.readUInt32LE(p + 20);
    const tamReal = zip.readUInt32LE(p + 24);
    const largoNombre = zip.readUInt16LE(p + 28);
    const largoExtra = zip.readUInt16LE(p + 30);
    const largoComentario = zip.readUInt16LE(p + 32);
    const posLocal = zip.readUInt32LE(p + 42);
    const nombre = zip.subarray(p + 46, p + 46 + largoNombre).toString("utf8");
    p += 46 + largoNombre + largoExtra + largoComentario;
    if (!esElQueBusco(nombre)) continue;
    if (tamReal > maxBytes || tamComprimido > maxBytes) return null;
    if (zip.readUInt32LE(posLocal) !== 0x04034b50) return null;
    const inicio =
      posLocal + 30 + zip.readUInt16LE(posLocal + 26) + zip.readUInt16LE(posLocal + 28);
    const datos = zip.subarray(inicio, inicio + tamComprimido);
    if (metodo === 0) return Buffer.from(datos);
    if (metodo === 8) {
      const r = descomprimir(Buffer.from(datos));
      return r.length <= maxBytes ? r : null;
    }
    return null;
  }
  return null;
}
