import { fechaEnAnio } from "./cumples";
import { type FechaIso, sumarDias } from "./fechas";

/**
 * Apuntes de agenda escritos como en una nota del móvil («17 Marzo Excursión Alba», «1 Junio 8:00
 * Midas», «17-19 Abril Familias de Puente», «12/3 dentista»). Lo que no lleva fecha se queda como
 * tarea. Sirve igual para escribir uno a uno que para pegar la nota entera de Keep (D-075).
 */

export interface Apunte {
  id: string;
  fecha: FechaIso;
  /** Último día, si dura varios (17-19 Abril). */
  hasta: FechaIso | null;
  /** «18:15», o null si no hay hora. */
  hora: string | null;
  titulo: string;
}

export interface ApunteLeido {
  fecha: FechaIso;
  hasta: FechaIso | null;
  hora: string | null;
  titulo: string;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = [
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
const MAX_TITULO = 120;

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Mes (1-12) de una palabra, con tolerancia a erratas («Septimembre», «sept»). 0 si no es un mes. */
function mesDe(palabra: string): number {
  const p = sinAcentos(palabra).replace(/\.$/, "");
  if (p.length < 3) return 0;
  const i = p === "set" ? 8 : MESES.indexOf(p.slice(0, 3));
  if (i < 0) return 0;
  const largo = MESES_LARGOS[i] ?? "";
  return p.length <= largo.length + 2 ? i + 1 : 0;
}

const hora = (h: string | undefined, m: string | undefined): string | null | "mala" => {
  if (h === undefined || m === undefined) return null;
  return Number(h) < 24 && Number(m) < 60 ? `${h.padStart(2, "0")}:${m}` : "mala";
};

/**
 * Una hora escrita AL FINAL del título («circo del sol 18:00», «cena 21h30», «cita a las 18»), que
 * la persona no ha puesto donde debe y deja el evento sin hora (D-134). Devuelve el título sin ella
 * y la hora, o el título tal cual y `null` si no hay ninguna clara. Solo vale con «:» o «h» entre
 * hora y minutos («18:00», «18h30») o con «a las» delante («a las 18», «a las 18.30»): un «12.50»
 * suelto puede ser un precio y un «8h» suelto, una duración.
 */
export function separarHoraDelTitulo(titulo: string): { titulo: string; hora: string | null } {
  const limpio = titulo.replace(/\s+/g, " ").trim();
  const m =
    /^(.*?)[\s,;:–-]*(?:\ba las (\d{1,2})(?:[:.h](\d{2}))?|\b(\d{1,2})[:h](\d{2}))\s*(?:h|hs|horas)?\s*$/iu.exec(
      limpio,
    );
  if (!m) return { titulo: limpio, hora: null };
  const leida = hora(m[2] ?? m[4], m[3] ?? m[5] ?? "00");
  const sin = (m[1] ?? "").trim();
  if (leida === "mala" || leida === null || sin === "" || sin.length > MAX_TITULO) {
    return { titulo: limpio, hora: null };
  }
  return { titulo: sin, hora: leida };
}

const diasDelMes = (mes: number, anio: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** Próxima vez que cae ese día y mes desde hoy (hoy incluido). */
function proxima(dia: number, mes: number, hoy: FechaIso): FechaIso {
  const a = Number(hoy.slice(0, 4));
  const este = fechaEnAnio(a, mes, dia);
  return este >= hoy ? este : fechaEnAnio(a + 1, mes, dia);
}

export interface AgendaLeida {
  conFecha: ApunteLeido[];
  sinFecha: string[];
  erroneos: string[];
}

/** Lee varias líneas (una por apunte, o separadas por «;»). Ignora las casillas «[X]» de Keep. */
export function parsearAgenda(texto: string, hoy: FechaIso): AgendaLeida {
  const salida: AgendaLeida = { conFecha: [], sinFecha: [], erroneos: [] };
  for (const cruda of texto.split(/[\n;]/)) {
    const linea = cruda
      .replace(/^\s*(?:[-*•]\s*)?(?:\[[ xX]?\]\s*)?/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (linea === "" || linea === "[ ]" || /^\[[ xX]?\]$/.test(linea)) continue;

    // «17 Marzo …», «17-19 Abril …», «17 de marzo de 2027 …»
    const largo =
      /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s+(?:de\s+)?([\p{L}.]+)(?:\s+(?:de\s+)?(\d{4}))?\s*(.*)$/u.exec(
        linea,
      );
    // «12/3 …», «12/03/2027 …»
    const corto = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?\s+(.*)$/.exec(linea);

    let dia = 0;
    let hasta = 0;
    let mes = 0;
    let anio: number | null = null;
    let resto = "";
    if (largo && mesDe(largo[3] ?? "") > 0) {
      dia = Number(largo[1]);
      hasta = largo[2] ? Number(largo[2]) : 0;
      mes = mesDe(largo[3] ?? "");
      anio = largo[4] ? Number(largo[4]) : null;
      resto = largo[5] ?? "";
    } else if (corto) {
      dia = Number(corto[1]);
      mes = Number(corto[2]);
      if (corto[3]) anio = corto[3].length === 2 ? 2000 + Number(corto[3]) : Number(corto[3]);
      resto = corto[4] ?? "";
    } else {
      // Sin fecha: es una tarea («Veterinario Punky»). Un número suelto al principio no es fecha.
      if (linea.length > MAX_TITULO) salida.erroneos.push(linea);
      else salida.sinFecha.push(linea);
      continue;
    }

    const h = /^(\d{1,2})[:.h](\d{2})\b\s*(.*)$/.exec(resto);
    let horaLeida = hora(h?.[1], h?.[2]);
    let titulo = (h ? (h[3] ?? "") : resto).trim();
    // Sin hora al principio, se busca al final: «13 noviembre circo del sol 18:00».
    if (!h) {
      const alFinal = separarHoraDelTitulo(titulo);
      if (alFinal.hora) {
        titulo = alFinal.titulo;
        horaLeida = alFinal.hora;
      }
    }
    const anioReal = anio ?? Number(hoy.slice(0, 4));
    const valido =
      horaLeida !== "mala" &&
      titulo !== "" &&
      titulo.length <= MAX_TITULO &&
      mes >= 1 &&
      mes <= 12 &&
      dia >= 1 &&
      dia <= (mes === 2 ? 29 : diasDelMes(mes, anioReal)) &&
      (hasta === 0 || (hasta > dia && hasta <= diasDelMes(mes, anioReal)));
    if (!valido) {
      salida.erroneos.push(linea);
      continue;
    }
    const fecha = anio ? fechaEnAnio(anio, mes, dia) : proxima(dia, mes, hoy);
    const ultimo = hasta > 0 ? sumarDias(fecha, hasta - dia) : null;
    salida.conFecha.push({ fecha, hasta: ultimo, hora: horaLeida, titulo });
  }
  return salida;
}

/** «Entre el 17 y el 19», «18:15»… para enseñar un apunte en una línea. */
export function resumenApunte(a: Pick<Apunte, "hasta" | "hora" | "titulo" | "fecha">): string {
  const hasta = a.hasta ? ` (hasta el ${Number(a.hasta.slice(8))})` : "";
  return `${a.titulo}${a.hora ? ` · ${a.hora}` : ""}${hasta}`;
}

const NOMBRE_MES = (m: number) => MESES_LARGOS[m - 1] ?? "";
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Los apuntes como una nota de Keep, uno por línea y con la misma forma que se escribe («17 Marzo
 * 8:00 Midas»), de modo que lo copiado se puede volver a pegar en la app. Solo lleva el año cuando
 * la fecha no es la próxima vez que cae ese día.
 */
export function textoParaKeep(apuntes: readonly ApunteLeido[], hoy: FechaIso): string {
  return [...apuntes]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? ""))
    .map((a) => {
      const [, m, d] = a.fecha.split("-").map(Number) as [number, number, number];
      const dias = a.hasta ? `${d}-${Number(a.hasta.slice(8))}` : String(d);
      const anio = proxima(d, m, hoy) === a.fecha ? "" : ` ${a.fecha.slice(0, 4)}`;
      return `${dias} ${mayus(NOMBRE_MES(m))}${anio}${a.hora ? ` ${a.hora}` : ""} ${a.titulo}`;
    })
    .join("\n");
}

const compacta = (f: FechaIso) => f.replace(/-/g, "");

/** Enlace que abre Google Calendar con el evento ya rellenado (solo falta pulsar «Guardar»). */
export function enlaceGoogleCalendar(e: {
  fecha: FechaIso;
  hasta?: FechaIso | null;
  hora?: string | null;
  titulo: string;
  anual?: boolean;
}): string {
  let fechas: string;
  if (e.hora) {
    const [h = 0, m = 0] = e.hora.split(":").map(Number);
    const fin = h >= 23 ? "2359" : `${String(h + 1).padStart(2, "0")}${String(m).padStart(2, "0")}`;
    fechas = `${compacta(e.fecha)}T${e.hora.replace(":", "")}00/${compacta(e.fecha)}T${fin}00`;
  } else {
    fechas = `${compacta(e.fecha)}/${compacta(sumarDias(e.hasta ?? e.fecha, 1))}`;
  }
  const q = new URLSearchParams({ action: "TEMPLATE", text: e.titulo, dates: fechas });
  if (e.hora) q.set("ctz", "Europe/Madrid");
  if (e.anual) q.set("recur", "RRULE:FREQ=YEARLY");
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
