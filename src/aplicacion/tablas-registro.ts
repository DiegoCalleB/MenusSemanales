import { z } from "zod";
import type { FechaIso } from "@/dominio/fechas";
import { type EntradaRegistro, MAX_ENTRADAS_REGISTRO } from "@/dominio/registro";
import type { EstadoHogar } from "./estado";

/**
 * Puente entre «Lo de hoy» (`registro` del estado) y la tabla `registro_hogar` (D-108). Es PURO.
 * Mismo esquema que los otros agregados: leer, diferencias por id y mezcla de cambios. Las entradas
 * son un diario: se añaden y se quitan, nunca se editan (el id sale de fecha + cosa + persona).
 */

export interface CambiosRegistro {
  upsert?: EntradaRegistro[];
  borrar?: string[];
}

export const lecturaRegistroSchema = z.object({
  filas: z.array(
    z.object({
      id: z.string(),
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      que: z.string(),
      personaId: z.string(),
    }),
  ),
});
export type LecturaRegistro = z.infer<typeof lecturaRegistroSchema>;

export const leerRegistro = (json: unknown): LecturaRegistro => lecturaRegistroSchema.parse(json);

/** El registro nace en tablas: no hay nada que importar y siempre manda la tabla. */
export const hayRegistroEnTablas = (): boolean => true;

const aEntrada = (f: LecturaRegistro["filas"][number]): EntradaRegistro => ({
  id: f.id,
  fecha: f.fecha as FechaIso,
  que: f.que,
  personaId: f.personaId,
});

export function diferenciasRegistro(
  antes: EstadoHogar,
  despues: EstadoHogar,
): CambiosRegistro | null {
  const a = new Map(antes.registro.map((r) => [r.id, r]));
  const d = new Map(despues.registro.map((r) => [r.id, r]));
  const upsert = [...d.values()].filter((r) => !a.has(r.id));
  const borrar = [...a.keys()].filter((id) => !d.has(id));
  if (upsert.length === 0 && borrar.length === 0) return null;
  return { ...(upsert.length > 0 ? { upsert } : {}), ...(borrar.length > 0 ? { borrar } : {}) };
}

export const lecturaDeRegistro = (e: EstadoHogar): LecturaRegistro => ({
  filas: e.registro.map((r) => ({ id: r.id, fecha: r.fecha, que: r.que, personaId: r.personaId })),
});

export function aplicarCambiosALecturaRegistro(
  l: LecturaRegistro,
  c: CambiosRegistro,
): LecturaRegistro {
  const mapa = new Map(l.filas.map((f) => [f.id, f]));
  for (const r of c.upsert ?? []) mapa.set(r.id, r);
  for (const id of c.borrar ?? []) mapa.delete(id);
  return { filas: [...mapa.values()] };
}

/** Pone el registro de la tabla en el estado (más antiguo primero; los últimos días). */
export function aplicarLecturaDeRegistro(e: EstadoHogar, l: LecturaRegistro): EstadoHogar {
  const registro = l.filas
    .map(aEntrada)
    .sort((x, y) => x.fecha.localeCompare(y.fecha) || x.id.localeCompare(y.id))
    .slice(-MAX_ENTRADAS_REGISTRO);
  return { ...e, registro };
}

/** El registro del documento no pisa lo que viene de la tabla cuando manda este motor. */
export const conservarCamposDeRegistro = (
  nuevo: EstadoHogar,
  actual: EstadoHogar,
): EstadoHogar => ({
  ...nuevo,
  registro: actual.registro,
});
