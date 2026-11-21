/**
 * Cuándo cambia el día (D-201): a las 4:00, no a las 00:00. A las 00:30 todavía es «hoy» para quien
 * sigue despierto: la app habla de hoy, no de mañana. Puro (el reloj entra como parámetro).
 */

export const INICIO_DEL_DIA = 4;

/** La fecha de «hoy» (AAAA-MM-DD) en esa zona (o la del dispositivo), con el día empezando a las 4:00. */
export function hoyDeAhora(ahora: Date, zona?: string): string {
  const desplazada = new Date(ahora.getTime() - INICIO_DEL_DIA * 3_600_000);
  return new Intl.DateTimeFormat("sv-SE", zona ? { timeZone: zona } : undefined).format(desplazada);
}
