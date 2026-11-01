import type { Ingrediente } from "./tipos";

/**
 * «Regla de oro» de cada cena: una fuente de proteína, una de hidratos, verdura y/o fruta y una
 * grasa saludable. Fuentes: infografía «¿No sabes qué darle de cenar?» (Tripita en apuros), que
 * coincide con el recomendador del cole (ver docs/fuentes.md, D-055). Es divulgación, no una guía
 * oficial, y se usa como orientación para completar un plato, nunca para rechazarlo.
 */

export const COMPONENTES = ["proteina", "hidrato", "verdura", "grasa"] as const;
export type Componente = (typeof COMPONENTES)[number];

export const SUGERENCIA_COMPONENTE: Record<Componente, string> = {
  proteina: "una fuente de proteína (pescado, huevo, legumbres, carne, pollo o pavo)",
  hidrato: "un hidrato (patata, boniato, arroz, pasta, pan, maíz o quinoa)",
  verdura: "verdura o fruta (una ensalada, verduras al vapor o una pieza de fruta)",
  grasa: "una grasa saludable (aceite de oliva virgen extra, aguacate o frutos secos molidos)",
};

const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const HIDRATO =
  /patata|boniato|pasta|macarron|arroz|cuscus|quinoa|maiz|\bpan\b|tortillas|piadina|hojaldre|harina/;
const PROTEINA = /lentej|garbanz|alubia|atun|tofu|gulas|huevo/;
const GRASA = /aguacate|aceite|nueces|almendra|frutos secos/;
const VERDURA_CONGELADA = /guisante|espinaca|judia|brocoli|coliflor/;

/** Qué componentes de la regla de oro aporta un plato, según sus ingredientes obligatorios. */
export function componentesDe(
  ingredientes: ReadonlyArray<Pick<Ingrediente, "nombre" | "seccion">>,
): Set<Componente> {
  const presentes = new Set<Componente>();
  for (const ing of ingredientes) {
    const n = normalizar(ing.nombre);
    if (GRASA.test(n)) presentes.add("grasa");
    if (HIDRATO.test(n)) presentes.add("hidrato");
    else if (ing.seccion === "fruta_verdura" || VERDURA_CONGELADA.test(n)) presentes.add("verdura");
    if (["carne", "pescado", "huevos"].includes(ing.seccion) || PROTEINA.test(n)) {
      presentes.add("proteina");
    }
  }
  return presentes;
}

/** Lo que le falta a un plato para ser una cena completa, en el orden de la regla de oro. */
export function faltanComponentes(
  ingredientes: ReadonlyArray<Pick<Ingrediente, "nombre" | "seccion">>,
): Componente[] {
  const hay = componentesDe(ingredientes);
  return COMPONENTES.filter((c) => !hay.has(c));
}
