import { z } from "zod";
import { proximaVez } from "./casa";
import type { EventoCalendario } from "./compartir";
import { proximaFecha } from "./cumples";
import { type FechaIso, diaSemanaIso, sumarDias } from "./fechas";
import { NOMBRE_DIA_LARGO, preparacionesEntre } from "./mochila";

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
  /** Menú del cole (D-141), solo los platos. Opcional: la función SQL anterior no lo manda. */
  cole: z
    .array(
      z.object({
        fecha,
        primero: z.string().max(200).nullish(),
        segundo: z.string().max(200).nullish(),
        postre: z.string().max(200).nullish(),
      }),
    )
    .catch([])
    .optional(),
  /** Qué llevar (D-136). Opcional: la función SQL anterior no lo manda. */
  mochila: z
    .array(
      z.object({
        personaId: z.string(),
        texto,
        dias: z.array(z.number().int().min(1).max(7)).catch([]),
        fecha: fecha.nullish().catch(null),
        antes: z.number().int().min(0).max(7).catch(1),
      }),
    )
    .catch([])
    .optional(),
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

/** A qué hora sale en el calendario el recordatorio de dejar preparada la mochila (alarma una hora antes). */
export const HORA_MOCHILA = "20:00";
/** Cuántos días por delante se ponen los recordatorios de la mochila. */
const DIAS_MOCHILA = 56;

/** A qué hora salen en el calendario las comidas y cenas (no llevan hora propia en la app). */
export const HORA_COMIDA = "14:00";
/** La comida del cole (D-141), un poco antes que la de casa. */
export const HORA_COLE = "13:00";
/** Entre semana se cena antes (20:00); sábados y domingos, a las 21:00. */
export const HORA_CENA_SEMANA = "20:00";
export const HORA_CENA = "21:00";

/** ¿Es sábado o domingo? (`AAAA-MM-DD`, sin depender de la zona horaria). */
const esFinDeSemana = (f: string) => [0, 6].includes(new Date(`${f}T12:00:00Z`).getUTCDay());

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
 * si el evento tiene hora). Los cumpleaños salen solo el día del cumple, con su tarta: sin avisos de
 * «pensar» ni «comprar» el regalo (D-143; siguen en la app).
 */
/** Qué calendario se pide (D-140): las fechas (lo de no olvidar) o solo las comidas y cenas. */
export type CalendarioSuscrito = "fechas" | "comidas";

const esComida = (e: EventoCalendario) => /^(cena|comida|cole)-/.test(e.uid ?? "");

/**
 * Los eventos de uno de los dos calendarios suscritos (D-140): «fechas» (citas, fechas señaladas,
 * cumpleaños y regalos, casa y mochila) o «comidas» (comidas y cenas). Separados, en Google cada uno
 * tiene su color y se puede ocultar.
 */
export function eventosSuscritos(
  p: ProyeccionCalendario,
  opciones: { hoy: FechaIso; para: string | null; solo?: CalendarioSuscrito },
): EventoCalendario[] {
  const todos = todosLosEventos(p, opciones);
  return opciones.solo === "comidas" ? todos.filter(esComida) : todos.filter((e) => !esComida(e));
}

function todosLosEventos(
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
      hora: esFinDeSemana(f) ? HORA_CENA : HORA_CENA_SEMANA,
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
  // Menú del cole (D-141): primero y segundo en el título; el postre, en la descripción.
  for (const c of p.cole ?? []) {
    if (c.fecha < hoy) continue;
    const platos = [c.primero, c.segundo].filter((x): x is string => Boolean(x && x.trim()));
    if (platos.length === 0) continue;
    eventos.push({
      uid: `cole-${c.fecha}`,
      fecha: c.fecha,
      titulo: `🏫 Cole: ${platos.join(" · ")}`,
      descripcion: `Comida del cole: ${platos.join(", ")}${c.postre ? `. Postre: ${c.postre}` : ""}`,
      hora: HORA_COLE,
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
    // Sin avisos de «pensar» ni «comprar» el regalo (D-143): en el calendario, solo el cumple.
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
  // Qué llevar (D-136): el día de dejarlo preparado, a las 20:00 y con alarma.
  const cosas = (p.mochila ?? []).map((c, i) => ({
    ...c,
    id: String(i),
    fecha: c.fecha ?? null,
    preparadas: [],
  }));
  const nombreDe = (id: string) => p.personas.find((x) => x.id === id)?.nombre ?? "";
  for (const { dia, cosa, para } of preparacionesEntre(cosas, hoy, DIAS_MOCHILA)) {
    const quien = nombreDe(cosa.personaId);
    const cuando =
      para === dia
        ? "para hoy"
        : para === sumarDias(dia, 1)
          ? "para mañana"
          : `para el ${NOMBRE_DIA_LARGO[diaSemanaIso(para) - 1]}`;
    eventos.push({
      uid: `mochila-${dia}-${limpio(cosa.texto)}-${limpio(quien)}`,
      fecha: dia,
      titulo: `🎒 Preparar: ${cosa.texto}${quien ? ` de ${quien}` : ""} (${cuando})`,
      descripcion: `Dejar preparado ${cosa.texto}${quien ? ` de ${quien}` : ""} ${cuando}.`,
      hora: HORA_MOCHILA,
      aviso: true,
    });
  }
  return eventos;
}
