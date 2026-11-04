import { type EstadoHogar, normalizar } from "@/aplicacion/estado";
import { esEstadoValido } from "./almacen-local";

/**
 * Copias de seguridad del hogar (fase 0, D-086): un archivo que la persona descarga y guarda, y una
 * copia automática en el propio móvil antes de que la nube sustituya lo que hay. Todo es del
 * usuario y no sale del dispositivo salvo que él lo descargue.
 */

export const APP_RESPALDO = "menus-semanales";
export const VERSION_RESPALDO = 1;
const CLAVE_AUTOMATICAS = "menus-semanales:respaldos-previos";
const MAX_AUTOMATICAS = 3;

type Almacenamiento = Pick<Storage, "getItem" | "setItem">;

export interface Respaldo {
  app: typeof APP_RESPALDO;
  version: number;
  creado: string;
  /** Por qué se hizo: «manual» (descargada) o «antes-de-la-nube» (automática). */
  motivo: "manual" | "antes-de-la-nube" | "antes-de-importar";
  estado: EstadoHogar;
}

/** Lo que cambia en cada móvil sin que sea del hogar: no cuenta para saber si hay algo distinto. */
const huella = (e: EstadoHogar): string => JSON.stringify({ ...e, hoy: "", aviso: null });

export function crearRespaldo(
  estado: EstadoHogar,
  ahora: Date,
  motivo: Respaldo["motivo"] = "manual",
): Respaldo {
  return {
    app: APP_RESPALDO,
    version: VERSION_RESPALDO,
    creado: ahora.toISOString(),
    motivo,
    estado: { ...estado, aviso: null },
  };
}

export const textoDeRespaldo = (r: Respaldo): string => JSON.stringify(r, null, 2);

export const nombreDeArchivo = (r: Pick<Respaldo, "creado">): string =>
  `respaldo-menus-semanales-${r.creado.slice(0, 10)}.json`;

export type LecturaRespaldo = { ok: true; respaldo: Respaldo } | { ok: false; motivo: string };

/** Lee un archivo de copia de seguridad. Comprueba la forma antes de fiarse de nada. */
export function leerRespaldo(texto: string): LecturaRespaldo {
  if (texto.length > 6_000_000) return { ok: false, motivo: "El archivo es demasiado grande." };
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: "No es un archivo de copia de seguridad (no se puede leer)." };
  }
  if (typeof dato !== "object" || dato === null) {
    return { ok: false, motivo: "No es un archivo de copia de seguridad." };
  }
  const r = dato as Record<string, unknown>;
  if (r.app !== APP_RESPALDO)
    return { ok: false, motivo: "Este archivo no es una copia de ¡Hecho!" };
  if (typeof r.version !== "number" || r.version > VERSION_RESPALDO) {
    return { ok: false, motivo: "Es de una versión más nueva de la app: actualiza la página." };
  }
  if (!esEstadoValido(r.estado)) {
    return { ok: false, motivo: "El archivo está incompleto o dañado." };
  }
  return {
    ok: true,
    respaldo: {
      app: APP_RESPALDO,
      version: r.version,
      creado: typeof r.creado === "string" ? r.creado : "",
      motivo:
        r.motivo === "antes-de-la-nube" || r.motivo === "antes-de-importar" ? r.motivo : "manual",
      estado: normalizar({ ...r.estado, aviso: null }),
    },
  };
}

/** Copias automáticas guardadas en este móvil, de la más nueva a la más vieja. */
export function leerRespaldosAutomaticos(almacen: Almacenamiento | null): Respaldo[] {
  try {
    const lista: unknown = JSON.parse(almacen?.getItem(CLAVE_AUTOMATICAS) ?? "[]");
    if (!Array.isArray(lista)) return [];
    return lista.flatMap((t) => {
      const l = typeof t === "string" ? leerRespaldo(t) : null;
      return l?.ok ? [l.respaldo] : [];
    });
  } catch {
    return [];
  }
}

/**
 * Guarda una copia del estado de este móvil antes de que la nube lo sustituya, **solo si es distinto
 * del de la nube** (si no, no hay nada que perder) y distinto de la última copia. Conserva las 3
 * últimas. Nunca lanza: si no hay espacio, la app sigue (y lo dice el valor devuelto).
 */
export function guardarRespaldoAntesDeLaNube(
  almacen: Almacenamiento | null,
  local: EstadoHogar,
  nube: EstadoHogar,
  ahora: Date,
): "guardada" | "sin-cambios" | "no-se-pudo" {
  try {
    if (huella(local) === huella(nube)) return "sin-cambios";
    const previas = leerRespaldosAutomaticos(almacen);
    if (previas[0] && huella(previas[0].estado) === huella(local)) return "sin-cambios";
    const nuevas = [crearRespaldo(local, ahora, "antes-de-la-nube"), ...previas].slice(
      0,
      MAX_AUTOMATICAS,
    );
    almacen?.setItem(CLAVE_AUTOMATICAS, JSON.stringify(nuevas.map(textoDeRespaldo)));
    return "guardada";
  } catch {
    return "no-se-pudo";
  }
}

/**
 * Copia automática justo antes de llevar los datos a tablas (D-094). Siempre se guarda (salvo que
 * la última copia sea idéntica): es el seguro de una operación que no se puede hacer a ciegas.
 */
export function guardarRespaldoAntesDeImportar(
  almacen: Almacenamiento | null,
  estado: EstadoHogar,
  ahora: Date,
): "guardada" | "sin-cambios" | "no-se-pudo" {
  try {
    const previas = leerRespaldosAutomaticos(almacen);
    if (previas[0] && huella(previas[0].estado) === huella(estado)) return "sin-cambios";
    const nuevas = [crearRespaldo(estado, ahora, "antes-de-importar"), ...previas].slice(
      0,
      MAX_AUTOMATICAS,
    );
    almacen?.setItem(CLAVE_AUTOMATICAS, JSON.stringify(nuevas.map(textoDeRespaldo)));
    return "guardada";
  } catch {
    return "no-se-pudo";
  }
}
