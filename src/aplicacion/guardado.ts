import type { EstadoSync } from "./sincronizacion";

/**
 * ¿Lo que se cambia se está guardando de verdad en la nube? (D-102). Si la nube está configurada y
 * algo impide guardar, la app lo dice SIEMPRE: en una franja permanente y en cada cambio. Nunca
 * guarda a escondidas solo en el móvil.
 */

export type RiesgoDeGuardado = "sin-sesion" | "sin-hogar" | "sin-conexion" | "error";

export interface SituacionDeGuardado {
  /** ¿Esta instalación tiene la nube bien configurada? Si no, es un uso local a propósito. */
  nubeConfigurada: boolean;
  /** Fase de la cuenta: «conectado» es la única en la que se guarda. */
  fase: string;
  sync: EstadoSync;
  /** ¿Tiene internet el móvil ahora mismo? (por defecto, sí) */
  enLinea?: boolean;
}

/** Por qué NO se está guardando (o null si todo va bien o la nube no se usa en esta instalación). */
export function riesgoDeGuardado(s: SituacionDeGuardado): RiesgoDeGuardado | null {
  if (!s.nubeConfigurada) return null;
  if (s.fase === "cargando") return null; // aún arrancando: no es un fallo
  if (s.fase === "sin-sesion") return "sin-sesion";
  if (s.fase === "sin-hogar") return "sin-hogar";
  if (s.fase !== "conectado") return "sin-sesion";
  if (s.enLinea === false) return "sin-conexion";
  if (s.sync === "error") return "error";
  if (s.sync === "sin-conexion") return "sin-conexion";
  return null;
}

export const TEXTO_RIESGO: Record<RiesgoDeGuardado, string> = {
  "sin-sesion":
    "No has entrado: lo que cambies se queda SOLO en este móvil y no está en la nube. Entra en Cuenta.",
  "sin-hogar":
    "Falta crear o unirse a un hogar: lo que cambies se queda SOLO en este móvil. Ve a Cuenta.",
  "sin-conexion": "Sin conexión: los cambios aún NO están en la nube. Se guardarán al volver.",
  error: "Error: los últimos cambios NO se han guardado en la nube. Revisa Cuenta.",
};

/** El aviso que sale con cada cambio mientras no se esté guardando. */
export const AVISO_CAMBIO: Record<RiesgoDeGuardado, string> = {
  "sin-sesion": "⚠️ Cambio NO guardado en la nube: no has entrado.",
  "sin-hogar": "⚠️ Cambio NO guardado en la nube: falta el hogar.",
  "sin-conexion": "⚠️ Sin conexión: este cambio se guardará al volver.",
  error: "⚠️ Error: este cambio NO se ha guardado en la nube.",
};

const GRAVEDAD: Record<EstadoSync, number> = {
  error: 4,
  "sin-conexion": 3,
  guardando: 2,
  "al-dia": 1,
  inactivo: 0,
};

/** El peor de varios estados de guardado (documento, hogar en tablas, menú en tablas). */
export function peorEstado(...estados: EstadoSync[]): EstadoSync {
  return estados.reduce((a, b) => (GRAVEDAD[b] > GRAVEDAD[a] ? b : a), "inactivo" as EstadoSync);
}
