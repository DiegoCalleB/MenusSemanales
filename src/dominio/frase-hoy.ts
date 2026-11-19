import type { Aviso } from "./avisos";
import type { FechaIso } from "./fechas";
import { fechaLarga } from "./avisos";

/**
 * «Hoy en una frase» (D-190): lo más importante del día en una línea, para no tener que leer cinco
 * tarjetas. Se arma con plantillas a partir de lo que ya sabe la app (sin IA: al instante, sin
 * gastar y sin mandar nada fuera). Nunca lleva medicación, regalos ni lo personal de Cuidarse.
 */

export interface DatosDeLaFrase {
  hoy: FechaIso;
  cumples: readonly string[];
  citas: ReadonlyArray<{ titulo: string; hora: string | null }>;
  /** Lo que hay que dejar preparado (hoy o mañana), ya con el nombre de la persona. */
  dejarPreparado: readonly string[];
  /** Cuántas cosas de casa tocan ya. */
  casa: number;
  cena: readonly string[];
}

const MAX_PARTES = 4;

const unir = (partes: readonly string[]): string =>
  partes.length <= 1
    ? (partes[0] ?? "")
    : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;

export function fraseDeHoy(d: DatosDeLaFrase): string {
  const dia = fechaLarga(d.hoy).replace(/ de \S+$/, "");
  const partes: string[] = [];
  for (const c of d.cumples.slice(0, 2)) partes.push(`es el cumple de ${c}`);
  const citas = d.citas.slice(0, 2).map((c) => `${c.titulo}${c.hora ? ` a las ${c.hora}` : ""}`);
  if (citas.length > 0) partes.push(`tienes ${unir(citas)}`);
  if (d.dejarPreparado.length > 0) {
    partes.push(`hay que dejar preparado ${unir(d.dejarPreparado.slice(0, 2))}`);
  }
  if (d.casa > 0)
    partes.push(d.casa === 1 ? "en casa toca 1 cosa" : `en casa tocan ${d.casa} cosas`);
  partes.push(d.cena.length > 0 ? `cena de ${d.cena.join(" y ")}` : "aún falta elegir la cena");
  const dichas = partes.slice(0, MAX_PARTES);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}: ${unir(dichas)}.`;
}

/** De los avisos del día, qué hay que dejar preparado hoy o mañana: «Flauta de Emma». */
export function dejarPreparadoDe(avisos: readonly Aviso[]): string[] {
  return avisos.flatMap((a) => {
    const m = /^Deja preparado: (.+) \(para (?:hoy|mañana)\)$/.exec(a.titulo);
    return a.id.startsWith("mochila-") && m?.[1]
      ? [m[1].charAt(0).toLowerCase() + m[1].slice(1)]
      : [];
  });
}
