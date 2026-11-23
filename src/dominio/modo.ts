/**
 * Dos espacios en una app (D-206). **Familia**: lo compartido (qué se cena, cole y mochila, compra,
 * citas, la casa). **Yo**: lo personal (Mi día, cuidarse, objetivos, notas, avisos). Cada persona ve
 * la familia; el espacio personal, solo quien lo usa. Y un **laboratorio**: lo que casi no se usa
 * (barrio, premios, reparto, Metropolitano, regalo) se apaga para toda la casa, sin borrar nada. Puro.
 */

export type Modo = "familia" | "completo";

/** Tarjetas de Hoy que son del espacio personal: en modo familia no salen. */
export const TARJETAS_PERSONALES = ["mi-dia", "cuidarse", "objetivos", "notas"] as const;

/** Lo que ve en Hoy, a la vista, quien está en modo familia; lo demás de la familia, en «Más cosas». */
export const HOY_FAMILIA = ["cena", "cole", "mochila", "citas", "compra", "medicacion"] as const;

/**
 * El modo de una persona: el que eligió o, si nunca eligió, «completo» para el primer adulto de la
 * familia (quien la creó y la mantiene) y «familia» para los demás.
 */
export function modoDe(
  modos: Readonly<Record<string, Modo>> | undefined,
  personas: ReadonlyArray<{ id: string; tipo: string; activa: boolean }>,
  personaId: string | null,
): Modo {
  if (!personaId) return "familia";
  const elegido = modos?.[personaId];
  if (elegido === "familia" || elegido === "completo") return elegido;
  const primero = personas.find((p) => p.activa && p.tipo === "adulto");
  return primero?.id === personaId ? "completo" : "familia";
}

export const esModo = (x: unknown): x is Modo => x === "familia" || x === "completo";
