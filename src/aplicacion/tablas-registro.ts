import { z } from "zod";
import type { FechaIso } from "@/dominio/fechas";
import type { Canje, Premio } from "@/dominio/premios";
import { type EntradaRegistro, MAX_ENTRADAS_REGISTRO } from "@/dominio/registro";
import type { EstadoHogar } from "./estado";

/**
 * Puente entre «Lo de hoy» (`registro` del estado) y la tabla `registro_hogar` (D-108). Es PURO.
 * Mismo esquema que los otros agregados: leer, diferencias por id y mezcla de cambios. Las entradas
 * son un diario: se añaden y se quitan, nunca se editan (el id sale de fecha + cosa + persona).
 */

interface CambiosDe<T> {
  upsert?: T[];
  borrar?: string[];
}

/** Lo de hoy en la raíz; los premios y los canjes del zafarrancho (D-117) en su propio apartado. */
export interface CambiosRegistro extends CambiosDe<EntradaRegistro> {
  premios?: CambiosDe<Premio>;
  canjes?: CambiosDe<Canje>;
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
  // Antes de la migración de premios estas dos no venían: se leen como vacías.
  premios: z
    .array(
      z.object({
        id: z.string(),
        nombre: z.string(),
        coste: z.number(),
        emoji: z.string(),
      }),
    )
    .default([]),
  canjes: z
    .array(
      z.object({
        id: z.string(),
        premioId: z.string().nullable(),
        nombre: z.string(),
        coste: z.number(),
        personaId: z.string(),
        fecha: z.string(),
      }),
    )
    .default([]),
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

function diferenciasPorId<T extends { id: string }>(antes: T[], despues: T[]): CambiosDe<T> | null {
  const a = new Map(antes.map((x) => [x.id, x]));
  const d = new Map(despues.map((x) => [x.id, x]));
  // Se sube lo nuevo y lo que ha cambiado (un premio se puede editar; una entrada del diario no).
  const upsert = [...d.values()].filter((x) => JSON.stringify(a.get(x.id)) !== JSON.stringify(x));
  const borrar = [...a.keys()].filter((id) => !d.has(id));
  if (upsert.length === 0 && borrar.length === 0) return null;
  return { ...(upsert.length > 0 ? { upsert } : {}), ...(borrar.length > 0 ? { borrar } : {}) };
}

export function diferenciasRegistro(
  antes: EstadoHogar,
  despues: EstadoHogar,
): CambiosRegistro | null {
  const hoy = diferenciasPorId(antes.registro, despues.registro);
  const premios = diferenciasPorId(antes.premios, despues.premios);
  const canjes = diferenciasPorId(antes.canjes, despues.canjes);
  if (!hoy && !premios && !canjes) return null;
  return {
    ...(hoy ?? {}),
    ...(premios ? { premios } : {}),
    ...(canjes ? { canjes } : {}),
  };
}

export const lecturaDeRegistro = (e: EstadoHogar): LecturaRegistro => ({
  filas: e.registro.map((r) => ({ id: r.id, fecha: r.fecha, que: r.que, personaId: r.personaId })),
  premios: e.premios,
  canjes: e.canjes,
});

function mezclar<T extends { id: string }>(actual: T[], c: CambiosDe<T> | undefined): T[] {
  const mapa = new Map(actual.map((x) => [x.id, x]));
  for (const x of c?.upsert ?? []) mapa.set(x.id, x);
  for (const id of c?.borrar ?? []) mapa.delete(id);
  return [...mapa.values()];
}

export function aplicarCambiosALecturaRegistro(
  l: LecturaRegistro,
  c: CambiosRegistro,
): LecturaRegistro {
  return {
    filas: mezclar(l.filas, c),
    premios: mezclar(l.premios, c.premios),
    canjes: mezclar(l.canjes, c.canjes),
  };
}

/** Pone el registro de la tabla en el estado (más antiguo primero; los últimos días). */
export function aplicarLecturaDeRegistro(e: EstadoHogar, l: LecturaRegistro): EstadoHogar {
  const registro = l.filas
    .map(aEntrada)
    .sort((x, y) => x.fecha.localeCompare(y.fecha) || x.id.localeCompare(y.id))
    .slice(-MAX_ENTRADAS_REGISTRO);
  const premios = [...l.premios].sort(
    (x, y) => x.coste - y.coste || x.nombre.localeCompare(y.nombre),
  );
  const canjes = [...l.canjes].sort(
    (x, y) => x.fecha.localeCompare(y.fecha) || x.id.localeCompare(y.id),
  );
  return { ...e, registro, premios, canjes };
}

/** El registro del documento no pisa lo que viene de la tabla cuando manda este motor. */
export const conservarCamposDeRegistro = (
  nuevo: EstadoHogar,
  actual: EstadoHogar,
): EstadoHogar => ({
  ...nuevo,
  registro: actual.registro,
  premios: actual.premios,
  canjes: actual.canjes,
});
