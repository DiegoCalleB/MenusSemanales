import type { PlanBarrio } from "@/dominio/barrio";
import { type Buscable } from "@/dominio/busqueda";
import { proximaFecha } from "@/dominio/cumples";
import { diasHasta, textoCuando, textoRepite, CATEGORIAS } from "@/dominio/vencimientos";
import { textoEspera } from "@/dominio/pendientes";
import { articulosPendientes, type EstadoHogar } from "./estado";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** «jue 12 de noviembre». */
export function fechaLegible(f: string): string {
  const d = new Date(`${f}T12:00:00Z`);
  return `${DIAS_CORTOS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/**
 * Todo lo que se puede encontrar en el buscador (D-177), sacado del estado del hogar. A propósito
 * NO entra la medicación (es personal), ni lo que se regala (la sorpresa), ni las notas del menú.
 */
export function elementosBuscables(
  e: EstadoHogar,
  /** Los planes del barrio, si ya se han cargado (los pide la pantalla al servidor). */
  barrio: readonly PlanBarrio[] = [],
): Buscable[] {
  const nombre = (id: string | null | undefined) =>
    (id && e.personas.find((p) => p.id === id)?.nombre) || "";
  const ingrediente = (id: string) => e.ingredientes.find((i) => i.id === id);
  const out: Buscable[] = [];

  for (const a of e.agenda) {
    out.push({
      id: `cita-${a.id}`,
      tipo: "cita",
      emoji: "📌",
      titulo: a.titulo,
      detalle: `${fechaLegible(a.fecha)}${a.hasta ? ` – ${fechaLegible(a.hasta)}` : ""}${a.hora ? ` · ${a.hora}` : ""}`,
      href: `/calendario?dia=${a.fecha}`,
      fecha: a.hasta ?? a.fecha,
    });
  }
  for (const [fecha, ev] of Object.entries(e.eventos)) {
    out.push({
      id: `fecha-${fecha}`,
      tipo: "fecha",
      emoji: ev.emoji || "🎉",
      titulo: ev.titulo,
      detalle: fechaLegible(fecha),
      href: `/calendario?dia=${fecha}`,
      fecha,
    });
  }
  for (const c of e.cumples) {
    out.push({
      id: `cumple-${c.id}`,
      tipo: "cumple",
      emoji: "🎂",
      titulo: c.nombre,
      detalle: `${c.dia} de ${MESES[c.mes - 1] ?? ""}`,
      href: "/cumples",
      fecha: proximaFecha(c, e.hoy),
    });
  }
  for (const v of e.vencimientos.filter((x) => x.hechoEn === null)) {
    const de = nombre(v.personaId);
    out.push({
      id: `papel-${v.id}`,
      tipo: "papel",
      emoji: CATEGORIAS.find((c) => c.id === v.categoria)?.emoji ?? "📄",
      titulo: `${v.titulo}${de ? ` · ${de}` : ""}`,
      detalle: `${textoCuando(diasHasta(v, e.hoy))} · ${textoRepite(v.repiteMeses)}`,
      extra: `${v.notas} ${CATEGORIAS.find((c) => c.id === v.categoria)?.texto ?? ""}`,
      href: "/papeles",
      fecha: v.fecha,
    });
  }
  for (const p of e.pendientes.filter((x) => x.hechoEn === null)) {
    out.push({
      id: `pendiente-${p.id}`,
      tipo: "pendiente",
      emoji: p.importante ? "⭐" : "📝",
      titulo: p.texto,
      detalle: `${textoEspera(p.creadoEn, e.hoy)}${p.personaId ? ` · ${nombre(p.personaId)}` : ""}`,
      href: "/fechas#sin-fecha",
    });
  }
  for (const p of barrio) {
    out.push({
      id: `barrio-${p.id}-${p.fecha}`,
      tipo: "barrio",
      emoji: p.emoji,
      titulo: p.titulo,
      detalle: `${fechaLegible(p.fecha)}${p.hora ? ` · ${p.hora}` : ""} · ${p.lugar}`,
      extra: p.barrio,
      href: "/barrio",
      fecha: p.hasta ?? p.fecha,
    });
  }
  for (const t of e.casa) {
    out.push({
      id: `casa-${t.id}`,
      tipo: "casa",
      emoji: t.emoji || "🏠",
      titulo: t.titulo,
      detalle: `cada ${t.cadaDias} días${t.responsableId ? ` · ${nombre(t.responsableId)}` : ""}`,
      href: "/casa",
    });
  }
  for (const t of e.tareas) {
    out.push({
      id: `tarea-${t.id}`,
      tipo: "tarea",
      emoji: "✅",
      titulo: t.texto,
      detalle: `${nombre(t.personaId)} · ${t.frecuencia === "diaria" ? "cada día" : "puntual"}`,
      href: "/tareas",
    });
  }
  for (const m of e.mochila) {
    out.push({
      id: `mochila-${m.id}`,
      tipo: "mochila",
      emoji: "🎒",
      titulo: m.texto,
      detalle: nombre(m.personaId),
      href: "/mochila",
    });
  }
  for (const p of e.platos) {
    out.push({
      id: `plato-${p.id}`,
      tipo: "plato",
      emoji: "🍽️",
      titulo: p.nombre,
      detalle: p.grupo,
      extra: p.ingredientes.map((i) => ingrediente(i.ingredienteId)?.nombre ?? "").join(" "),
      href: "/menu/platos",
    });
  }
  const yaEnCompra = new Set<string>();
  for (const a of e.manuales.filter((x) => !x.comprado)) {
    yaEnCompra.add(a.nombre.toLowerCase());
    out.push({
      id: `compra-${a.id}`,
      tipo: "compra",
      emoji: "🛒",
      titulo: a.nombre,
      detalle: a.cantidad ?? "en la lista",
      href: "/compra",
    });
  }
  for (const a of articulosPendientes(e)) {
    if (yaEnCompra.has(a.nombre.toLowerCase())) continue;
    out.push({
      id: `compra-${a.ingredienteId}`,
      tipo: "compra",
      emoji: "🛒",
      titulo: a.nombre,
      detalle: "en la lista",
      href: "/compra",
    });
  }
  for (const d of e.despensa) {
    const i = ingrediente(d.ingredienteId);
    if (!i) continue;
    out.push({
      id: `despensa-${d.ingredienteId}-${d.ubicacion}`,
      tipo: "despensa",
      emoji: "🥫",
      titulo: i.nombre,
      detalle: `${d.cantidad} ${i.unidad} · ${d.ubicacion}`,
      href: "/despensa",
    });
  }
  return out;
}
