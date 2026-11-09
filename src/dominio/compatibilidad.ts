import { estadoDelGrupo } from "./equilibrio";
import { type GrupoPlato, type MenuCole, recomendacionesPorPlato } from "./menu";

/**
 * Puntuación de compatibilidad de 1 a 5 entre una cena y lo que las niñas comieron en el cole
 * (D-125). Es determinista y explicable: sale de las mismas reglas que ya usa el recomendador (el
 * documento «Recomendador de cenas», el equilibrio semanal y las kcal del menú del cole), y cada
 * punto que suma o resta lleva su razón en palabras. No es un criterio médico: es una guía.
 *
 *   Parte de 3 y:
 *   +2 si el recomendador del cole aconseja ese grupo tras el primero Y tras el segundo; +1 si lo
 *      aconseja tras uno de los dos (si solo se conoce un plato, basta con que lo aconseje).
 *   −1 por cada plato del cole del que la cena repite el grupo (verdura tras verdura, carne tras carne).
 *   +1 si equilibra las kcal (cole contundente y cena ligera, o cole ligero y cena más completa);
 *   −1 si las empeora (cole contundente y cena que no es ligera).
 *   +1 si en la semana falta ese grupo; −1 si ya está completo.
 */

/** Grupos que se consideran cena ligera. */
export const LIGEROS: readonly GrupoPlato[] = ["verdura", "pescado", "huevo"];
export const KCAL_CONTUNDENTE = 700;
export const KCAL_LIGERO = 540;

const GRUPO: Record<GrupoPlato, string> = {
  verdura: "verdura",
  legumbre: "legumbres",
  pasta: "pasta",
  arroz: "arroz",
  pescado: "pescado",
  carne: "carne",
  huevo: "huevo",
  otro: "otro tipo de plato",
};

export type Puntos = 1 | 2 | 3 | 4 | 5;

export interface Compatibilidad {
  puntos: Puntos;
  /** Con qué se compara: el menú del cole o una comida de casa apuntada (fines de semana, fiestas). */
  origen: "cole" | "casa";
  /** Una palabra o dos para decirlo («Muy buena»). */
  etiqueta: string;
  /** Lo que suma y lo que resta, en frases cortas, de lo más importante a lo menos. */
  razones: string[];
}

export const ETIQUETA_PUNTOS: Record<Puntos, string> = {
  5: "Perfecta",
  4: "Muy buena",
  3: "Aceptable",
  2: "Poco compatible",
  1: "Repite lo del cole",
};

/**
 * Compatibilidad de una cena (por su grupo) con el menú del cole de ese día, o `null` si no se sabe
 * qué comieron (fin de semana, sin menú, o el cole no tiene primero ni segundo reconocidos).
 * `semana` es el conteo de grupos de esa semana (cole + cenas) SIN esta cena; es opcional.
 */
export function compatibilidadConCole(args: {
  grupo: GrupoPlato;
  cole: MenuCole | null;
  semana?: Readonly<Partial<Record<GrupoPlato, number>>>;
}): Compatibilidad | null {
  const { grupo, cole, semana } = args;
  if (!cole || (!cole.primero && !cole.segundo)) return null;

  let puntos = 3;
  const razones: string[] = [];
  const g = GRUPO[grupo];

  // 1. ¿Lo recomienda el cole para cenar?
  const r = recomendacionesPorPlato(cole);
  const reglas: Array<{ aplica: boolean; recomienda: boolean }> = [
    { aplica: r.trasPrimero.length > 0, recomienda: r.trasPrimero.includes(grupo) },
    { aplica: r.trasSegundo.length > 0, recomienda: r.trasSegundo.includes(grupo) },
  ].filter((x) => x.aplica);
  const aciertos = reglas.filter((x) => x.recomienda).length;
  if (reglas.length > 0 && aciertos === reglas.length) {
    puntos += reglas.length === 2 ? 2 : 1;
    razones.push(`El recomendador del cole aconseja ${g} para cenar tras lo que comieron.`);
  } else if (aciertos > 0) {
    puntos += 1;
    razones.push(`El recomendador del cole aconseja ${g} tras uno de sus platos.`);
  } else if (reglas.length > 0) {
    razones.push(`El recomendador del cole no aconseja ${g} para cenar tras ese menú.`);
  }

  // 2. ¿Repite lo que ya comieron al mediodía?
  if (grupo !== "otro") {
    const repetidos = [cole.primero, cole.segundo].filter((x) => x === grupo).length;
    if (repetidos > 0) {
      puntos -= repetidos;
      razones.push(`Repite ${g}, que ya comieron al mediodía.`);
    }
  }

  // 3. Calorías: que la cena compense el menú del cole.
  const ligera = LIGEROS.includes(grupo);
  if (cole.kcal != null && cole.kcal >= KCAL_CONTUNDENTE) {
    if (ligera) {
      puntos += 1;
      razones.push(`El cole fue contundente (${cole.kcal} kcal) y esta cena es ligera.`);
    } else {
      puntos -= 1;
      razones.push(`El cole fue contundente (${cole.kcal} kcal) y esta cena no es ligera.`);
    }
  } else if (cole.kcal != null && cole.kcal <= KCAL_LIGERO && !ligera) {
    puntos += 1;
    razones.push(`El cole fue ligero (${cole.kcal} kcal) y esta cena es más completa.`);
  }

  // 4. Equilibrio de la semana.
  const eq = semana ? estadoDelGrupo(grupo, semana) : null;
  if (eq?.estado === "falta") {
    puntos += 1;
    razones.push(
      `Esta semana falta ${eq.objetivo.nombre} (${eq.n} de ${eq.objetivo.min}–${eq.objetivo.max}).`,
    );
  } else if (eq?.estado === "completo") {
    puntos -= 1;
    razones.push(
      `Esta semana ya llevan ${eq.n} de ${eq.objetivo.nombre} (máximo orientativo ${eq.objetivo.max}).`,
    );
  }

  const final = Math.min(5, Math.max(1, puntos)) as Puntos;
  return {
    puntos: final,
    origen: cole.origen ?? "cole",
    etiqueta: ETIQUETA_PUNTOS[final],
    razones,
  };
}

/** Texto corto para lectores de pantalla y para copiar («Compatibilidad con el cole: 4 de 5, muy buena»). */
export const textoCompatibilidad = (c: Compatibilidad): string =>
  `Compatibilidad con ${c.origen === "casa" ? "la comida" : "el cole"}: ${c.puntos} de 5, ${c.etiqueta.toLowerCase()}`;
