import { type Momento, SUBEN } from "./momento";

/**
 * Hoy a tu manera (D-196): cada persona elige qué tarjetas ve en «Hoy» y en qué orden. Lo que no se
 * toca queda como siempre; una tarjeta nueva aparece sola al final. La cena de hoy no se quita (es la
 * cabecera de la pantalla). Puro.
 */

export type ColumnaHoy = "izquierda" | "derecha";

export interface TarjetaHoy {
  id: string;
  nombre: string;
  emoji: string;
  /** En pantallas anchas, en qué columna va; en el móvil todas van una tras otra. */
  columna: ColumnaHoy;
  /** No se puede ocultar. */
  fija?: boolean;
}

/** El orden de siempre. */
export const TARJETAS: readonly TarjetaHoy[] = [
  { id: "cena", nombre: "La cena de hoy", emoji: "🍽️", columna: "izquierda", fija: true },
  { id: "mi-dia", nombre: "Mi día", emoji: "✅", columna: "izquierda" },
  { id: "cole", nombre: "Menú del cole", emoji: "🎒", columna: "izquierda" },
  { id: "medicacion", nombre: "Medicación", emoji: "💊", columna: "izquierda" },
  { id: "cuidarse", nombre: "Cuidarse", emoji: "💧", columna: "izquierda" },
  { id: "tiempo", nombre: "El tiempo", emoji: "🌤️", columna: "izquierda" },
  { id: "mochila", nombre: "Qué llevar", emoji: "🧳", columna: "izquierda" },
  { id: "manana", nombre: "Mañana", emoji: "🌙", columna: "izquierda" },
  { id: "citas", nombre: "Citas y eventos", emoji: "📅", columna: "derecha" },
  { id: "pendientes", nombre: "Pendientes", emoji: "📝", columna: "derecha" },
  { id: "objetivos", nombre: "Objetivos", emoji: "🎯", columna: "derecha" },
  { id: "casa", nombre: "Toca en casa", emoji: "🏠", columna: "derecha" },
  { id: "compra", nombre: "Falta por comprar", emoji: "🛒", columna: "derecha" },
  { id: "papeles", nombre: "Papeles", emoji: "📄", columna: "derecha" },
  { id: "cumples", nombre: "Próximos cumples", emoji: "🎁", columna: "derecha" },
  { id: "notas", nombre: "Notas e ideas", emoji: "💡", columna: "derecha" },
  { id: "lo-de-hoy", nombre: "Lo de hoy", emoji: "🙌", columna: "derecha" },
];

export interface AjusteHoy {
  personaId: string;
  /** Ids de tarjeta en el orden elegido. */
  orden: string[];
  /** Ids de las que no se quieren ver. */
  ocultas: string[];
}

const IDS = new Set(TARJETAS.map((t) => t.id));
const FIJAS = new Set(TARJETAS.filter((t) => t.fija).map((t) => t.id));

export const ajusteDe = (
  ajustes: readonly AjusteHoy[],
  personaId: string | null,
): AjusteHoy | null => ajustes.find((a) => a.personaId === personaId) ?? null;

/**
 * El orden completo. Con ajuste, lo elegido primero y, detrás, lo que falte en el orden de siempre.
 * Sin ajuste (nadie lo ha tocado), el de siempre, salvo que se sepa el momento del día (D-197): la
 * cena de hoy, luego lo que toca ahora y después lo demás.
 */
export function ordenDe(ajuste: AjusteHoy | null, momento: Momento | null = null): string[] {
  const deSiempre = TARJETAS.map((t) => t.id);
  if (!ajuste && momento) {
    const fijas = deSiempre.filter((id) => FIJAS.has(id));
    const suben = SUBEN[momento].filter((id) => IDS.has(id) && !FIJAS.has(id));
    return [...fijas, ...suben, ...deSiempre.filter((id) => !FIJAS.has(id) && !suben.includes(id))];
  }
  const elegidas = (ajuste?.orden ?? []).filter(
    (id, i, todas) => IDS.has(id) && todas.indexOf(id) === i,
  );
  return [...elegidas, ...deSiempre.filter((id) => !elegidas.includes(id))];
}

export const ocultasDe = (ajuste: AjusteHoy | null): Set<string> =>
  new Set((ajuste?.ocultas ?? []).filter((id) => IDS.has(id) && !FIJAS.has(id)));

/** Limpia lo que llega: solo tarjetas que existen, sin repetir, y la fija nunca oculta. */
export function limpiarAjuste(
  personaId: string,
  orden: readonly string[],
  ocultas: readonly string[],
): AjusteHoy {
  return {
    personaId,
    orden: ordenDe({ personaId, orden: [...orden], ocultas: [] }),
    ocultas: [...ocultasDe({ personaId, orden: [], ocultas: [...ocultas] })],
  };
}

/** Sube (-1) o baja (1) una tarjeta un puesto en el orden. */
export function mover(orden: readonly string[], id: string, sentido: -1 | 1): string[] {
  const i = orden.indexOf(id);
  const j = i + sentido;
  if (i < 0 || j < 0 || j >= orden.length) return [...orden];
  const nuevo = [...orden];
  [nuevo[i], nuevo[j]] = [nuevo[j] as string, nuevo[i] as string];
  return nuevo;
}

/** En el modo simple, cuántas tarjetas del momento se ven a la vista (además de la cena de hoy). */
export const TARJETAS_A_LA_VISTA = 4;

/**
 * El modo simple (D-200): mientras nadie haya personalizado su Hoy y se sepa la hora, solo se ven la
 * cena y las pocas tarjetas que tocan ahora; el resto está plegado en «Más cosas». Devuelve los ids
 * a la vista; null si no hay modo simple (se ve todo, como siempre).
 */
export function aLaVista(ajuste: AjusteHoy | null, momento: Momento | null): Set<string> | null {
  if (ajuste || !momento) return null;
  return new Set([
    ...TARJETAS.filter((t) => t.fija).map((t) => t.id),
    ...SUBEN[momento].slice(0, TARJETAS_A_LA_VISTA),
  ]);
}
