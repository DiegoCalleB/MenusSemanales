import { type ProyeccionCalendario } from "./calendario-suscrito";
import { type TareaCasa, diasParaCasa } from "./casa";
import { diasHasta } from "./cumples";
import { type FechaIso, diaSemanaIso, sumarDias } from "./fechas";

/**
 * Avisos del día (D-114): lo que merece que alguien lo vea hoy. Es el mismo cálculo para la
 * campanita de la app, el resumen por correo y la notificación del móvil. Puro: recibe datos ya
 * preparados (de la app o del resumen que da la base de datos) y devuelve avisos.
 */

export type NivelAviso = "ya" | "pronto" | "info";

export interface Aviso {
  /** Estable entre días iguales: sirve de clave y para no repetir. */
  id: string;
  emoji: string;
  titulo: string;
  detalle?: string;
  /** «ya» pide hacer algo hoy; «pronto» se acerca; «info» solo informa. */
  nivel: NivelAviso;
}

export interface EntradaAvisos {
  hoy: FechaIso;
  /** Platos de la cena de hoy y de mañana. */
  cenaHoy: readonly string[];
  cenaManana: readonly string[];
  /** Mañana no se cena en casa (no hace falta elegir cena). */
  mananaSinCena?: boolean;
  comidaHoy: readonly string[];
  citas: ReadonlyArray<{ fecha: FechaIso; titulo: string; hora: string | null }>;
  tareas: readonly TareaCasa[];
  cumples: ReadonlyArray<{ nombre: string; dia: number; mes: number }>;
}

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]; // prettier-ignore

/** «martes 3 de noviembre». */
export function fechaLarga(f: FechaIso): string {
  const [, m, d] = f.split("-").map(Number);
  return `${DIAS[diaSemanaIso(f) - 1] ?? ""} ${d} de ${MESES[(m ?? 1) - 1] ?? ""}`;
}

const MAX_TAREAS = 5;
/** Con esta antelación (en días) se avisa de un cumpleaños. */
const AVISAR_CUMPLE = new Set([0, 1, 3, 7, 14, 30]);

