import { MAX_TEXTO_PENDIENTE, type Pendiente } from "./pendientes";

/**
 * Sincronizar los pendientes con Todoist (D-205). Los pendientes de la app (sin fecha) y las tareas
 * de un proyecto de Todoist llamado «¡Hecho!» son la misma lista: lo que se apunta en un sitio sale en
 * el otro, y lo que se hace en uno se marca hecho en el otro. Solo texto y hecho/no hecho (ni fechas
 * ni prioridades ni etiquetas). Esto es la parte pura: qué mandar y cómo aplicar lo que vuelve.
 */

export const NOMBRE_PROYECTO = "¡Hecho!";
export const MAX_CREAR_POR_VEZ = 30;
export const MAX_CERRAR_POR_VEZ = 60;

export interface TareaDeTodoist {
  id: string;
  content: string;
}

/** Los ids de Todoist son cadenas cortas de letras, números, «_» y «-». */
export const esIdDeTodoist = (x: unknown): x is string =>
  typeof x === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(x);

const limpiar = (t: string) => t.replace(/\s+/g, " ").trim();

/** El texto de una tarea de Todoist como pendiente (cabe en 120 letras). */
export function textoDePendiente(content: string): string {
  const t = limpiar(content);
  return t.length > MAX_TEXTO_PENDIENTE ? `${t.slice(0, MAX_TEXTO_PENDIENTE - 1)}…` : t;
}

/**
 * Qué se manda a Todoist: crear lo abierto que aún no tiene tarea (de esa persona o de nadie) y
 * cerrar lo hecho aquí (con tarea) y lo que se quitó (`porCerrar`).
 */
export function planDeSincronizacion(
  pendientes: readonly Pendiente[],
  porCerrar: readonly string[],
  personaId: string,
): { crear: Array<{ ref: string; content: string }>; cerrar: string[] } {
  const mios = pendientes.filter((p) => p.personaId === null || p.personaId === personaId);
  const crear = mios
    .filter((p) => p.hechoEn === null && !p.todoistId)
    .slice(0, MAX_CREAR_POR_VEZ)
    .map((p) => ({ ref: p.id, content: p.texto }));
  const hechos = mios.filter((p) => p.hechoEn !== null && p.todoistId).map((p) => p.todoistId!);
  const cerrar = [...new Set([...porCerrar, ...hechos])].filter(esIdDeTodoist);
  return { crear, cerrar: cerrar.slice(0, MAX_CERRAR_POR_VEZ) };
}

export interface ResultadoDeSincronizacion {
  /** Qué pendiente (por su id) ha dado qué tarea nueva. */
  creadas: ReadonlyArray<{ ref: string; id: string }>;
  /** Las tareas que siguen abiertas en Todoist después de aplicar lo anterior. */
  activas: readonly TareaDeTodoist[];
  /** Las que se han cerrado ahora. */
  cerradas: readonly string[];
}
