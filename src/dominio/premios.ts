import { uuidV5 } from "./identificadores";
import type { Tarea } from "./tareas";

/**
 * Estrellas y premios del zafarrancho (D-117). Cada tarea hecha en un día vale una estrella para
 * quien la hace; la familia fija premios con un coste en estrellas y cada persona canjea los suyos.
 * Las estrellas ganadas NO se guardan: se cuentan a partir de las tareas hechas, de modo que
 * desmarcar una tarea quita su estrella sin más. Solo se guardan los premios y los canjes.
 */

export interface Premio {
  id: string;
  nombre: string;
  coste: number;
  emoji: string;
}

/** Un canje recuerda el nombre y el coste de entonces: cambiar el premio no reescribe el pasado. */
export interface Canje {
  id: string;
  premioId: string | null;
  nombre: string;
  coste: number;
  personaId: string;
  fecha: string;
}

export const MAX_LARGO_PREMIO = 40;
export const COSTE_MINIMO = 1;
export const COSTE_MAXIMO = 99;
export const MAX_PREMIOS = 30;

export const limpiarNombrePremio = (n: string): string =>
  n.replace(/\s+/g, " ").trim().slice(0, MAX_LARGO_PREMIO);

export const clavePremio = (n: string): string =>
  limpiarNombrePremio(n).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const costeValido = (c: number): boolean =>
  Number.isInteger(c) && c >= COSTE_MINIMO && c <= COSTE_MAXIMO;

const ESPACIO_PREMIO = "3c8e2f71-6a5d-4b19-9d0e-7f4a1c2b5e68";
/** El mismo nombre da siempre el mismo id: poner los premios de ejemplo dos veces no los duplica. */
export const idDePremioDeEjemplo = (nombre: string): string =>
  uuidV5(clavePremio(nombre), ESPACIO_PREMIO);

/** Para empezar; la familia los cambia, quita o añade los suyos. */
export const PREMIOS_DE_EJEMPLO: ReadonlyArray<Omit<Premio, "id">> = [
  { nombre: "Elegir la peli de la noche", coste: 5, emoji: "🎬" },
  { nombre: "Elegir la cena", coste: 6, emoji: "🍕" },
  { nombre: "Postre especial", coste: 8, emoji: "🍨" },
  { nombre: "30 minutos de pantalla", coste: 10, emoji: "🎮" },
  { nombre: "Plan especial del finde", coste: 25, emoji: "🎡" },
];

export const premiosDeEjemplo = (): Premio[] =>
  PREMIOS_DE_EJEMPLO.map((p) => ({ ...p, id: idDePremioDeEjemplo(p.nombre) }));

/** Una estrella por cada día en que se marcó cada tarea de esa persona. */
export const estrellasGanadas = (tareas: readonly Tarea[], personaId: string): number =>
  tareas.filter((t) => t.personaId === personaId).reduce((suma, t) => suma + t.hechas.length, 0);

export const estrellasGastadas = (canjes: readonly Canje[], personaId: string): number =>
  canjes.filter((c) => c.personaId === personaId).reduce((suma, c) => suma + c.coste, 0);

/** Lo que puede gastar ahora. Nunca baja de cero (por ejemplo si se borra una tarea ya canjeada). */
export const saldoDeEstrellas = (
  tareas: readonly Tarea[],
  canjes: readonly Canje[],
  personaId: string,
): number =>
  Math.max(0, estrellasGanadas(tareas, personaId) - estrellasGastadas(canjes, personaId));
