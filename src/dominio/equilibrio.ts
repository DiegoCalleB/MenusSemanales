import { type FechaIso, semanaDe, sumarDias } from "./fechas";
import type { GrupoPlato, MenuCole } from "./menu";

/**
 * Equilibrio semanal entre el cole y la cena. La comida del cole y la cena de casa se cuentan
 * JUNTAS: si el cole ya ha puesto legumbres dos veces, la cena no hace falta que las repita; si no
 * ha puesto pescado, conviene cenarlo.
 *
 * Las frecuencias semanales (comida + cena) son ORIENTATIVAS: salen de la guía de comedores
 * escolares de la AESAN y de las tablas de frecuencias de la Asociación Española de Pediatría, que
 * no coinciden exactamente entre sí; usamos rangos prudentes que caben en las dos. No sustituyen el
 * consejo de un pediatra o nutricionista. Fuentes y límites en docs/fuentes.md (D-054).
 */

export interface ObjetivoSemanal {
  min: number;
  max: number;
  /** Cómo se llama el grupo en una frase («pescado», «legumbres»). */
  nombre: string;
}

export const OBJETIVOS_SEMANALES: Partial<Record<GrupoPlato, ObjetivoSemanal>> = {
  legumbre: { min: 2, max: 3, nombre: "legumbres" },
  pescado: { min: 2, max: 4, nombre: "pescado" },
  huevo: { min: 2, max: 4, nombre: "huevo" },
  carne: { min: 2, max: 4, nombre: "carne" },
};

export type EstadoEquilibrio = "falta" | "bien" | "completo";

export function estadoDelGrupo(
  grupo: GrupoPlato,
  conteo: Readonly<Partial<Record<GrupoPlato, number>>>,
): { estado: EstadoEquilibrio; n: number; objetivo: ObjetivoSemanal } | null {
  const objetivo = OBJETIVOS_SEMANALES[grupo];
  if (!objetivo) return null;
  const n = conteo[grupo] ?? 0;
  return {
    estado: n < objetivo.min ? "falta" : n >= objetivo.max ? "completo" : "bien",
    n,
    objetivo,
  };
}

/**
 * Cuántas veces ha aparecido cada grupo en la semana de `fecha` (de lunes a domingo): en el menú
 * del cole (primer y segundo plato) y en las cenas ya elegidas, sin contar la cena de `fecha`.
 */
export function contarSemana(
  fecha: FechaIso,
  colegio: Readonly<Record<FechaIso, MenuCole>>,
  cenas: Readonly<Record<FechaIso, GrupoPlato>>,
): Partial<Record<GrupoPlato, number>> {
  const { desde } = semanaDe(fecha);
  const conteo: Partial<Record<GrupoPlato, number>> = {};
  const sumar = (g: GrupoPlato | null | undefined) => {
    if (g) conteo[g] = (conteo[g] ?? 0) + 1;
  };
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(desde, i);
    const cole = colegio[f];
    if (cole) {
      sumar(cole.primero);
      sumar(cole.segundo);
    }
    if (f !== fecha) sumar(cenas[f]);
  }
  return conteo;
}
