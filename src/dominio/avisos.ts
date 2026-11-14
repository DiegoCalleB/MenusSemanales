import { type ProyeccionCalendario } from "./calendario-suscrito";
import { type TareaCasa, diasParaCasa } from "./casa";
import { diasHasta } from "./cumples";
import { type FechaIso, diaSemanaIso, sumarDias } from "./fechas";
import { paraPreparar } from "./mochila";
import { type AjusteCole, consultaCole, diaDeCole } from "./calendario-escolar";
import {
  type LluviaEnFranja,
  type Pronostico,
  consejosDelTiempo,
  lluviaEnFranja,
  textoDeLluviaDelCole,
} from "./tiempo";

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
  /** Qué llevar (D-136), con el nombre de la persona ya puesto. */
  mochila?: ReadonlyArray<CosaParaAviso>;
  /** Días con cena elegida (para el aviso del domingo, D-137). */
  diasConCena?: readonly FechaIso[];
  /** Días en que no se cena en casa (no cuentan como «falta cena»). */
  diasSinCena?: readonly FechaIso[];
  /** Lo que apunta la familia sobre el calendario escolar (D-144). */
  diasCole?: readonly AjusteCole[];
  /** ¿Avisar de los días sin cole? Solo si el hogar tiene algo del cole (mochila, menú). */
  conCole?: boolean;
  /** La previsión del tiempo (D-145), si se pudo leer. */
  tiempo?: readonly Pronostico[];
  /** Los cursos del calendario escolar leídos solos (D-146): se avisa los días después de cargarlos. */
  cursosNuevos?: ReadonlyArray<{ nombre: string; inicio: FechaIso; cambiadoEn: string | null }>;
}

/**
 * Qué ponerse o llevar ese día según el tiempo (D-145): «Hoy, lluvia (65 %): chubasquero y botas».
 * Los días de cole, la lluvia se mira hora a hora en la ida y la vuelta (D-148): «Mañana llueve de
 * camino al cole (de 8 a 9 h, 70 %): paraguas y chubasquero». Ese aviso sustituye al de lluvia del
 * día (que diría lo mismo con menos detalle); el resto (tormenta, frío…) sigue.
 */
function avisosDelTiempo(
  tiempo: readonly Pronostico[] | undefined,
  fecha: FechaIso,
  cuando: "Hoy" | "Mañana",
  conCole = false,
): Aviso[] {
  const p = tiempo?.find((x) => x.fecha === fecha);
  if (!p) return [];
  const paraguas = conCole ? avisoDelParaguas(p, cuando) : null;
  return [
    ...(paraguas ? [paraguas] : []),
    ...consejosDelTiempo(p)
      .filter((c) => !(paraguas && c.clave === "lluvia"))
      .map((c) => ({
        id: `tiempo-${fecha}-${c.clave}`,
        emoji: c.emoji,
        titulo: `${cuando}, ${c.que.charAt(0).toLowerCase()}${c.que.slice(1)}: ${c.llevar}`,
        nivel: "ya" as const,
      })),
  ];
}

/** La lluvia en la ida y la vuelta del cole de ese día (D-148), o nada si no moja. */
export function lluviaDelCole(p: Pronostico): LluviaEnFranja[] {
  return [lluviaEnFranja(p, "ida"), lluviaEnFranja(p, "vuelta")].filter(
    (l): l is LluviaEnFranja => l !== null,
  );
}

function avisoDelParaguas(p: Pronostico, cuando: "Hoy" | "Mañana"): Aviso | null {
  const l = lluviaDelCole(p);
  if (l.length === 0) return null;
  // Si moja a la vuelta y no a la ida, el paraguas hay que cogerlo igual al salir de casa.
  const soloVuelta = l.length === 1 && l[0]!.franja === "vuelta";
  return {
    id: `tiempo-${p.fecha}-paraguas`,
    emoji: "🌂",
    titulo: `${cuando} ${textoDeLluviaDelCole(l)}: ${soloVuelta ? "salid con paraguas" : "paraguas y chubasquero"}`,
    nivel: "ya",
  };
}

