import type { FechaIso } from "./fechas";
import { uuidV5 } from "./identificadores";
import type { Persona } from "./tipos";

/**
 * «Lo de hoy» (D-108): quién ha hecho qué cada día en casa. Una entrada es una cosa hecha por una
 * persona un día. Es un diario, no una planificación: el reparto planifica; esto apunta lo que se
 * hizo de verdad (la compra, la cena, los gatos, el lavavajillas…).
 */

export interface EntradaRegistro {
  id: string;
  fecha: FechaIso;
  /** Qué se hizo, tal como lo escribe la familia («Cena», «Gatos»). */
  que: string;
  personaId: string;
}

export const MAX_LARGO_QUE = 40;
/** Lo que se guarda en el estado (la base de datos lleva más; esto cubre los últimos días). */
export const MAX_ENTRADAS_REGISTRO = 2000;
/** Días hacia atrás que la app lee y enseña. */
export const DIAS_DE_REGISTRO = 60;

/** Lo que casi siempre se apunta; salen siempre en la tarjeta. */
export const TAREAS_BASICAS: ReadonlyArray<{ que: string; emoji: string }> = [
  { que: "Comida", emoji: "🍽️" },
  { que: "Cena", emoji: "🍝" },
  { que: "Compra", emoji: "🛒" },
];

export const limpiarQue = (que: string): string =>
  que.replace(/\s+/g, " ").trim().slice(0, MAX_LARGO_QUE);

/** «Cena», «cena » y «CENA» son lo mismo; las tildes tampoco cuentan. */
export const claveDeQue = (que: string): string =>
  limpiarQue(que).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ESPACIO_REGISTRO = "9b1f6a52-3c70-4d4e-8a0f-5d2e7c41b8a3";

/** El mismo día, la misma cosa y la misma persona dan siempre el mismo id: tocar dos veces no duplica. */
export const idDeEntrada = (fecha: FechaIso, que: string, personaId: string): string =>
  uuidV5(`${fecha}|${claveDeQue(que)}|${personaId}`, ESPACIO_REGISTRO);

export const entradasDelDia = (registro: readonly EntradaRegistro[], fecha: FechaIso) =>
  registro.filter((r) => r.fecha === fecha);

/**
 * Las cosas que se enseñan hoy: las básicas, las que ya se han apuntado hoy y, para añadir en un
 * toque, las que la familia apuntó otros días (las más frecuentes primero).
 */
export function cosasDeHoy(registro: readonly EntradaRegistro[], hoy: FechaIso) {
  const nombres = new Map<string, string>(); // clave → nombre a mostrar
  for (const b of TAREAS_BASICAS) nombres.set(claveDeQue(b.que), b.que);
  for (const r of entradasDelDia(registro, hoy)) {
    if (!nombres.has(claveDeQue(r.que))) nombres.set(claveDeQue(r.que), r.que);
  }
  const apuntadasHoy = [...nombres.keys()];

  const veces = new Map<string, { que: string; n: number }>();
  for (const r of registro) {
    const k = claveDeQue(r.que);
    if (nombres.has(k)) continue;
    const previa = veces.get(k);
    veces.set(k, { que: previa?.que ?? r.que, n: (previa?.n ?? 0) + 1 });
  }
  const frecuentes = [...veces.values()]
    .sort((a, b) => b.n - a.n || a.que.localeCompare(b.que, "es"))
    .map((v) => v.que);

  return {
    hoy: apuntadasHoy.map((k) => nombres.get(k) as string),
    sugerencias: frecuentes.slice(0, 8),
  };
}

/** Quién ha hecho cuántas cosas en un rango de fechas (ambas incluidas). */
export function resumenPorPersona(
  registro: readonly EntradaRegistro[],
  personas: readonly Persona[],
  desde: FechaIso,
  hasta: FechaIso,
) {
  return personas
    .filter((p) => p.activa)
    .map((p) => ({
      personaId: p.id,
      cosas: registro.filter((r) => r.personaId === p.id && r.fecha >= desde && r.fecha <= hasta)
        .length,
    }));
}
