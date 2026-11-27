import { z } from "zod";
import { hablarDeDia, lista } from "./alexa";
import { fechaLarga } from "./avisos";
import { type ProyeccionCalendario, eventosSuscritos } from "./calendario-suscrito";
import type { EventoCalendario } from "./compartir";
import { type FechaIso, sumarDias } from "./fechas";
import { claveArticulo } from "./habituales";
import type { ItemConchi } from "./ia-conchi";
import { proximaFecha } from "./cumples";
import { proximaVez } from "./casa";
import { type EventoEstadio, textoDelEvento } from "./metropolitano";
import { type Ahora, resolverRecordatorio } from "./recordatorio";
import type { Pronostico } from "./tiempo";

/**
 * Conchi (D-215): lo que la skill de Alexa hace además de apuntar la compra. Reparte una frase libre
 * (ya leída por la IA) en lo que se guarda directo y lo que se confirma en voz alta, lee mañana, la
 * mochila, la casa, el tiempo y un resumen, y encuentra la tarea de casa que se dice haber hecho.
 * Puro: sin red ni base de datos. Solo habla de compra, cena, citas, casa, mochila y tiempo.
 */

export const TIPOS_ENTRADA = [
  "compra",
  "pendiente",
  "cita",
  "hecha",
  "quitar_compra",
  "quitar_pendiente",
  "quitar_cita",
] as const;
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

export interface RecordatorioPuesto {
  texto: string;
  fecha: FechaIso;
  hora: string;
}

/**
 * Lo que Conchi hace con lo entendido: guarda en el acto la compra y los pendientes, pone los
 * recordatorios con hora, y confirma en voz alta las citas antes de guardarlas.
 */
export function planDeFrase(
  items: readonly ItemConchi[],
  ahora: Ahora,
): { directas: Entrada[]; porConfirmar: Entrada[]; recordatorios: RecordatorioPuesto[] } {
  const directas: Entrada[] = [];
  const porConfirmar: Entrada[] = [];
  const recordatorios: RecordatorioPuesto[] = [];
  const pendiente = (texto: string) =>
    directas.push({ tipo: "pendiente", texto: texto.slice(0, 200), fecha: null, hora: null });
  for (const i of items) {
    const titulo = i.titulo.trim();
    if (!titulo) continue;
    if (i.tipo === "compra") {
      directas.push({ tipo: "compra", texto: titulo.slice(0, 80), fecha: null, hora: null });
    } else if (i.tipo === "cita" && i.fecha) {
      porConfirmar.push({ tipo: "cita", texto: titulo, fecha: i.fecha, hora: i.hora });
    } else if (i.tipo === "recordatorio" && i.hora) {
      const cuando = resolverRecordatorio(i.hora, i.ambigua, i.fecha, ahora);
      if (cuando) recordatorios.push({ texto: titulo, ...cuando });
      else pendiente(titulo);
    } else {
      pendiente(titulo);
    }
  }
  return { directas, porConfirmar, recordatorios };
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

/** El día en que toca una tarea de casa del resumen (que no lleva identificador). */
const proximaDe = (t: ProyeccionCalendario["casa"][number]): FechaIso =>
  proximaVez({ id: "", ...t, aplazadaHasta: t.aplazadaHasta ?? null });

// ---------------------------------------------------------------------------------------------
// D-216: más cosas que leer, quitar, saber quién habla y contestar preguntas.
// ---------------------------------------------------------------------------------------------

/** Una de varias formas de decir lo mismo (Conchi no suena a robot). `azar` va de 0 a 1. */
export const elegir = <T>(opciones: readonly T[], azar: number = Math.random()): T =>
  opciones[Math.min(opciones.length - 1, Math.floor(azar * opciones.length))] as T;

/** «Buenos días», «Buenas tardes» o «Buenas noches», según la hora de Madrid. */
export const saludoDeLaHora = (minutos: number): string =>
  minutos < 5 * 60
    ? "Buenas noches"
    : minutos < 13 * 60
      ? "Buenos días"
      : minutos < 20 * 60
        ? "Buenas tardes"
        : "Buenas noches";

/** Lo que hay apuntado a mano en la compra (y sin comprar). */
export function hablarDeLaCompraApuntada(lista: readonly string[]): string {
  if (lista.length === 0) return "No hay nada apuntado en la compra.";
  const primeras = lista.slice(0, 12);
  const resto = lista.length - primeras.length;
  return `En la compra hay ${lista.length === 1 ? "una cosa" : `${lista.length} cosas`}: ${lista_(primeras)}${resto > 0 ? ` y ${resto} más` : ""}.`;
}
const lista_ = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;

/** ¿Hay tal cosa en la compra? (por sus palabras; null si no se dijo qué). */
export function hablarDeSiHayEnLaCompra(
  lista: readonly string[],
  dicho: string | undefined,
): string {
  const buscadas = palabras(dicho ?? "");
  if (buscadas.length === 0) return hablarDeLaCompraApuntada(lista);
  const hay = lista.find((x) => {
    const p = palabras(x);
    return buscadas.every((w) => p.some((y) => y.startsWith(w) || w.startsWith(y)));
  });
  return hay ? `Sí, ${hay} está en la compra.` : "No, eso no está apuntado en la compra.";
}

/** El nombre exacto con el que se apuntó algo en la compra, para poder quitarlo (o null). */
export function buscarEnLaCompra(
  lista: readonly string[],
  dicho: string | undefined,
): string | null {
  const buscadas = palabras(dicho ?? "");
  if (buscadas.length === 0) return null;
  const cand = lista.filter((x) => {
    const p = palabras(x);
    return buscadas.every((w) => p.some((y) => y.startsWith(w) || w.startsWith(y)));
  });
  return cand.length === 1 ? (cand[0] ?? null) : null;
}

export function hablarDePendientes(p: ProyeccionCalendario): string {
  const abiertos = (p.pendientes ?? []).filter((x) => !x.hechoEn);
  if (abiertos.length === 0) return "No hay nada pendiente.";
  const orden = [...abiertos].sort((a, b) => Number(b.importante) - Number(a.importante));
  const primeros = orden.slice(0, 6).map((x) => x.texto);
  const resto = abiertos.length - primeros.length;
  return `Hay ${abiertos.length === 1 ? "un pendiente" : `${abiertos.length} pendientes`}: ${lista_(primeros)}${resto > 0 ? ` y ${resto} más` : ""}.`;
}

/** Los papeles que vencen en los próximos 60 días (lo ya hecho no sale). */
export function hablarDeLosPapeles(p: ProyeccionCalendario, hoy: FechaIso): string {
  const limite = sumarDias(hoy, 60);
  const cerca = (p.vencimientos ?? [])
    .filter((v) => !v.hechoEn && v.fecha <= limite)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 5)
    .map((v) => `${v.titulo}, ${v.fecha < hoy ? "ya vencido" : cuandoHablado(v.fecha, null, hoy)}`);
  return cerca.length === 0
    ? "No vence ningún papel en los próximos dos meses."
    : `Vence pronto: ${lista_(cerca)}.`;
}

