import { z } from "zod";
import { hablarDeDia, lista } from "./alexa";
import { fechaLarga } from "./avisos";
import { type ProyeccionCalendario, eventosSuscritos } from "./calendario-suscrito";
import type { EventoCalendario } from "./compartir";
import { type FechaIso, sumarDias } from "./fechas";
import { claveArticulo } from "./habituales";
import type { ItemCaptura } from "./ia-captura";
import type { Pronostico } from "./tiempo";

/**
 * Conchi (D-215): lo que la skill de Alexa hace además de apuntar la compra. Reparte una frase libre
 * (ya leída por la IA) en lo que se guarda directo y lo que se confirma en voz alta, lee mañana, la
 * mochila, la casa, el tiempo y un resumen, y encuentra la tarea de casa que se dice haber hecho.
 * Puro: sin red ni base de datos. Solo habla de compra, cena, citas, casa, mochila y tiempo.
 */

export const TIPOS_ENTRADA = ["compra", "pendiente", "cita", "hecha"] as const;
export type TipoEntrada = (typeof TIPOS_ENTRADA)[number];

export const entradaSchema = z.object({
  tipo: z.enum(TIPOS_ENTRADA),
  texto: z.string().min(1).max(200),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
});
export type Entrada = z.infer<typeof entradaSchema>;

/** Lo que Conchi guarda en el acto y lo que antes confirma en voz alta (las citas). */
export function planDeFrase(items: readonly ItemCaptura[]): {
  directas: Entrada[];
  porConfirmar: Entrada[];
} {
  const directas: Entrada[] = [];
  const porConfirmar: Entrada[] = [];
  for (const i of items) {
    const titulo = i.titulo.trim();
    if (!titulo) continue;
    if (i.tipo === "compra") {
      directas.push({ tipo: "compra", texto: titulo.slice(0, 80), fecha: null, hora: null });
    } else if ((i.tipo === "evento" || i.tipo === "papel") && i.fecha) {
      porConfirmar.push({ tipo: "cita", texto: titulo, fecha: i.fecha, hora: i.hora });
    } else {
      directas.push({ tipo: "pendiente", texto: titulo, fecha: null, hora: null });
    }
  }
  return { directas, porConfirmar };
}

/** «el jueves 3 de diciembre a las 18:00», o «hoy» / «mañana». */
export function cuandoHablado(fecha: FechaIso, hora: string | null, hoy: FechaIso): string {
  const dia =
    fecha === hoy ? "hoy" : fecha === sumarDias(hoy, 1) ? "mañana" : `el ${fechaLarga(fecha)}`;
  return `${dia}${hora ? ` a las ${hora.replace(/^0/, "")}` : ""}`;
}

export function preguntaDeCita(e: Entrada, hoy: FechaIso): string {
  return `¿Apunto ${e.texto} ${cuandoHablado(e.fecha ?? hoy, e.hora, hoy)}? Di sí o no.`;
}

/** Lo que dice Conchi tras guardar lo que no necesitaba confirmación. */
export function hablarDeLoGuardado(directas: readonly Entrada[]): string {
  const compras = directas.filter((d) => d.tipo === "compra").map((d) => d.texto);
  const pendientes = directas.filter((d) => d.tipo === "pendiente").map((d) => d.texto);
  const partes: string[] = [];
  if (compras.length > 0) partes.push(`${lista(compras)} en la compra`);
  if (pendientes.length > 0) partes.push(`${lista(pendientes)} en pendientes`);
  return partes.length > 0 ? `Apuntado: ${partes.join(", y ")}.` : "";
}

/** Las citas por confirmar, guardadas en la sesión de Alexa entre pregunta y pregunta. */
export function pendientesDeSesion(atributos: Record<string, unknown> | undefined): Entrada[] {
  const v = z.array(entradaSchema).max(10).safeParse(atributos?.porConfirmar);
  return v.success ? v.data : [];
}

// ---------------------------------------------------------------------------------------------
// Lo que lee Conchi, a partir de los mismos eventos del calendario suscrito.
// ---------------------------------------------------------------------------------------------

