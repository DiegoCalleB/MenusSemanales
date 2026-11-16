import type { PlanBarrio } from "./barrio";

/**
 * Gustos de la familia para los planes del barrio (D-171). Sin magia: la familia dice «nos gusta» o
 * «no es para nosotros» (o apunta un plan, que cuenta como un «nos gusta») y la app se fija en los
 * rasgos de ese plan (el sitio, el tipo, si es de familia, gratis, el momento del día y algunas
 * palabras del título). Los rasgos que más se repiten en lo que gusta suben puntos a los planes
 * parecidos; los de lo que no gusta, los bajan. Todo se puede explicar («por la Quinta de los
 * Molinos»). Puro.
 */

export interface VotoBarrio {
  /** El plan votado (su id en la agenda). */
  id: string;
  /** Sus rasgos en ese momento (el plan puede desaparecer de la agenda; el gusto se queda). */
  rasgos: string[];
  /** 1 = nos gusta, -1 = no es para nosotros. */
  voto: 1 | -1;
}

export const MAX_VOTOS = 150;
const MAX_RASGOS = 30;
const MAX_LARGO_RASGO = 60;

/** Palabras que no dicen nada del plan. */
const VACIAS = new Set([
  "sesión",
  "sesion",
  "familiar",
  "familia",
  "taller",
  "para",
  "como",
  "entre",
  "desde",
  "hasta",
  "sobre",
  "otros",
  "otras",
  "madrid",
  "centro",
  "cultural",
]);

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lo que define un plan para saber si «se parece» a otro. */
export function rasgosDelPlan(p: PlanBarrio): string[] {
  const r = new Set<string>();
  r.add(`tipo:${p.emoji}`);
  if (p.lugar) r.add(`lugar:${sinTildes(p.lugar).replace(/\s+/g, " ").slice(0, 40)}`);
  if (p.familiar) r.add("familia");
  if (p.gratis) r.add("gratis");
  if (p.hora) r.add(`momento:${Number(p.hora.slice(0, 2)) < 14 ? "mañana" : "tarde"}`);
  const dia = new Date(`${p.fecha}T12:00:00Z`).getUTCDay();
  r.add(`cuando:${dia === 0 || dia === 6 ? "finde" : "semana"}`);
  for (const w of sinTildes(p.titulo).split(/[^a-zñ]+/)) {
    if (w.length >= 5 && !VACIAS.has(w)) r.add(`palabra:${w}`);
  }
  return [...r].slice(0, MAX_RASGOS);
}

/** Entre -1 y 1: cuánto se inclina la familia por ese rasgo (con pocos votos, poco fiable → se encoge). */
export function pesosDeGusto(votos: readonly VotoBarrio[]): Map<string, number> {
  const cuenta = new Map<string, { si: number; no: number }>();
  for (const v of votos) {
    for (const r of v.rasgos) {
      const c = cuenta.get(r) ?? { si: 0, no: 0 };
      if (v.voto > 0) c.si += 1;
      else c.no += 1;
      cuenta.set(r, c);
    }
  }
  const pesos = new Map<string, number>();
  for (const [r, { si, no }] of cuenta) pesos.set(r, (si - no) / (si + no + 1));
  return pesos;
}

/** Rasgos «de relleno»: se repiten en casi todo y no merece la pena presumir de ellos. */
const POCO_INFORMATIVOS = new Set([
  "cuando:finde",
  "cuando:semana",
  "momento:mañana",
  "momento:tarde",
]);

/** Un nombre legible de un rasgo, para decir «porque os gustó…». */
const legible = (r: string): string => {
  if (r === "familia") return "los planes de familia";
  if (r === "gratis") return "lo gratis";
  const [k, ...v] = r.split(":");
  const valor = v.join(":");
  if (k === "lugar") return valor.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  if (k === "palabra") return `«${valor}»`;
  if (k === "tipo") return `los planes tipo ${valor}`;
  return valor;
};

export interface Afinidad {
  /** Puntos: más es mejor; negativo, es de lo que no os gusta. 0 si aún no hay votos. */
  puntos: number;
  /** Por qué (el rasgo que más pesa a favor), o null. */
  motivo: string | null;
}

/** Cuánto os pega un plan según los votos hasta ahora. */
export function afinidad(rasgos: readonly string[], pesos: ReadonlyMap<string, number>): Afinidad {
  let puntos = 0;
  let mejor: { r: string; w: number; prio: number } | null = null;
  for (const r of rasgos) {
    const w = pesos.get(r) ?? 0;
    puntos += w;
    if (w <= 0 || POCO_INFORMATIVOS.has(r)) continue;
    // Para explicarlo, primero el sitio, luego una palabra, luego lo demás.
    const prio = r.startsWith("lugar:")
      ? 3
      : r.startsWith("palabra:")
        ? 2
        : r.startsWith("tipo:")
          ? 0
          : 1;
    if (!mejor || prio > mejor.prio || (prio === mejor.prio && w > mejor.w)) mejor = { r, w, prio };
  }
  return { puntos, motivo: puntos > 0 && mejor ? legible(mejor.r) : null };
}

/** A partir de qué puntos se destaca un plan como «os pega». */
export const UMBRAL_ME_PEGA = 0.6;

/** Con un voto nuevo (o sin él, con `voto` 0), la lista de votos, sin pasarse de tamaño. */
export function conVoto(
  votos: readonly VotoBarrio[],
  nuevo: { id: string; rasgos: readonly string[]; voto: 1 | -1 | 0 },
): VotoBarrio[] {
  const resto = votos.filter((v) => v.id !== nuevo.id);
  if (nuevo.voto === 0) return resto;
  const rasgos = nuevo.rasgos
    .filter((r) => typeof r === "string" && r !== "" && r.length <= MAX_LARGO_RASGO)
    .slice(0, MAX_RASGOS);
  return [...resto, { id: nuevo.id, rasgos, voto: nuevo.voto }].slice(-MAX_VOTOS);
}