/** ¿Hay partido o concierto en el Metropolitano hoy? */
export function hablarDelEstadio(eventos: readonly EventoEstadio[], hoy: FechaIso): string {
  const hoyEs = eventos.filter((e) => e.fecha === hoy);
  if (hoyEs.length === 0) {
    const siguiente = [...eventos]
      .filter((e) => e.fecha > hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    return siguiente
      ? `Hoy no hay nada en el Metropolitano. Lo siguiente es ${cuandoHablado(siguiente.fecha, siguiente.hora, hoy)}: ${siguiente.titulo}.`
      : "Hoy no hay nada en el Metropolitano.";
  }
  return `Hoy hay ${lista_(hoyEs.map((e) => sinEmoji(textoDelEvento(e)).replace(/^(Partido|Concierto|Evento) en el [^ ]+ /, "")))} en el Metropolitano.`;
}

/** El nombre de una persona de la familia, por lo que se dijo (sin tildes ni mayúsculas); su id o null. */
export function personaPorNombre(
  p: ProyeccionCalendario,
  dicho: string | undefined,
): { id: string; nombre: string } | null {
  const buscada = claveArticulo(dicho ?? "");
  if (!buscada) return null;
  const c = p.personas.filter((x) => x.activa && claveArticulo(x.nombre) === buscada);
  return c.length === 1 ? { id: c[0]!.id, nombre: c[0]!.nombre } : null;
}

/** Las tareas de casa de hoy que le tocan a una persona (o a cualquiera). */
export function hablarDeLoQueLeToca(
  p: ProyeccionCalendario,
  hoy: FechaIso,
  personaId: string,
): string {
  const mias = p.casa
    .filter(
      (t) => (t.responsableId === personaId || t.responsableId === null) && proximaDe(t) <= hoy,
    )
    .map((t) => t.titulo);
  return mias.length === 0 ? "Hoy no te toca nada en casa." : `Hoy te toca: ${lista_(mias)}.`;
}

/**
 * Los datos de la casa, en texto compacto, para que la IA conteste preguntas (D-216). Solo lo que
 * ya sale en el calendario suscrito: citas, fechas, cumples, casa, comidas, mochila y papeles.
 */
export function datosParaPreguntar(
  p: ProyeccionCalendario,
  hoy: FechaIso,
  estadio: readonly EventoEstadio[] = [],
): string {
  const nombre = (id: string | null | undefined) =>
    p.personas.find((x) => x.id === id)?.nombre ?? "cualquiera";
  const fin = sumarDias(hoy, 45);
  const L: string[] = [];
  L.push(
    `Familia: ${p.personas
      .filter((x) => x.activa)
      .map((x) => `${x.nombre} (${x.tipo === "nino" ? "niño" : "adulto"})`)
      .join(", ")}.`,
  );
  const citas = [
    ...p.agenda
      .filter((a) => (a.hasta ?? a.fecha) >= hoy && a.fecha <= fin)
      .map((a) => `${a.fecha}${a.hora ? ` ${a.hora}` : ""}: ${a.titulo}`),
    ...Object.entries(p.eventos)
      .filter(([f]) => f >= hoy && f <= fin)
      .map(([f, e]) => `${f}: ${e.titulo}`),
  ].sort();
  L.push(`Citas y fechas (próximos 45 días):\n${citas.length ? citas.join("\n") : "ninguna"}`);
  L.push(
    `Cumpleaños:\n${
      p.cumples
        .map((c) => ({ c, f: proximaFecha(c, hoy) }))
        .sort((a, b) => a.f.localeCompare(b.f))
        .slice(0, 12)
        .map(
          ({ c, f }) =>
            `${c.nombre}: ${f}${c.anio ? ` (cumple ${Number(f.slice(0, 4)) - c.anio} años)` : ""}`,
        )
        .join("\n") || "ninguno"
    }`,
  );
  L.push(
    `Tareas de casa (cada cuántos días, última vez, próxima vez, a quién le toca):\n${
      p.casa
        .map(
          (t) =>
            `${t.titulo}: cada ${t.cadaDias} días, última vez ${t.ultimaVez ?? "nunca"}, próxima ${proximaDe(t)}, le toca a ${nombre(t.responsableId)}`,
        )
        .join("\n") || "ninguna"
    }`,
  );
  const comidas = [
    ...p.cenas
      .filter((c) => c.fecha >= hoy && c.fecha <= sumarDias(hoy, 10))
      .map((c) => `${c.fecha} cena: ${c.nombre}`),
    ...(p.cole ?? [])
      .filter((c) => c.fecha >= hoy && c.fecha <= sumarDias(hoy, 10))
      .map((c) => `${c.fecha} cole: ${[c.primero, c.segundo].filter(Boolean).join(", ")}`),
  ].sort();
  L.push(`Comidas (próximos 10 días):\n${comidas.length ? comidas.join("\n") : "sin datos"}`);
  L.push(
    `Mochila (qué llevar):\n${(p.mochila ?? []).map((m) => `${m.texto} (${nombre(m.personaId)}), días de la semana ${m.dias.join("/")}`).join("\n") || "nada"}`,
  );
  L.push(
    `Pendientes sin fecha:\n${
      (p.pendientes ?? [])
        .filter((x) => !x.hechoEn)
        .map((x) => `${x.texto} (${nombre(x.personaId)}, desde ${x.creadoEn})`)
        .join("\n") || "ninguno"
    }`,
  );
  L.push(
    `Papeles que vencen:\n${
      (p.vencimientos ?? [])
        .filter((v) => !v.hechoEn)
        .map((v) => `${v.titulo}: ${v.fecha}`)
        .join("\n") || "ninguno"
    }`,
  );
  if (estadio.length > 0) {
    L.push(
      `Metropolitano:\n${estadio
        .filter((e) => e.fecha >= hoy)
        .slice(0, 8)
        .map((e) => `${e.fecha}${e.hora ? ` ${e.hora}` : ""}: ${e.titulo}`)
        .join("\n")}`,
    );
  }
  return L.join("\n\n").slice(0, 9000);
}

/**
 * Lo recogido de la cola, listo para aplicar: lo que se apuntó y se quitó antes de abrir la app se
 * anula entre sí (no hay nada que apuntar ni que borrar); el resto se queda en su orden.
 */
export function reducirEntradas(lista: readonly Entrada[]): Entrada[] {
  const clave = (e: Entrada) => `${claveArticulo(e.texto)}|${e.fecha ?? ""}`;
  const salida: Array<Entrada | null> = [...lista];
  lista.forEach((e, i) => {
    if (!e.tipo.startsWith("quitar_")) return;
    const apuntar = e.tipo.slice("quitar_".length);
    const previo = salida.findIndex(
      (x, j) => j < i && x !== null && x.tipo === apuntar && clave(x) === clave(e),
    );
    if (previo >= 0) {
      salida[previo] = null;
      salida[i] = null;
    }
  });
  return salida.filter((x): x is Entrada => x !== null);
}

/**
 * El resumen sin las citas sorpresa (D-217): Conchi habla en voz alta y puede oírla cualquiera, así
 * que lo marcado como sorpresa no entra en nada de lo que dice (ni en lo que ve la IA).
 */
export function sinSorpresas(p: ProyeccionCalendario): ProyeccionCalendario {
  return p.agenda.some((a) => a.secreta) ? { ...p, agenda: p.agenda.filter((a) => !a.secreta) } : p;
}