/** ¿Hay cole ese día para el hogar? Solo si tiene algo del cole (D-144) y no es un día sin cole. */
const hayColeEse = (e: EntradaAvisos, f: FechaIso) =>
  !!e.conCole && diaDeCole(f, e.diasCole ?? []).hay;

/**
 * El aviso de antes de salir (D-148): a primera hora de un día de cole, con la previsión recién
 * leída, si va a llover en la ida o en la vuelta. Vacío si no: entonces no se manda nada.
 */
export function avisosAntesDelCole(e: EntradaAvisos): Aviso[] {
  if (!hayColeEse(e, e.hoy)) return [];
  const p = e.tiempo?.find((x) => x.fecha === e.hoy);
  const a = p ? avisoDelParaguas(p, "Hoy") : null;
  return a ? [a] : [];
}

export function notificacionAntesDelCole(avisos: readonly Aviso[]) {
  return {
    titulo: "🌂 Coged el paraguas",
    cuerpo: avisos
      .map((a) => a.titulo)
      .join("\n")
      .slice(0, 240),
  };
}

export interface CosaParaAviso {
  texto: string;
  persona: string;
  dias: readonly number[];
  fecha: FechaIso | null;
  antes: number;
  preparadas?: readonly FechaIso[];
  /** Solo los días que hay cole (D-144). Si falta, sí. */
  soloConCole?: boolean;
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

  // Qué llevar (D-136): lo que hay que dejar preparado hoy.
  const cosas = (e.mochila ?? []).map((c, i) => ({
    id: String(i),
    personaId: c.persona,
    texto: c.texto,
    dias: [...c.dias],
    fecha: c.fecha,
    antes: c.antes,
    preparadas: [...(c.preparadas ?? [])],
    soloConCole: c.soloConCole !== false,
  }));
  const ajustes = e.diasCole ?? [];
  for (const { cosa, para, hecho } of paraPreparar(cosas, e.hoy, consultaCole(ajustes))) {
    if (hecho) continue;
    const cuando =
      para === e.hoy ? "para hoy" : para === manana ? "para mañana" : `para el ${fechaLarga(para)}`;
    out.push({
      id: `mochila-${para}-${cosa.texto}-${cosa.personaId}`,
      emoji: "🎒",
      titulo: `Deja preparado: ${cosa.texto}${cosa.personaId ? ` de ${cosa.personaId}` : ""} (${cuando})`,
      nivel: "ya",
    });
  }

  // El tiempo de hoy (D-145): qué ponerse o llevar.
  out.push(...avisosDelTiempo(e.tiempo, e.hoy, "Hoy", hayColeEse(e, e.hoy)));

  // Calendario escolar (D-144): el aviso de que mañana no hay cole (solo el primer día de cada
  // parón, no cada día de unas vacaciones) y de que mañana vuelve.
  if (e.conCole) {
    const d = diaDeCole(manana, ajustes);
    if (diaSemanaIso(manana) <= 5) {
      let anterior = sumarDias(manana, -1);
      while (diaSemanaIso(anterior) >= 6) anterior = sumarDias(anterior, -1);
      const antes = diaDeCole(anterior, ajustes);
      if (!d.hay && antes.hay) {
        out.push({
          id: `cole-no-${manana}`,
          emoji: "🏫",
          titulo: `Mañana no hay cole: ${d.motivo}`,
          nivel: "pronto",
        });
      } else if (d.hay && !antes.hay && antes.origen !== "fin-de-semana") {
        out.push({
          id: `cole-vuelve-${manana}`,
          emoji: "🏫",
          titulo: "Mañana vuelve el cole",
          detalle: "Mochila, uniforme y lo que haya que llevar.",
          nivel: "pronto",
        });
      }
    }
  }

