/**
 * El momento del día (D-197): «Hoy» enseña primero lo que toca ahora. Mañana: cole, tiempo, Mi día;
 * tarde: citas, pendientes, casa, compra; noche: lo de mañana. Puro.
 */

export type Momento = "manana" | "tarde" | "noche";

export const NOMBRE_MOMENTO: Record<Momento, string> = {
  manana: "la mañana",
  tarde: "la tarde",
  noche: "la noche",
};

export function momentoDeHora(hora: number): Momento {
  if (hora >= 5 && hora < 13) return "manana";
  if (hora >= 13 && hora < 20) return "tarde";
  return "noche";
}

/** Qué tarjetas suben en cada momento, por orden. La cena de hoy siempre va primera. */
export const SUBEN: Record<Momento, readonly string[]> = {
  manana: ["mi-dia", "cole", "tiempo", "medicacion", "mochila", "cuidarse"],
  tarde: ["citas", "pendientes", "casa", "compra", "papeles"],
  noche: ["manana", "mochila", "mi-dia", "objetivos", "notas", "medicacion"],
};

export const esMomento = (x: string | null | undefined): x is Momento =>
  x === "manana" || x === "tarde" || x === "noche";