export function avisosDeHoy(e: EntradaAvisos): Aviso[] {
  const out: Aviso[] = [];
  const manana = sumarDias(e.hoy, 1);

  // Cumpleaños: lo primero, que son lo que no se puede olvidar.
  for (const c of e.cumples) {
    const dias = diasHasta(c, e.hoy);
    if (!AVISAR_CUMPLE.has(dias)) continue;
    const cuando = dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`;
    out.push({
      id: `cumple-${c.nombre}-${dias}`,
      emoji: "🎂",
      titulo: `Cumple de ${c.nombre} ${cuando}`,
      ...(dias >= 14
        ? { detalle: dias >= 30 ? "Empezad a pensar el regalo" : "Hay que comprar el regalo" }
        : {}),
      nivel: dias <= 1 ? "ya" : dias <= 7 ? "pronto" : "info",
    });
  }

  // Cena y comida de hoy.
  if (e.cenaHoy.length > 0) {
    out.push({
      id: "cena-hoy",
      emoji: "🍝",
      titulo: `Cena: ${e.cenaHoy.join(" + ")}`,
      nivel: "info",
    });
  } else {
    out.push({ id: "cena-hoy-falta", emoji: "🍝", titulo: "Hoy no hay cena elegida", nivel: "ya" });
  }
  if (e.comidaHoy.length > 0) {
    out.push({
      id: "comida-hoy",
      emoji: "☀️",
      titulo: `Comida: ${e.comidaHoy.join(" + ")}`,
      nivel: "info",
    });
  }

  // Citas de hoy y de mañana.
  const citas = e.citas
    .filter((c) => c.fecha === e.hoy || c.fecha === manana)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? ""));
  for (const c of citas) {
    const hoyEs = c.fecha === e.hoy;
    out.push({
      id: `cita-${c.fecha}-${c.titulo}`,
      emoji: "📌",
      titulo: `${hoyEs ? "Hoy" : "Mañana"}${c.hora ? ` ${c.hora}` : ""}: ${c.titulo}`,
      nivel: hoyEs ? "ya" : "pronto",
    });
  }

  // Lo que toca en casa ya (atrasado o de hoy).
  const casa = e.tareas
    .filter((t) => diasParaCasa(t, e.hoy) <= 0)
    .sort(
      (a, b) =>
        diasParaCasa(a, e.hoy) - diasParaCasa(b, e.hoy) || a.titulo.localeCompare(b.titulo, "es"),
    );
  if (casa.length > 0) {
    const nombres = casa.slice(0, MAX_TAREAS).map((t) => `${t.emoji} ${t.titulo}`);
    const resto = casa.length - nombres.length;
    out.push({
      id: "casa-hoy",
      emoji: "🏠",
      titulo: `En casa ${casa.length === 1 ? "toca" : "tocan"}: ${nombres.join(", ")}${resto > 0 ? ` y ${resto} más` : ""}`,
      nivel: "ya",
    });
  }

  // Mañana sin cena elegida: mejor pensarla hoy.
  if (e.cenaManana.length === 0 && !e.mananaSinCena) {
    out.push({
      id: "cena-manana-falta",
      emoji: "💭",
      titulo: "Mañana aún no hay cena elegida",
      nivel: "pronto",
    });
  }

  const orden: Record<NivelAviso, number> = { ya: 0, pronto: 1, info: 2 };
  return out
    .map((a, i) => ({ a, i }))
    .sort((x, y) => orden[x.a.nivel] - orden[y.a.nivel] || x.i - y.i)
    .map((x) => x.a);
}

/** Avisos que piden hacer algo (los que dan la campanita y las notificaciones). */
export const avisosQueImportan = (avisos: readonly Aviso[]) =>
  avisos.filter((a) => a.nivel !== "info");

export interface ResumenDelDia {
  asunto: string;
  texto: string;
  html: string;
}

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** El resumen de la mañana: asunto, texto plano y HTML sencillo (para el correo). */
export function resumenDelDia(hoy: FechaIso, avisos: readonly Aviso[]): ResumenDelDia {
  const cena = avisos.find((a) => a.id === "cena-hoy");
  const pendientes = avisosQueImportan(avisos).length;
  const asunto = `Hoy ${fechaLarga(hoy)}${cena ? ` · ${cena.titulo.replace("Cena: ", "cena ")}` : ""}${pendientes > 0 ? ` · ${pendientes} ${pendientes === 1 ? "aviso" : "avisos"}` : ""}`;
  const texto = [
    `Buenos días. Esto es lo de hoy, ${fechaLarga(hoy)}:`,
    "",
    ...avisos.map((a) => `${a.emoji} ${a.titulo}${a.detalle ? ` (${a.detalle})` : ""}`),
    "",
    "— ¡Hecho!",
  ].join("\n");
  const filas = avisos
    .map(
      (a) =>
        `<tr><td style="padding:6px 10px 6px 0;font-size:20px;vertical-align:top">${a.emoji}</td><td style="padding:6px 0;font-size:16px;${a.nivel === "ya" ? "font-weight:700;" : ""}">${escapar(a.titulo)}${a.detalle ? `<br><span style="color:#6b5b62;font-size:14px;font-weight:400">${escapar(a.detalle)}</span>` : ""}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:16px;background:#fff7f4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2a1a20"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:20px"><h1 style="font-size:20px;margin:0 0 4px">Buenos días 🍽️</h1><p style="margin:0 0 12px;color:#6b5b62">Lo de hoy, ${escapar(fechaLarga(hoy))}</p><table role="presentation" style="border-collapse:collapse;width:100%">${filas}</table><p style="margin:16px 0 0;color:#6b5b62;font-size:13px">¡Hecho!</p></div></body></html>`;
  return { asunto, texto, html };
}

/** Título y cuerpo cortos para una notificación del móvil. */
export function notificacionDelDia(hoy: FechaIso, avisos: readonly Aviso[]) {
  const importantes = avisosQueImportan(avisos);
  const cena = avisos.find((a) => a.id === "cena-hoy");
  const base = importantes.length > 0 ? importantes : avisos;
  return {
    titulo: cena ? cena.titulo.replace("Cena: ", "Hoy cena: ") : `Hoy ${fechaLarga(hoy)}`,
    cuerpo: base
      .slice(0, 3)
      .map((a) => `${a.emoji} ${a.titulo}`)
      .join("\n")
      .slice(0, 240),
  };
}

/** Los avisos a partir del resumen mínimo que da la base de datos (el del calendario suscrito). */
export function entradaDeProyeccion(p: ProyeccionCalendario, hoy: FechaIso): EntradaAvisos {
  const manana = sumarDias(hoy, 1);
  const platos = (f: FechaIso) => p.cenas.filter((c) => c.fecha === f).map((c) => c.nombre);
  return {
    hoy,
    cenaHoy: platos(hoy),
    cenaManana: platos(manana),
    comidaHoy: p.almuerzos.filter((a) => a.fecha === hoy).map((a) => a.texto),
    citas: p.agenda.map((a) => ({ fecha: a.fecha, titulo: a.titulo, hora: a.hora })),
    tareas: p.casa.map((t, i) => ({
      id: `t${i}`,
      titulo: t.titulo,
      emoji: t.emoji,
      cadaDias: t.cadaDias,
      responsableId: t.responsableId,
      ultimaVez: t.ultimaVez,
      desde: t.desde,
      aplazadaHasta: t.aplazadaHasta ?? null,
    })),
    cumples: p.cumples.map((c) => ({ nombre: c.nombre, dia: c.dia, mes: c.mes })),
  };
}

/** `AVISOS_CORREO` admite varias direcciones separadas por comas o espacios. */
export function direccionesDeAvisos(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(/[\s,;]+/)
    .filter((d) => /^[^\s@]+@[^\s@]+$/.test(d))
    .slice(0, 10);
}
