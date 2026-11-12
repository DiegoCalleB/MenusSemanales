import { z } from "zod";
import { proximaVez } from "./casa";
import type { EventoCalendario } from "./compartir";
import { proximaFecha } from "./cumples";
import { type FechaIso, sumarDias } from "./fechas";

/**
 * Avisos fuera de la app (D-083): el calendario del móvil se suscribe a un enlace y avisa solo.
 * Aquí se convierte el resumen que devuelve la base de datos en eventos con alarma. Sin red ni
 * base de datos: recibe el resumen y la fecha de hoy.
 */

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const texto = z.string().min(1).max(200);

/** Lo único que sale de la base de datos para el calendario: ni ideas de regalos, ni compra, ni despensa. */
export const proyeccionSchema = z.object({
  personas: z.array(
    z.object({
      id: z.string(),
      nombre: z.string(),
      tipo: z.enum(["adulto", "nino"]),
      activa: z.boolean(),
    }),
  ),
  cenas: z.array(z.object({ fecha, nombre: texto })),
  almuerzos: z.array(z.object({ fecha, texto })),
  eventos: z.record(fecha, z.object({ titulo: texto, emoji: z.string().max(16) })),
  agenda: z.array(
    z.object({
      fecha,
      hasta: fecha.nullable(),
      hora: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .nullable(),
      titulo: texto,
    }),
  ),
  casa: z.array(
    z.object({
      titulo: texto,
      emoji: z.string().max(16),
      cadaDias: z.number().int().min(1),
      responsableId: z.string().nullable(),
      ultimaVez: fecha.nullable(),
      desde: fecha,
      aplazadaHasta: fecha.nullish(),
    }),
  ),
  cumples: z.array(
    z.object({
      nombre: texto,
      dia: z.number().int().min(1).max(31),
      mes: z.number().int().min(1).max(12),
      anio: z.number().int().nullish(),
      personaId: z.string().nullish(),
    }),
  ),
});
export type ProyeccionCalendario = z.infer<typeof proyeccionSchema>;

/** A qué hora salen en el calendario las comidas y cenas (no llevan hora propia en la app). */
export const HORA_COMIDA = "14:00";
export const HORA_CENA = "21:00";

const limpio = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/**
 * Eventos del calendario suscrito de una persona (`para`). Lleva sus tareas de casa y las de «los
 * dos», las cenas y comidas, las fechas y los cumpleaños, con alarma a las 9:00 (o una hora antes
 * si el evento tiene hora). **Los avisos de regalo** («pensar» a 30 días, «comprar» a 14) solo van
 * a quien no cumple: a Ana no le llegan los de su regalo, y sin saber quién pide, no se incluyen.
 */
export function eventosSuscritos(
  p: ProyeccionCalendario,
  { hoy, para }: { hoy: FechaIso; para: string | null },
): EventoCalendario[] {
  const eventos: EventoCalendario[] = [];
  const persona = p.personas.find((x) => x.id === para && x.activa) ?? null;

  const porFecha = (items: ReadonlyArray<{ fecha: FechaIso; texto: string }>) => {
    const m = new Map<FechaIso, string[]>();
    for (const i of items) if (i.fecha >= hoy) m.set(i.fecha, [...(m.get(i.fecha) ?? []), i.texto]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  };
  for (const [f, platos] of porFecha(p.cenas.map((c) => ({ fecha: c.fecha, texto: c.nombre })))) {
    eventos.push({
      uid: `cena-${f}`,
      fecha: f,
      titulo: `🍽️ Cena: ${platos.join(" + ")}`,
      descripcion: `Platos: ${platos.join(", ")}`,
      hora: HORA_CENA,
    });
  }
  for (const [f, textos] of porFecha(p.almuerzos)) {
    eventos.push({
      uid: `comida-${f}`,
      fecha: f,
      titulo: `☀️ Comida: ${textos.join(" + ")}`,
      descripcion: `Comida: ${textos.join(", ")}`,
      hora: HORA_COMIDA,
    });
  }
  for (const [f, ev] of Object.entries(p.eventos).sort(([a], [b]) => a.localeCompare(b))) {
    if (f < hoy) continue;
    eventos.push({
      uid: `evento-${f}`,
      fecha: f,
      titulo: `${ev.emoji} ${ev.titulo}`.trim(),
      descripcion: ev.titulo,
    });
  }
  for (const a of p.agenda) {
    if ((a.hasta ?? a.fecha) < hoy) continue;
    eventos.push({
      uid: `agenda-${a.fecha}-${limpio(a.titulo)}`,
      fecha: a.fecha,
      titulo: `📌 ${a.titulo}`,
      descripcion: a.titulo,
      hora: a.hora,
      hasta: a.hasta,
      aviso: true,
    });
  }

  for (const c of p.cumples) {
    const dia = proximaFecha(c, hoy);
    const clave = limpio(c.nombre);
    eventos.push({
      uid: `cumple-${clave}`,
      fecha: dia,
      titulo: `🎂 Cumple de ${c.nombre}`,
      descripcion: `Cumpleaños de ${c.nombre}`,
      anual: true,
      aviso: true,
    });
    // Los avisos del regalo no son para quien cumple, ni para quien no se sabe quién es.
    const esRegaloParaOtro =
      persona !== null && persona.tipo === "adulto" && c.personaId !== persona.id;
    if (esRegaloParaOtro) {
      eventos.push(
        {
          uid: `regalo-pensar-${clave}`,
          fecha: sumarDias(dia, -30),
          titulo: `🎁 Pensar el regalo de ${c.nombre}`,
          descripcion: `Faltan 30 días para el cumple de ${c.nombre}: ¡a pensar ideas!`,
          anual: true,
          aviso: true,
        },
        {
          uid: `regalo-comprar-${clave}`,
          fecha: sumarDias(dia, -14),
          titulo: `🎁 Comprar el regalo de ${c.nombre}`,
          descripcion: `Faltan 14 días para el cumple de ${c.nombre}: hay que comprar el regalo.`,
          anual: true,
          aviso: true,
        },
      );
    }
  }

  // Lo recurrente de la casa: un evento por tarea, en el día que toca (hoy si va atrasada). Al
  // marcarla hecha en la app, la próxima vez que el móvil pida el calendario se mueve sola.
  const nombre = (id: string | null) => p.personas.find((x) => x.id === id)?.nombre ?? "Los dos";
  for (const t of p.casa) {
    if (persona && t.responsableId !== null && t.responsableId !== persona.id) continue;
    const toca = proximaVez({ ...t, id: "", aplazadaHasta: t.aplazadaHasta ?? null });
    const dia = toca < hoy ? hoy : toca;
    eventos.push({
      uid: `casa-${limpio(t.titulo)}`,
      fecha: dia,
      titulo: `${t.emoji} ${t.titulo}`,
      descripcion: `${t.titulo} (le toca a: ${nombre(t.responsableId)}). Se repite cada ${t.cadaDias} días desde la última vez que se hizo.`,
      aviso: true,
    });
  }
  return eventos;
}
