import { type Regalo, regaloSchema } from "@/aplicacion/regalo";

const CLAVE = "menus-semanales:regalo-recibido";

/** Guarda en este móvil el regalo que se acaba de abrir (el mensaje no pasa por ningún servidor). */
export function guardarRegaloRecibido(regalo: Regalo): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(regalo));
  } catch {
    // sin almacenamiento: la bienvenida usará el texto de siempre
  }
}

/** El regalo guardado en este móvil, o null si no hay o no es válido. */
export function leerRegaloRecibido(): Regalo | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const r = regaloSchema.safeParse(JSON.parse(crudo));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
