/**
 * Buscador de todo el hogar (D-177): una caja que encuentra lo que se ha apuntado, esté donde esté
 * (citas, fechas, cumpleaños, papeles, pendientes, platos, la compra, la despensa, lo de la mochila…).
 * Sin tildes ni mayúsculas, con varias palabras (todas tienen que aparecer) y empezando por lo que
 * mejor coincide. Nunca busca en la medicación: es personal. Puro.
 */

export type TipoResultado =
  | "cita"
  | "fecha"
  | "cumple"
  | "barrio"
  | "papel"
  | "pendiente"
  | "casa"
  | "tarea"
  | "mochila"
  | "plato"
  | "compra"
  | "despensa";

/** Cómo se llama cada tipo en la lista de resultados, y en qué orden salen. */
export const TIPOS: ReadonlyArray<{ id: TipoResultado; texto: string; emoji: string }> = [
  { id: "cita", texto: "Citas", emoji: "📌" },
  { id: "fecha", texto: "Fechas señaladas", emoji: "🎉" },
  { id: "cumple", texto: "Cumpleaños", emoji: "🎂" },
  { id: "papel", texto: "Papeles y vencimientos", emoji: "📄" },
  { id: "pendiente", texto: "Pendientes", emoji: "📝" },
  { id: "barrio", texto: "Planes del barrio", emoji: "🏘️" },
  { id: "casa", texto: "Casa", emoji: "🏠" },
  { id: "tarea", texto: "Tareas por persona", emoji: "✅" },
  { id: "mochila", texto: "Qué llevar", emoji: "🎒" },
  { id: "plato", texto: "Platos", emoji: "🍽️" },
  { id: "compra", texto: "Compra", emoji: "🛒" },
  { id: "despensa", texto: "Despensa", emoji: "🥫" },
];

/** Lo que tiene que ver con fechas: lo que busca la caja de «Fechas». */
export const TIPOS_DE_FECHAS: readonly TipoResultado[] = [
  "cita",
  "fecha",
  "cumple",
  "papel",
  "pendiente",
  "barrio",
];

export interface Buscable {
  /** Estable: sirve de clave. */
  id: string;
  tipo: TipoResultado;
  emoji: string;
  titulo: string;
  /** «12 de noviembre · 18:00», «Alba», «vence en 3 días»… */
  detalle?: string;
  /** Adónde lleva al pulsarlo. */
  href: string;
  /** Más texto donde buscar, sin enseñarlo (el lugar, las notas, la persona…). */
  extra?: string;
  /** Para ordenar lo que empata: lo próximo, primero (AAAA-MM-DD). */
  fecha?: string;
}

export interface ResultadoBusqueda extends Buscable {
  puntos: number;
}

/** Minúsculas y sin tildes, con espacios simples. */
export const normalizar = (t: string): string =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const MIN_LETRAS = 2;
export const MAX_RESULTADOS = 60;

/** Las palabras de la consulta (las de una sola letra no cuentan: «a», «y»). */
export function palabrasDe(consulta: string): string[] {
  return normalizar(consulta)
    .split(" ")
    .filter((p) => p.length >= 1);
}

/**
 * Puntos de un texto para las palabras buscadas: 0 si falta alguna. Más si el título empieza por
 * ella, si es una palabra entera o si el título es exactamente lo buscado.
 */
export function puntuar(item: Buscable, palabras: readonly string[]): number {
  if (palabras.length === 0) return 0;
  const titulo = normalizar(item.titulo);
  const resto = normalizar(`${item.detalle ?? ""} ${item.extra ?? ""}`);
  const palabrasTitulo = titulo.split(" ");
  let puntos = 0;
  for (const p of palabras) {
    if (palabrasTitulo.includes(p)) puntos += 6;
    else if (palabrasTitulo.some((w) => w.startsWith(p))) puntos += 4;
    else if (titulo.includes(p)) puntos += 2;
    else if (resto.split(" ").some((w) => w.startsWith(p))) puntos += 1;
    else if (resto.includes(p) && p.length >= 3) puntos += 0.5;
    else return 0;
  }
  if (titulo === palabras.join(" ")) puntos += 10;
  else if (titulo.startsWith(palabras.join(" "))) puntos += 4;
  return puntos;
}

/** Busca entre los elementos: los que mejor coinciden primero y, si empatan, los más próximos. */
export function buscar(
  elementos: readonly Buscable[],
  consulta: string,
  opciones: { tipos?: readonly TipoResultado[]; hoy?: string } = {},
): ResultadoBusqueda[] {
  const palabras = palabrasDe(consulta);
  if (normalizar(consulta).length < MIN_LETRAS) return [];
  const tipos = opciones.tipos ? new Set(opciones.tipos) : null;
  const orden = new Map(TIPOS.map((t, i) => [t.id, i]));
  const hoy = opciones.hoy ?? "";
  const r: ResultadoBusqueda[] = [];
  for (const e of elementos) {
    if (tipos && !tipos.has(e.tipo)) continue;
    const puntos = puntuar(e, palabras);
    if (puntos > 0) r.push({ ...e, puntos });
  }
  return r
    .sort(
      (a, b) =>
        b.puntos - a.puntos ||
        // Lo que viene (o es de hoy) antes que lo ya pasado, y lo más cercano primero.
        Number((a.fecha ?? "9999") < hoy) - Number((b.fecha ?? "9999") < hoy) ||
        (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999") ||
        (orden.get(a.tipo) ?? 99) - (orden.get(b.tipo) ?? 99) ||
        a.titulo.localeCompare(b.titulo, "es"),
    )
    .slice(0, MAX_RESULTADOS);
}

/** Los resultados agrupados por tipo, en el orden de `TIPOS`. */
export function agruparPorTipo(
  resultados: readonly ResultadoBusqueda[],
): Array<{ tipo: (typeof TIPOS)[number]; resultados: ResultadoBusqueda[] }> {
  return TIPOS.map((tipo) => ({
    tipo,
    resultados: resultados.filter((r) => r.tipo === tipo.id),
  })).filter((g) => g.resultados.length > 0);
}
