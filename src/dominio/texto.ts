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
