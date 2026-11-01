/** «a», «a y b», «a, b y c»: lista de frases en español. */
export function formatearLista(elementos: readonly string[]): string {
  const unicos = [...new Set(elementos)];
  if (unicos.length <= 1) return unicos[0] ?? "";
  return `${unicos.slice(0, -1).join(", ")} y ${unicos[unicos.length - 1]}`;
}
