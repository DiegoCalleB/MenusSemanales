import { proximaVez } from "@/dominio/casa";
import { proximaFecha } from "@/dominio/cumples";
import { type FechaIso, diaSemanaIso, sumarDias } from "@/dominio/fechas";
import { paraLlevar, paraPreparar } from "@/dominio/mochila";
import { hayColeDe, sinColeEntreSemana } from "./cole";
import { type EstadoHogar, articulosPendientes, nombreDia } from "./estado";

/**
 * Plan de la semana (D-137): todo lo de los próximos días en una sola pantalla para mirarlo una
 * vez (el domingo) y olvidarse: cenas (y las que faltan), comidas, citas, qué llevar, cumpleaños,
 * lo de la casa y cuánto hay en la lista de la compra.
 */

export interface DiaDelPlan {
  fecha: FechaIso;
  /** «lunes 16». */
  nombre: string;
  cena: string[];
  /** No se cena en casa ese día (saltado) o hay una fecha señalada que lo ocupa. */
  sinCena: boolean;
  evento: { titulo: string; emoji: string } | null;
  /** Por qué no hay cole ese día entre semana (D-144), o `null`. */
  sinCole: string | null;
  comida: string[];
  /** Las comidas apuntadas con su id, para editarlas desde el plan (D-153). */
  comidas: Array<{ id: string; texto: string }>;
  citas: Array<{ id: string; titulo: string; hora: string | null }>;
  /** `id` y `para`: para marcarlo como preparado desde el plan. */
  preparar: Array<{ id: string; para: FechaIso; texto: string; persona: string; hecho: boolean }>;
  llevar: Array<{ texto: string; persona: string }>;
  cumples: string[];
  /** Los cumpleaños con su id (el nombre está también en `cumples`). */
  cumpleanos: Array<{ id: string; nombre: string }>;
  casa: Array<{ id: string; emoji: string; titulo: string }>;
}

export interface PlanDeLaSemana {
  desde: FechaIso;
  hasta: FechaIso;
  dias: DiaDelPlan[];
  /** Días sin cena elegida (sin contar los que no se cena en casa). */
  faltanCenas: number;
  /** Lo mismo, solo de lunes a viernes (lo que sabe rellenar «Proponer cenas»). */
  faltanCenasLaborables: number;
  porComprar: number;
}

/** El sábado y el domingo se planea la semana siguiente; el resto de días, lo que queda de esta. */
export function rangoDeLaSemana(hoy: FechaIso): { desde: FechaIso; hasta: FechaIso } {
  const iso = diaSemanaIso(hoy);
  const desde = iso >= 6 ? sumarDias(hoy, 8 - iso) : hoy;
  return { desde, hasta: sumarDias(desde, 7 - diaSemanaIso(desde)) };
}

export function planDeLaSemana(e: EstadoHogar): PlanDeLaSemana {
  const { desde, hasta } = rangoDeLaSemana(e.hoy);
  const nombre = (id: string) => e.personas.find((p) => p.id === id)?.nombre ?? "";
  const dias: DiaDelPlan[] = [];
  const hayCole = hayColeDe(e);
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const evento = e.eventos[f] ?? null;
    dias.push({
      fecha: f,
      nombre: `${nombreDia(f)} ${Number(f.slice(8, 10))}`,
      cena: e.comidas.filter((c) => c.fecha === f).map((c) => c.plato.nombre),
      sinCena: e.saltados.includes(f) || evento !== null,
      evento,
      sinCole: sinColeEntreSemana(e, f),
      comida: e.almuerzos.filter((a) => a.fecha === f).map((a) => a.texto),
      comidas: e.almuerzos.filter((a) => a.fecha === f).map((a) => ({ id: a.id, texto: a.texto })),
      citas: e.agenda
        .filter((a) => a.fecha === f || (a.hasta !== null && a.fecha <= f && f <= a.hasta))
        .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""))
        .map((a) => ({ id: a.id, titulo: a.titulo, hora: a.hora })),
      preparar: paraPreparar(e.mochila, f, hayCole).map((p) => ({
        id: p.cosa.id,
        para: p.para,
        texto: p.cosa.texto,
        persona: nombre(p.cosa.personaId),
        hecho: p.hecho,
      })),
      llevar: paraLlevar(e.mochila, f, hayCole).map((c) => ({
        texto: c.texto,
        persona: nombre(c.personaId),
      })),
      cumples: e.cumples.filter((c) => proximaFecha(c, e.hoy) === f).map((c) => c.nombre),
      cumpleanos: e.cumples
        .filter((c) => proximaFecha(c, e.hoy) === f)
        .map((c) => ({ id: c.id, nombre: c.nombre })),
      // Lo atrasado de la casa sale el primer día.
      casa: e.casa
        .filter((t) => {
          const toca = proximaVez(t);
          return toca === f || (f === desde && toca < desde);
        })
        .map((t) => ({ id: t.id, emoji: t.emoji, titulo: t.titulo })),
    });
  }
  const sinElegir = dias.filter((d) => d.cena.length === 0 && !d.sinCena);
  return {
    desde,
    hasta,
    dias,
    faltanCenas: sinElegir.length,
    faltanCenasLaborables: sinElegir.filter((d) => diaSemanaIso(d.fecha) <= 5).length,
    porComprar: articulosPendientes(e).length + e.manuales.filter((m) => !m.comprado).length,
  };
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** El plan en texto, para mandarlo por WhatsApp. */
export function textoDelPlan(plan: PlanDeLaSemana): string {
  const lineas: string[] = ["🗓️ *Plan de la semana*"];
  for (const d of plan.dias) {
    lineas.push("", `*${mayuscula(d.nombre)}*`);
    if (d.evento) lineas.push(`${d.evento.emoji} ${d.evento.titulo}`);
    if (d.sinCole) lineas.push(`🏫 Sin cole: ${d.sinCole}`);
    for (const c of d.cumples) lineas.push(`🎂 Cumple de ${c}`);
    for (const c of d.citas) lineas.push(`📌 ${c.hora ? `${c.hora} ` : ""}${c.titulo}`);
    if (d.comida.length > 0) lineas.push(`☀️ Comida: ${d.comida.join(" + ")}`);
    if (d.cena.length > 0) lineas.push(`🍽️ Cena: ${d.cena.join(" + ")}`);
    else if (!d.sinCena) lineas.push("🍽️ Cena: por decidir");
    for (const p of d.preparar)
      lineas.push(`🎒 Preparar: ${p.texto}${p.persona ? ` (${p.persona})` : ""}`);
    for (const c of d.casa) lineas.push(`${c.emoji} ${c.titulo}`);
  }
  if (plan.porComprar > 0) {
    lineas.push(
      "",
      `🛒 ${plan.porComprar} ${plan.porComprar === 1 ? "cosa" : "cosas"} en la lista de la compra`,
    );
  }
  return lineas.join("\n");
}
