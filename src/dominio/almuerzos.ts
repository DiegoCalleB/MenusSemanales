import type { FechaIso } from "./fechas";

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
