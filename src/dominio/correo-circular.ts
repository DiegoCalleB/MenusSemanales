import { MAX_BYTES_CIRCULAR, MAX_TEXTO_CIRCULAR } from "./ia-circular";
import { type TipoArchivoCole, esTipoValido } from "./ia-cole";

/**
 * Circulares del cole reenviadas por correo (D-147). Cada hogar tiene su dirección
 * («hecho-<código>@<dominio de recepción>»): de ahí se saca a qué hogar va, qué se lee (el adjunto
 * o, si no hay, el texto) y nada más. Puro.
 */

export const PREFIJO_DIRECCION = "hecho-";
const DIRECCION = /(?:^|[<\s,;"])hecho-([a-z0-9]{16})@[a-z0-9.-]+/i;

/** El código del hogar en alguna de las direcciones de destino, o null si no va a ninguno. */
export function codigoDeDireccion(destinos: readonly string[]): string | null {
  for (const d of destinos) {
    const m = DIRECCION.exec(` ${d}`);
    if (m?.[1]) return m[1].toLowerCase();
  }
  return null;
}

export const direccionDeCirculares = (codigo: string, dominio: string) =>
  `${PREFIJO_DIRECCION}${codigo}@${dominio}`;

/** El texto del correo, sin HTML, recortado para la IA. Vacío si no hay nada útil. */
export function textoDelCorreo(c: { text?: string | null; html?: string | null }): string {
  const plano =
    c.text && c.text.trim() !== ""
      ? c.text
      : (c.html ?? "")
          .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
          .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
  return plano
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join("\n")
    .slice(0, MAX_TEXTO_CIRCULAR);
}

export interface AdjuntoRecibido {
  filename?: string | null;
  content_type?: string | null;
  size?: number | null;
  download_url?: string | null;
}

/** El primer adjunto que se puede leer (PDF o foto, de un tamaño razonable), o null. */
export function adjuntoParaLeer(
  lista: readonly AdjuntoRecibido[],
): { url: string; mime: TipoArchivoCole } | null {
  for (const a of lista) {
    const mime = (a.content_type ?? "").split(";")[0]!.trim().toLowerCase();
    if (!esTipoValido(mime)) continue;
    if (typeof a.size === "number" && (a.size <= 0 || a.size > MAX_BYTES_CIRCULAR)) continue;
    if (!a.download_url || !a.download_url.startsWith("https://")) continue;
    return { url: a.download_url, mime };
  }
  return null;
}
