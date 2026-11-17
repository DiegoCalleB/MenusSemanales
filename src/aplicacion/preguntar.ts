import type { PlanBarrio } from "@/dominio/barrio";
import { proximaFecha } from "@/dominio/cumples";
import { diasParaCasa } from "@/dominio/casa";
import { type FechaIso, sumarDias } from "@/dominio/fechas";
import { MAX_CONTEXTO } from "@/dominio/ia-preguntar";
import { textoCuando, textoRepite } from "@/dominio/vencimientos";
import { textoEspera } from "@/dominio/pendientes";
import { fechaLegible } from "./buscar";
import { articulosPendientes, type EstadoHogar } from "./estado";

/**
 * El resumen que se manda a la IA para contestar una pregunta (D-179): lo justo de lo apuntado, en
 * texto corto. A propósito NO entra la medicación (es personal), ni los regalos y las ideas de los
 * cumpleaños (la sorpresa), ni las notas del menú, ni lo que se ha votado. Se corta a un tamaño
 * máximo, empezando por lo que más suele preguntarse.
 */
export function contextoParaPreguntar(e: EstadoHogar, barrio: readonly PlanBarrio[] = []): string {
  const hoy = e.hoy;
  const nombre = (id: string | null | undefined) =>
    (id && e.personas.find((p) => p.id === id)?.nombre) || "";
  const secciones: string[] = [];
  const seccion = (titulo: string, lineas: readonly string[]) => {
    if (lineas.length > 0) secciones.push(`## ${titulo}\n${lineas.join("\n")}`);
  };

  seccion(
    "Familia",
    e.personas
      .filter((p) => p.activa)
      .map((p) => `- ${p.nombre} (${p.tipo === "nino" ? "niño/a" : "adulto"})`),
  );

  // Cenas y comidas de los próximos días.
  const dias = Array.from({ length: 10 }, (_, i) => sumarDias(hoy, i));
  const menu: string[] = [];
  for (const d of dias) {
    const cenas = e.comidas.filter((c) => c.fecha === d).map((c) => c.plato.nombre);
    const almuerzos = e.almuerzos.filter((a) => a.fecha === d).map((a) => a.texto);
    const cole = e.colegio[d];
    const partes = [
      cenas.length > 0 ? `cena: ${cenas.join(" + ")}` : "",
      almuerzos.length > 0 ? `comida en casa: ${almuerzos.join(" + ")}` : "",
      cole && (cole.textoPrimero || cole.textoSegundo)
        ? `comedor del cole: ${[cole.textoPrimero, cole.textoSegundo, cole.postre].filter(Boolean).join(" / ")}`
        : "",
    ].filter(Boolean);
    if (partes.length > 0)
      menu.push(`- ${fechaLegible(d)}${d === hoy ? " (hoy)" : ""}: ${partes.join("; ")}`);
  }
  seccion("Cenas y comidas", menu);

  // Citas, fechas señaladas y cumpleaños de los próximos 90 días.
  const hasta = sumarDias(hoy, 90);
  const citas = e.agenda
    .filter((a) => (a.hasta ?? a.fecha) >= hoy && a.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? ""))
    .map(
      (a) =>
        `- ${fechaLegible(a.fecha)}${a.hasta ? ` al ${fechaLegible(a.hasta)}` : ""}${a.hora ? ` a las ${a.hora}` : ""}: ${a.titulo}`,
    );
  seccion("Citas", citas);
  seccion(
    "Fechas señaladas",
    Object.entries(e.eventos)
      .filter(([f]) => f >= hoy && f <= hasta)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([f, ev]) => `- ${fechaLegible(f)}: ${ev.titulo}`),
  );
  seccion(
    "Cumpleaños próximos",
    e.cumples
      .map((c) => ({ c, f: proximaFecha(c, hoy) }))
      .filter(({ f }) => f <= hasta)
      .sort((a, b) => a.f.localeCompare(b.f))
      .map(({ c, f }) => `- ${fechaLegible(f)}: ${c.nombre}`),
  );

  seccion(
    "Papeles y vencimientos",
    e.vencimientos
      .filter((v) => v.hechoEn === null)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((v) => {
        const de = nombre(v.personaId);
        const dias = Math.round(
          (Date.parse(`${v.fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 864e5,
        );
        return `- ${v.titulo}${de ? ` de ${de}` : ""}: vence el ${fechaLegible(v.fecha)} (${textoCuando(dias)}; ${textoRepite(v.repiteMeses)})${v.notas ? `. Notas: ${v.notas}` : ""}`;
      }),
  );
  seccion(
    "Pendientes sin fecha",
    e.pendientes
      .filter((p) => p.hechoEn === null)
      .map(
        (p) =>
          `- ${p.importante ? "(importante) " : ""}${p.texto}${p.personaId ? ` — ${nombre(p.personaId)}` : ""} (${textoEspera(p.creadoEn, hoy)})`,
      ),
  );

  seccion("Lista de la compra", [
    ...e.manuales
      .filter((m) => !m.comprado)
      .map((m) => `- ${m.nombre}${m.cantidad ? ` (${m.cantidad})` : ""}`),
    ...articulosPendientes(e).map((a) => `- ${a.nombre}`),
  ]);
  seccion(
    "Despensa",
    e.despensa
      .map((d) => {
        const i = e.ingredientes.find((x) => x.id === d.ingredienteId);
        return i
          ? `- ${i.nombre}: ${d.cantidad} ${i.unidad} (${d.ubicacion})${d.caducaEn ? `, caduca el ${fechaLegible(d.caducaEn)}` : ""}`
          : "";
      })
      .filter(Boolean),
  );
  seccion(
    "Tareas de la casa",
    e.casa.map((t) => {
      const d = diasParaCasa(t, hoy);
      return `- ${t.titulo}: cada ${t.cadaDias} días${d < 0 ? `, va atrasada ${-d} días` : d === 0 ? ", toca hoy" : `, toca en ${d} días`}`;
    }),
  );
  seccion(
    "Qué llevar al cole o a actividades",
    e.mochila.map(
      (m) =>
        `- ${m.texto} (${nombre(m.personaId)}): ${m.fecha ? `el ${fechaLegible(m.fecha)}` : `los ${m.dias.join(",")} de la semana (1=lunes)`}`,
    ),
  );
  seccion(
    "Planes del barrio próximos",
    barrio
      .filter((p) => !p.serie && p.fecha >= hoy && p.fecha <= sumarDias(hoy, 21))
      .slice(0, 15)
      .map(
        (p) => `- ${fechaLegible(p.fecha)}${p.hora ? ` ${p.hora}` : ""}: ${p.titulo} (${p.lugar})`,
      ),
  );

  // Se corta por secciones enteras, no por la mitad de una línea.
  let texto = "";
  for (const s of secciones) {
    if (texto.length + s.length + 2 > MAX_CONTEXTO) break;
    texto += (texto ? "\n\n" : "") + s;
  }
  return texto;
}

/** La fecha de hoy ya legible, para el mensaje. */
export const hoyLegible = (hoy: FechaIso): string => fechaLegible(hoy);
