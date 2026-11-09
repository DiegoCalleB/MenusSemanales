/** «a», «a y b», «a, b y c»: lista de frases en español. */
export function formatearLista(elementos: readonly string[]): string {
  const unicos = [...new Set(elementos)];
  if (unicos.length <= 1) return unicos[0] ?? "";
  return `${unicos.slice(0, -1).join(", ")} y ${unicos[unicos.length - 1]}`;
}

const numero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

/** 1500 g → «1,5 kg»; 250 ml → «250 ml»; 3 ud → «3 ud». */
export function cantidadEnTexto(cantidad: number, unidad: "g" | "ml" | "ud"): string {
  if (unidad === "g" && cantidad >= 1000) return `${numero.format(cantidad / 1000)} kg`;
  if (unidad === "ml" && cantidad >= 1000) return `${numero.format(cantidad / 1000)} l`;
  return `${numero.format(cantidad)} ${unidad}`;
}

/** Un emoji por grupo de plato: se reconoce de un vistazo. */
export const EMOJI_GRUPO: Record<string, string> = {
  verdura: "🥦",
  legumbre: "🫘",
  pasta: "🍝",
  arroz: "🍚",
  pescado: "🐟",
  carne: "🍗",
  huevo: "🍳",
  lacteo: "🥛",
  otro: "🍽️",
};

/** Nombre de cada grupo de plato en una frase («legumbres», «pescado»). */
export const NOMBRE_GRUPO_ES: Record<string, string> = {
  verdura: "verdura",
  legumbre: "legumbres",
  pasta: "pasta",
  arroz: "arroz",
  pescado: "pescado",
  carne: "carne",
  huevo: "huevo",
  lacteo: "lácteos",
  otro: "otro tipo de plato",
};

const sinTildes = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * ¿Encaja un nombre con lo que se está escribiendo? Sin tildes ni mayúsculas, y vale cualquier
 * orden: cada palabra escrita tiene que estar en el nombre («milanesa pollo» encuentra «Milanesa
 * de pollo»; «curry arroz», «Arroz con pollo al curry»). Con la consulta vacía encaja todo.
 */
export function coincideConBusqueda(nombre: string, consulta: string): boolean {
  const palabras = sinTildes(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const n = sinTildes(nombre);
  return palabras.every((p) => n.includes(p));
}

/** Pone primero lo que EMPIEZA por lo escrito y, dentro de cada grupo, por orden alfabético. */
export function ordenarPorBusqueda<T>(
  lista: readonly T[],
  nombreDe: (x: T) => string,
  consulta: string,
): T[] {
  const q = sinTildes(consulta).trim();
  const rango = (x: T) => (q !== "" && sinTildes(nombreDe(x)).startsWith(q) ? 0 : 1);
  return [...lista].sort(
    (a, b) => rango(a) - rango(b) || nombreDe(a).localeCompare(nombreDe(b), "es"),
  );
}