/** Quita el emoji del principio del título de un evento («🎒 Flauta · Diego» → «Flauta · Diego»). */
export const sinEmoji = (t: string): string => t.replace(/^[^\p{L}\p{N}¡¿(]+/u, "").trim();

const eventos = (
  p: ProyeccionCalendario,
  hoy: FechaIso,
  solo: "casa" | "tiempo",
  tiempo?: readonly Pronostico[],
): EventoCalendario[] => eventosSuscritos(p, { hoy, para: null, solo, tiempo });

/** «Flauta · Diego» → «Flauta de Diego». */
const cosaDeMochila = (titulo: string): string => {
  const [cosa, quien] = sinEmoji(titulo).split(" · ");
  return quien ? `${cosa} de ${quien}` : (cosa ?? "");
};

export const hablarDeManana = (p: ProyeccionCalendario, hoy: FechaIso): string =>
  hablarDeDia(p, sumarDias(hoy, 1), "Mañana tienes", "Mañana no tienes nada apuntado.");

/** Lo que hay que dejar preparado esta noche para el cole de mañana. */
export function hablarDeLaMochila(p: ProyeccionCalendario, hoy: FechaIso): string {
  const cosas = eventos(p, hoy, "casa")
    .filter((e) => e.uid?.startsWith("mochila-") && e.fecha === hoy)
    .map((e) => cosaDeMochila(e.titulo));
  return cosas.length === 0
    ? "No hay nada que preparar para el cole."
    : `Hay que dejar preparado: ${lista(cosas)}.`;
}

export function hablarDeLaCasa(p: ProyeccionCalendario, hoy: FechaIso): string {
  const tareas = eventos(p, hoy, "casa")
    .filter((e) => e.uid?.startsWith("casa-") && e.fecha <= hoy)
    .map((e) => sinEmoji(e.titulo));
  return tareas.length === 0 ? "Hoy no toca nada en casa." : `Hoy toca en casa: ${lista(tareas)}.`;
}

export function hablarDelTiempo(
  p: ProyeccionCalendario,
  hoy: FechaIso,
  tiempo: readonly Pronostico[],
): string {
  const avisos = eventos(p, hoy, "tiempo", tiempo)
    .filter((e) => e.fecha === hoy)
    .map((e) => sinEmoji(e.titulo));
  return avisos.length === 0
    ? "Hoy no hay nada especial con el tiempo."
    : `Con el tiempo, hoy: ${lista(avisos)}.`;
}

/** El resumen: citas de hoy, casa, mochila y tiempo; solo lo que haya. */
export function hablarDeLosAvisos(
  p: ProyeccionCalendario,
  hoy: FechaIso,
  tiempo: readonly Pronostico[],
): string {
  const partes = [
    hablarDeDia(p, hoy, "Hoy tienes", ""),
    hablarDeLaCasa(p, hoy),
    hablarDeLaMochila(p, hoy),
    hablarDelTiempo(p, hoy, tiempo),
  ].filter((x) => x !== "" && !/^(Hoy no toca|No hay nada|Hoy no hay)/.test(x));
  return partes.length > 0 ? partes.join(" ") : "Hoy no tienes nada pendiente.";
}

// ---------------------------------------------------------------------------------------------
// «Ya he hecho la colada»: qué tarea de casa es.
// ---------------------------------------------------------------------------------------------

const RELLENO = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "al",
  "a",
  "mi",
  "ya",
]);
const palabras = (t: string): string[] =>
  claveArticulo(t)
    .split(/\s+/)
    .filter((w) => w.length > 0 && !RELLENO.has(w));

/** La tarea de casa que se dice haber hecho (por sus palabras), o null si no hay una clara. */
export function buscarTareaDeCasa(
  p: ProyeccionCalendario,
  dicho: string | undefined,
): string | null {
  const buscadas = palabras(dicho ?? "");
  if (buscadas.length === 0) return null;
  const candidatas = p.casa.filter((t) => {
    const titulo = palabras(t.titulo);
    return buscadas.every((w) => titulo.some((x) => x.startsWith(w) || w.startsWith(x)));
  });
  return candidatas.length === 1 ? (candidatas[0]?.titulo ?? null) : null;
}

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

/** El texto con el que la app apunta una cita en «Apuntado»: «3 diciembre 2026 18:00 Psicotécnico». */
export function textoDeCita(fecha: FechaIso, hora: string | null, titulo: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES[(m ?? 1) - 1]} ${a}${hora ? ` ${hora}` : ""} ${titulo}`;
}
