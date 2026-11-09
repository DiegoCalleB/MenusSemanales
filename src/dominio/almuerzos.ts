import type { FechaIso } from "./fechas";
import type { GrupoPlato, MenuCole } from "./menu";

/**
 * La comida del mediodía (D-079). Entre semana la familia no la planifica (las niñas comen en el
 * cole), pero hay días —fines de semana, fiestas, vacaciones— en que también hay que pensar qué se
 * come. Cada apunte es un plato del catálogo (y entonces cuenta para la lista de la compra) o un
 * texto libre («Comemos en casa de los abuelos», «Por decidir»).
 */
export interface Almuerzo {
  id: string;
  fecha: FechaIso;
  texto: string;
  /** Plato del catálogo, si se eligió uno. */
  platoId: string | null;
}

export const MAX_LARGO_ALMUERZO = 80;
export const POR_DECIDIR = "Por decidir";

/** Los apuntes de un día, en orden estable. */
export const almuerzosDe = (lista: readonly Almuerzo[], fecha: FechaIso): Almuerzo[] =>
  lista.filter((a) => a.fecha === fecha);

/** Grupos que, comidos al mediodía, hacen de «primer plato» o de «segundo» para recomendar la cena. */
const COMO_PRIMERO: readonly GrupoPlato[] = ["pasta", "arroz", "verdura", "legumbre"];
const COMO_SEGUNDO: readonly GrupoPlato[] = ["carne", "pescado", "huevo"];

/** Cuántos días hacia atrás se puede apuntar lo que se comió (el fin de semana que acaba de pasar). */
export const DIAS_ATRAS_COMIDA = 14;

/**
 * Lo que se comió en casa al mediodía, visto como un «menú del cole»: así el recomendador de cenas,
 * el equilibrio de la semana y la nota de compatibilidad lo tienen en cuenta igual que a las niñas
 * en el cole (D-128). Una milanesa de pollo (carne) hace de segundo plato y pide cenar huevo o
 * pescado. `null` si no hay ningún plato con un grupo que cuente (texto libre, «otro»).
 */
export function menuDeComidaEnCasa(
  platos: ReadonlyArray<{ grupo: GrupoPlato; nombre: string }>,
): MenuCole | null {
  const primero = platos.find((p) => COMO_PRIMERO.includes(p.grupo));
  const segundo = platos.find((p) => COMO_SEGUNDO.includes(p.grupo));
  if (!primero && !segundo) return null;
  return {
    primero: primero?.grupo ?? null,
    segundo: segundo?.grupo ?? null,
    textoPrimero: primero?.nombre ?? null,
    textoSegundo: segundo?.nombre ?? null,
    origen: "casa",
  };
}
