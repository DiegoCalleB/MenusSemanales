/**
 * Listas de Google Keep (D-210). Keep no tiene API para cuentas personales, pero una nota se puede
 * copiar o compartir como texto: una línea por elemento, con casilla («☐ leche», «☑ pan», «[ ] huevos»,
 * «[x] sal») o sin ella. Aquí se entiende ese texto y se separa lo que **falta por hacer** (casilla sin
 * marcar o sin casilla) de lo ya marcado, que se ignora. Puro.
 */

const PENDIENTE = /^(?:[-*•·]\s*)?(?:☐|□|◻|⬜|○|\[\s?\]|\(\s?\))\s*/u;
const MARCADA = /^(?:[-*•·]\s*)?(?:☑|☒|✅|✔️?|✓|■|◼|\[[xX✓✔]\]|\([xX]\))\s*/u;

export type MarcaDeLinea = "pendiente" | "marcada" | "ninguna";

/** La casilla con la que empieza una línea y el texto que queda sin ella. */
export function sinCasilla(linea: string): { marca: MarcaDeLinea; texto: string } {
  const t = linea.replace(/^\s+/, "");
  const m = MARCADA.exec(t);
  if (m) return { marca: "marcada", texto: t.slice(m[0].length).trim() };
  const p = PENDIENTE.exec(t);
  if (p) return { marca: "pendiente", texto: t.slice(p[0].length).trim() };
  return { marca: "ninguna", texto: t.trim() };
}

export interface ListaDeKeep {
  /** Lo que falta (sin casilla marcada), en el orden de la nota. */
  pendientes: string[];
  /** Lo que ya estaba marcado: no se importa. */
  marcadas: string[];
  /** Encabezados que agrupan a otros («MERCADONA»): no son un artículo. */
  encabezados: string[];
}

const sangria = (l: string) => l.length - l.replace(/^[ \t]+/, "").length;

/** «MERCADONA», «FRUTERÍA»: un título en mayúsculas, sin números, no es algo que comprar. */
const pareceEncabezado = (t: string) =>
  /\p{L}{4,}/u.test(t) && t === t.toUpperCase() && !/\d/.test(t) && t.length <= 30;

export const MAX_ELEMENTOS_KEEP = 80;
export const MAX_LARGO_ELEMENTO_KEEP = 80;

/** Lee una lista de Keep pegada o compartida (ver arriba). */
export function leerListaDeKeep(texto: string): ListaDeKeep {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() !== "");
  const salida: ListaDeKeep = { pendientes: [], marcadas: [], encabezados: [] };
  lineas.forEach((l, i) => {
    const { marca, texto: t } = sinCasilla(l);
    if (t === "") return;
    // Un elemento con otros más hundidos debajo es un grupo («MERCADONA» y sus cosas): no se compra.
    const siguiente = lineas[i + 1];
    const esGrupo = siguiente !== undefined && sangria(siguiente) > sangria(l);
    if (marca === "marcada") {
      salida.marcadas.push(t);
    } else if (esGrupo || pareceEncabezado(t)) {
      salida.encabezados.push(t);
    } else if (t.length <= MAX_LARGO_ELEMENTO_KEEP) {
      salida.pendientes.push(t);
    }
  });
  salida.pendientes = [...new Set(salida.pendientes)].slice(0, MAX_ELEMENTOS_KEEP);
  return salida;
}

/**
 * ¿Parece una lista y no un mensaje? Con casillas (al menos dos) o con varias líneas cortas. Así lo
 * compartido desde Keep se trata como lista y lo de un grupo de padres, como circular.
 */
export function pareceListaDeKeep(texto: string): boolean {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length < 2) return false;
  const conCasilla = lineas.filter((l) => sinCasilla(l).marca !== "ninguna").length;
  if (conCasilla >= 2) return true;
  return lineas.length >= 4 && lineas.every((l) => l.length <= 70);
}