  // Calendario escolar nuevo o actualizado (D-146): se avisa tres días, para que se vea.
  if (e.conCole) {
    for (const c of e.cursosNuevos ?? []) {
      const dia = c.cambiadoEn?.slice(0, 10);
      if (!dia || dia > e.hoy || dia < sumarDias(e.hoy, -2)) continue;
      out.push({
        id: `calendario-escolar-${c.inicio}-${dia}`,
        emoji: "📅",
        titulo: `Calendario escolar al día: ${c.nombre.replace(/ · .*/, "")}, empieza el ${fechaLarga(c.inicio)}`,
        detalle:
          "Lo he leído de la web de la Comunidad de Madrid. Míralo en Mochila → Días sin cole.",
        nivel: "pronto",
      });
    }
  }

  // El domingo, planear la semana que empieza (D-137).
  if (diaSemanaIso(e.hoy) === 7 && e.diasConCena) {
    const semana = Array.from({ length: 7 }, (_, i) => sumarDias(e.hoy, i + 1));
    const con = new Set(e.diasConCena);
    const sin = new Set(e.diasSinCena ?? []);
    const faltan = semana.filter((d) => !con.has(d) && !sin.has(d)).length;
    const citas = e.citas.filter((c) => semana.includes(c.fecha)).length;
    const partes = [
      faltan > 0 ? `faltan ${faltan} ${faltan === 1 ? "cena" : "cenas"}` : "cenas listas",
      `${citas} ${citas === 1 ? "cita" : "citas"}`,
    ];
    out.push({
      id: `plan-semana-${e.hoy}`,
      emoji: "🗓️",
      titulo: `Planea la semana: ${partes.join(", ")}`,
      detalle: "Ábrelo en «Hoy» → «Planear la semana»",
      nivel: "pronto",
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

/**
 * El recordatorio de la noche (D-139): lo que hay que dejar preparado hoy (la mochila) y las
 * citas de mañana. Vacío si no hay nada: entonces no se manda.
 */
export function avisosDeLaNoche(e: EntradaAvisos): Aviso[] {
  const manana = sumarDias(e.hoy, 1);
  const delDia = avisosDeHoy(e).filter(
    (a) =>
      a.id.startsWith("mochila-") ||
      a.id.startsWith("cole-") ||
      (a.id.startsWith("cita-") && a.nivel === "pronto"),
  );
  // Lo de la mochila primero; luego el tiempo de mañana (D-145), que también se deja preparado.
  const mochila = delDia.filter((a) => a.id.startsWith("mochila-"));
  const resto = delDia.filter((a) => !a.id.startsWith("mochila-"));
  return [
    ...mochila,
    ...avisosDelTiempo(e.tiempo, manana, "Mañana", hayColeEse(e, manana)),
    ...resto,
  ];
}

export function notificacionDeLaNoche(avisos: readonly Aviso[]) {
  const mochila = avisos.filter((a) => a.id.startsWith("mochila-"));
  return {
    titulo: mochila.length > 0 ? "🎒 Antes de dormir" : "Para mañana",
    cuerpo: avisos
      .slice(0, 4)
      .map((a) => `${a.emoji} ${a.titulo}`)
      .join("\n")
      .slice(0, 240),
  };
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
    mochila: (p.mochila ?? []).map((c) => ({
      texto: c.texto,
      persona: p.personas.find((x) => x.id === c.personaId)?.nombre ?? "",
      dias: c.dias,
      fecha: c.fecha ?? null,
      antes: c.antes,
      soloConCole: c.soloConCole !== false,
    })),
    diasConCena: [...new Set(p.cenas.map((c) => c.fecha))],
    diasCole: p.diasCole ?? [],
    conCole:
      (p.mochila ?? []).length > 0 || (p.cole ?? []).length > 0 || (p.diasCole ?? []).length > 0,
  };
}

/** `AVISOS_CORREO` admite varias direcciones separadas por comas o espacios. */
export function direccionesDeAvisos(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(/[\s,;]+/)
    .filter((d) => /^[^\s@]+@[^\s@]+$/.test(d))
    .slice(0, 10);
}
