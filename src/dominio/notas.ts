import { type FechaIso, diasEntre } from "./fechas";

/**
 * Notas e ideas, y recuerdos (D-199). Una **idea** es algo suelto que se apunta en un segundo y se
 * vacía en la revisión (pasa a pendiente, se archiva o se borra). Un **recuerdo** es una línea con
 * fecha, a veces sobre alguien (lo que dijo una hija, una primera vez), que «Un día como hoy» vuelve
 * a enseñar al cabo de 1, 3 y 6 meses y de cada año. Personales: no salen de la app. Puro.
 */

export type TipoNota = "idea" | "recuerdo";

export interface Nota {
  id: string;
  /** De quién es (solo lo ve esa persona). */
  personaId: string;
  tipo: TipoNota;
  texto: string;
  /** Sobre quién va (una hija, Ana…); null si sobre nadie en concreto. */
  sobre: string | null;
  creadoEn: FechaIso;
  /** Solo ideas: el día en que se resolvió (pendiente, archivada); null si sigue en la bandeja. */
  procesadaEn: FechaIso | null;
}

export const MAX_TEXTO_NOTA = 500;
export const MAX_NOTAS = 400;

export const limpiarNota = (t: string): string =>
  t
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export function validarNota(
  d: { personaId: string; tipo: TipoNota; texto: string; sobre: string | null },
  personasValidas: ReadonlySet<string>,
):
  | { ok: true; datos: { personaId: string; tipo: TipoNota; texto: string; sobre: string | null } }
  | { ok: false; motivo: string } {
  const t = limpiarNota(d.texto);
  if (t === "" || t.length > MAX_TEXTO_NOTA) {
    return { ok: false, motivo: `Escribe la nota (hasta ${MAX_TEXTO_NOTA} letras).` };
  }
  if (d.tipo !== "idea" && d.tipo !== "recuerdo") return { ok: false, motivo: "Elige qué es." };
  if (!personasValidas.has(d.personaId)) {
    return { ok: false, motivo: "Esa persona no está en la familia." };
  }
  if (d.sobre !== null && !personasValidas.has(d.sobre)) {
    return { ok: false, motivo: "Esa persona no está en la familia." };
  }
  return {
    ok: true,
    datos: { personaId: d.personaId, tipo: d.tipo, texto: t, sobre: d.sobre },
  };
}

/** Las ideas de una persona que aún no se han resuelto, la más antigua primero. */
export const bandeja = (notas: readonly Nota[], personaId: string): Nota[] =>
  notas
    .filter((n) => n.personaId === personaId && n.tipo === "idea" && n.procesadaEn === null)
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id));

export const archivadas = (notas: readonly Nota[], personaId: string): Nota[] =>
  notas
    .filter((n) => n.personaId === personaId && n.tipo === "idea" && n.procesadaEn !== null)
    .sort((a, b) => (b.procesadaEn ?? "").localeCompare(a.procesadaEn ?? ""));

/** Los recuerdos de una persona (opcionalmente sobre alguien), el más reciente primero. */
export const recuerdos = (
  notas: readonly Nota[],
  personaId: string,
  sobre: string | null = null,
): Nota[] =>
  notas
    .filter(
      (n) =>
        n.personaId === personaId && n.tipo === "recuerdo" && (sobre === null || n.sobre === sobre),
    )
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn) || b.id.localeCompare(a.id));

/** Cuándo se vuelve a enseñar un recuerdo: a los 30, 91 y 182 días y cada año. */
const VENTANAS = [30, 91, 182] as const;

/** «hace 1 mes», «hace 3 meses», «hace 6 meses», «hace 1 año», «hace 2 años»; null si hoy no toca. */
export function hace(dias: number): string | null {
  const cerca = (objetivo: number) => Math.abs(dias - objetivo) <= 1;
  if (cerca(VENTANAS[0])) return "hace 1 mes";
  if (cerca(VENTANAS[1])) return "hace 3 meses";
  if (cerca(VENTANAS[2])) return "hace 6 meses";
  for (let a = 1; a <= 20; a++) {
    if (cerca(365 * a + Math.floor(a / 4))) return a === 1 ? "hace 1 año" : `hace ${a} años`;
  }
  return null;
}

/** Los recuerdos de una persona que hoy cumplen 1, 3 o 6 meses o un año (o más). */
export function unDiaComoHoy(
  notas: readonly Nota[],
  personaId: string,
  hoy: FechaIso,
): Array<{ nota: Nota; hace: string }> {
  const salida: Array<{ nota: Nota; hace: string }> = [];
  for (const n of recuerdos(notas, personaId)) {
    const h = hace(diasEntre(n.creadoEn, hoy));
    if (h) salida.push({ nota: n, hace: h });
  }
  return salida;
}
