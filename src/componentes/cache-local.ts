/**
 * Lo último que contestó el servidor, guardado en el móvil (D-208): sin cobertura, el tiempo y los
 * eventos de Google siguen saliendo con lo último que se supo, en vez de desaparecer. Siempre con
 * fecha y con un máximo de edad; cualquier fallo de almacenamiento se ignora.
 */

interface Guardado<T> {
  en: number;
  valor: T;
}

const PREFIJO = "menus-semanales:cache:";

export function guardarCache<T>(clave: string, valor: T, ahora: number = Date.now()): void {
  try {
    const g: Guardado<T> = { en: ahora, valor };
    window.localStorage.setItem(PREFIJO + clave, JSON.stringify(g));
  } catch {
    // sin almacenamiento: no se recuerda
  }
}

/** Lo guardado, si no tiene más de `maxMs` de edad (si no, null). */
export function leerCache<T>(clave: string, maxMs: number, ahora: number = Date.now()): T | null {
  try {
    const crudo = window.localStorage.getItem(PREFIJO + clave);
    if (!crudo) return null;
    const g = JSON.parse(crudo) as Partial<Guardado<T>>;
    if (typeof g.en !== "number" || g.valor === undefined) return null;
    if (ahora - g.en > maxMs || g.en > ahora + 60_000) return null;
    return g.valor;
  } catch {
    return null;
  }
}

export const UN_DIA_MS = 24 * 60 * 60 * 1000;
