import type { FechaIso } from "./fechas";
import { sumarDias } from "./fechas";

/**
 * Textos y archivos para sacar el plan de la app: un mensaje de WhatsApp bonito, una lista que se
 * pega en Google Keep y un archivo de calendario (.ics) que importa Google Calendar. Son funciones
 * puras: reciben datos ya preparados y devuelven texto. Formato de WhatsApp: *negrita*, _cursiva_.
 */

export interface DiaParaCompartir {
  fecha: FechaIso;
  /** «Martes 3». */
  etiqueta: string;
  /** Emojis de lo que han comido las niñas, p. ej. «🫘 🍳». Vacío si no hay cole. */
  cole: string;
  /** Platos de la cena (vacío si aún no hay). */
  platos: readonly string[];
  /** Lo apuntado para la comida del mediodía (vacío si no se piensa ese día). */
  comida?: readonly string[];
  evento: { emoji: string; titulo: string } | null;
  /** Nota de la cena: «o igual lomo, depende». */
  nota?: string;
  /** Lo que han comido las niñas en el cole, con las palabras del menú del cole. */
  coleTexto?: string;
  /** Por qué se propone esa cena: «Como en el cole comen legumbres y pescado, propongo…». */
  porque?: string;
}

const MAX_WHATSAPP = 3800; // WhatsApp admite más, pero los enlaces largos fallan en algunos móviles

export type FormatoMenu = "agenda" | "tabla" | "completo";

/** Cómo se enseña cada formato en la pantalla de enviar. */
export const FORMATOS_MENU: ReadonlyArray<{ id: FormatoMenu; nombre: string; ayuda: string }> = [
  { id: "agenda", nombre: "Agenda", ayuda: "Dos líneas por día: cole y cena" },
  { id: "tabla", nombre: "Tabla", ayuda: "Una línea por día, lo mínimo" },
  { id: "completo", nombre: "Completo", ayuda: "Con el porqué de cada cena" },
];

const MAX_PLATO_CORTO = 44;

/**
 * Acorta lo que dice el menú del cole para un mensaje: sin lo que va entre paréntesis, sin
 * «ecológicas» y, si es largo, hasta el primer «con». «Guiso de lentejas ecológicas con zanahoria,
 * pimiento y cebolla» → «Guiso de lentejas».
 */
export function acortarPlatoCole(texto: string): string {
  return texto
    .split(" + ")
    .map((parte) => {
      let t = parte
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/\s+ecol[oó]gic[oa]s?\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      const con = t.indexOf(" con ");
      if (t.length > 32 && con > 8) t = t.slice(0, con);
      const coma = t.indexOf(",");
      if (t.length > MAX_PLATO_CORTO && coma > 8) t = t.slice(0, coma);
      return t.length > MAX_PLATO_CORTO ? `${t.slice(0, MAX_PLATO_CORTO - 1).trimEnd()}…` : t;
    })
    .join(" + ");
}

/** Mensaje del menú para WhatsApp, en uno de los tres formatos (por defecto el completo de siempre). */
export function textoMenu(
  titulo: string,
  dias: readonly DiaParaCompartir[],
  formato: FormatoMenu = "completo",
): string {
  if (formato === "agenda") return textoMenuAgenda(titulo, dias);
  if (formato === "tabla") return textoMenuTabla(titulo, dias);
  return textoMenuCompleto(titulo, dias);
}

function textoMenuCompleto(titulo: string, dias: readonly DiaParaCompartir[]): string {
  const lineas: string[] = [`🍽️ *${titulo}*`, ""];
  for (const d of dias) {
    // Con el texto del menú del cole va en su propia línea; si no, los emojis junto al día.
    lineas.push(`*${d.etiqueta}*${d.cole && !d.coleTexto ? `  🎒 ${d.cole}` : ""}`);
    if (d.coleTexto) lineas.push(`🎒 Cole: ${d.coleTexto}`);
    if (d.evento) lineas.push(`${d.evento.emoji} ${d.evento.titulo}`);
    if (d.comida && d.comida.length > 0) lineas.push(`☀️ Comida: ${d.comida.join(" + ")}`);
    const hayComida = !!d.comida && d.comida.length > 0;
    lineas.push(
      d.platos.length > 0
        ? `🍴 ${hayComida ? "Cena: " : ""}${d.platos.join(" + ")}`
        : `🍴 _${hayComida ? "cena " : ""}sin decidir_`,
    );
    if (d.porque && d.platos.length > 0) lineas.push(`💡 ${d.porque}`);
    if (d.nota) lineas.push(`📝 ${d.nota}`);
    lineas.push("");
  }
  lineas.push("_Enviado desde ¡Hecho!_");
  return recortar(lineas.join("\n"));
}

/** Agenda: cada día en pocas líneas, con el cole resumido y sin explicaciones. */
function textoMenuAgenda(titulo: string, dias: readonly DiaParaCompartir[]): string {
  const lineas: string[] = [`🍽️ *${titulo}*`, ""];
  for (const d of dias) {
    lineas.push(`*${d.etiqueta}*`);
    if (d.evento) lineas.push(`${d.evento.emoji} ${d.evento.titulo}`);
    if (d.coleTexto) lineas.push(`🎒 ${acortarPlatoCole(d.coleTexto)}`);
    else if (d.cole) lineas.push(`🎒 ${d.cole}`);
    if (d.comida && d.comida.length > 0) lineas.push(`☀️ ${d.comida.join(" + ")}`);
    lineas.push(d.platos.length > 0 ? `🍴 ${d.platos.join(" + ")}` : "🍴 _sin decidir_");
    if (d.nota) lineas.push(`📝 ${d.nota}`);
    lineas.push("");
  }
  lineas.push("_Enviado desde ¡Hecho!_");
  return recortar(lineas.join("\n"));
}

/** Tabla: una línea por día, «Día | cole | cena». Lo más corto para un mensaje. */
function textoMenuTabla(titulo: string, dias: readonly DiaParaCompartir[]): string {
  const lineas: string[] = [`🍽️ *${titulo}*`, "", "_Día | 🎒 Cole | 🍴 Cena_", ""];
  for (const d of dias) {
    const cole = d.cole || (d.coleTexto ? "🎒" : "—");
    const cena = d.platos.length > 0 ? d.platos.join(" + ") : "_sin decidir_";
    const extra = [
      d.evento ? `${d.evento.emoji} ${d.evento.titulo}` : "",
      d.comida && d.comida.length > 0 ? `☀️ ${d.comida.join(" + ")}` : "",
      d.nota ? `📝 ${d.nota}` : "",
    ].filter(Boolean);
    lineas.push(
      `*${d.etiqueta}* | ${cole} | ${cena}${extra.length > 0 ? ` | ${extra.join(" · ")}` : ""}`,
    );
  }
  lineas.push("", "_Enviado desde ¡Hecho!_");
  return recortar(lineas.join("\n"));
}

export interface SeccionCompra {
  nombre: string;
  emoji: string;
  /** «Tomate · 300 g». */
  lineas: readonly string[];
}

/** Lista de la compra para WhatsApp o Keep: una línea por artículo, agrupada por sección del súper. */
export function textoCompra(
  secciones: readonly SeccionCompra[],
  manuales: readonly string[],
): string {
  const lineas: string[] = ["🛒 *Lista de la compra*", ""];
  const todas: SeccionCompra[] = [
    ...secciones,
    ...(manuales.length > 0 ? [{ nombre: "Otros", emoji: "📝", lineas: manuales }] : []),
  ];
  if (todas.every((s) => s.lineas.length === 0)) lineas.push("No falta nada 🎉");
  for (const s of todas) {
    if (s.lineas.length === 0) continue;
    lineas.push(`${s.emoji} *${s.nombre}*`);
    for (const l of s.lineas) lineas.push(`☐ ${l}`);
    lineas.push("");
  }
  return recortar(lineas.join("\n").trimEnd());
}

export interface FechaParaCompartir {
  /** «Sáb 7 nov». */
  etiqueta: string;
  emoji: string;
  titulo: string;
  hora: string | null;
  /** «hoy», «mañana», «5 días». */
  cuando: string;
}

/** Próximas fechas (cumples, apuntes, eventos) para mandar a quien tenga que saberlo. */
export function textoFechas(fechas: readonly FechaParaCompartir[]): string {
  const lineas: string[] = ["📌 *Próximas fechas*", ""];
  if (fechas.length === 0) lineas.push("Nada apuntado en los próximos días.");
  for (const f of fechas) {
    lineas.push(
      `*${f.etiqueta}*${f.hora ? ` ${f.hora}` : ""} · ${f.emoji} ${f.titulo} _(${f.cuando})_`,
    );
  }
  lineas.push("", "_Enviado desde ¡Hecho!_");
  return recortar(lineas.join("\n"));
}

export interface TareaParaCompartir {
  emoji: string;
  titulo: string;
  /** Quién la lleva: «Diego», «Los dos». */
  quien: string;
  /** «hoy», «desde hace 2 días», «en 3 días». */
  cuando: string;
}

/** Lo que toca en casa, agrupado por quién lo lleva: sin señalar, solo «esto toca y le toca a…». */
export function textoCasa(tareas: readonly TareaParaCompartir[]): string {
  const lineas: string[] = ["🏠 *Lo que toca en casa*", ""];
  if (tareas.length === 0) lineas.push("Nada pendiente 🎉");
  const quienes = [...new Set(tareas.map((t) => t.quien))];
  for (const q of quienes) {
    lineas.push(`*${q}*`);
    for (const t of tareas.filter((x) => x.quien === q)) {
      lineas.push(`☐ ${t.emoji} ${t.titulo} _(${t.cuando})_`);
    }
    lineas.push("");
  }
  lineas.push("_Enviado desde ¡Hecho!_");
  return recortar(lineas.join("\n"));
}

function recortar(texto: string): string {
  if (texto.length <= MAX_WHATSAPP) return texto;
  return `${texto.slice(0, MAX_WHATSAPP - 20).trimEnd()}\n… (recortado)`;
}

/** Enlace que abre WhatsApp con el texto escrito; quien lo pulsa elige a quién enviarlo. */
export const enlaceWhatsApp = (texto: string): string =>
  `https://wa.me/?text=${encodeURIComponent(texto)}`;

// --------------------------------------------------------------------------------------------
// Calendario (.ics, RFC 5545)
// --------------------------------------------------------------------------------------------

export interface EventoCalendario {
  fecha: FechaIso;
  titulo: string;
  descripcion: string;
  /** Se repite cada año (cumpleaños y sus avisos). */
  anual?: boolean;
  /** Con aviso en el móvil a las 9:00 del propio día (el calendario lo muestra como notificación). */
  aviso?: boolean;
  /** «18:15»: dura una hora desde entonces. Sin hora, es de todo el día. */
  hora?: string | null;
  /** Último día, si dura varios (se cuenta completo). */
  hasta?: FechaIso | null;
  /** Identificador estable: así el calendario actualiza el evento en vez de duplicarlo. */
  uid?: string;
}

const sinDosPuntos = (h: string) => `${h.replace(":", "")}00`;

/** Una hora más tarde, sin pasar de las 23:59 del mismo día. */
function unaHoraMas(h: string): string {
  const [hh = 0, mm = 0] = h.split(":").map(Number);
  return hh >= 23 ? "23:59" : `${String(hh + 1).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const escaparIcs = (t: string) =>
  t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Pliega las líneas largas a 75 bytes, sin partir caracteres de varios bytes. */
function plegar(linea: string): string[] {
  const salida: string[] = [];
  let actual = "";
  let bytes = 0;
  for (const c of linea) {
    const n = new TextEncoder().encode(c).length;
    if (bytes + n > 73) {
      salida.push(actual);
      actual = " ";
      bytes = 1;
    }
    actual += c;
    bytes += n;
  }
  salida.push(actual);
  return salida;
}

const sinGuiones = (f: FechaIso) => f.replace(/-/g, "");

/** Archivo de calendario con un evento de todo el día por cada fecha. Lo importa Google Calendar. */
/**
 * La zona horaria de las horas del calendario (D-134). Las horas se mandan con su zona y esta
 * definición (horario de invierno y de verano), no como «hora flotante» sin zona: así Google y el
 * iPhone las enseñan a la hora de Madrid en lugar de interpretarlas a su manera.
 */
const ZONA = "Europe/Madrid";
const VTIMEZONE_MADRID = [
  "BEGIN:VTIMEZONE",
  `TZID:${ZONA}`,
  "BEGIN:STANDARD",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
];

export function generarIcs(
  nombre: string,
  eventos: readonly EventoCalendario[],
  ahora: Date,
  /** Para calendarios suscritos: cada cuántas horas conviene que el móvil vuelva a pedirlo. */
  refrescoHoras?: number,
): string {
  const sello = ahora
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lineas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hecho//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escaparIcs(nombre)}`,
    `X-WR-TIMEZONE:${ZONA}`,
    ...(refrescoHoras
      ? [
          `REFRESH-INTERVAL;VALUE=DURATION:PT${refrescoHoras}H`,
          `X-PUBLISHED-TTL:PT${refrescoHoras}H`,
        ]
      : []),
  ];
  if (eventos.some((e) => e.hora)) lineas.push(...VTIMEZONE_MADRID);
  eventos.forEach((e, i) => {
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${e.uid ? escaparIcs(e.uid) : `${sinGuiones(e.fecha)}-${i}`}@menus-semanales`,
      `DTSTAMP:${sello}`,
      ...(e.hora
        ? [
            `DTSTART;TZID=${ZONA}:${sinGuiones(e.fecha)}T${sinDosPuntos(e.hora)}`,
            `DTEND;TZID=${ZONA}:${sinGuiones(e.fecha)}T${sinDosPuntos(unaHoraMas(e.hora))}`,
          ]
        : [
            `DTSTART;VALUE=DATE:${sinGuiones(e.fecha)}`,
            `DTEND;VALUE=DATE:${sinGuiones(sumarDias(e.hasta ?? e.fecha, 1))}`,
          ]),
      ...(e.anual ? ["RRULE:FREQ=YEARLY"] : []),
      `SUMMARY:${escaparIcs(e.titulo)}`,
      `DESCRIPTION:${escaparIcs(e.descripcion)}`,
      ...(e.aviso
        ? [
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            `DESCRIPTION:${escaparIcs(e.titulo)}`,
            // De todo el día, el aviso se cuenta desde las 00:00: +9 horas = 9:00. Con hora, una antes.
            e.hora ? "TRIGGER:-PT1H" : "TRIGGER:PT9H",
            "END:VALARM",
          ]
        : []),
      "END:VEVENT",
    );
  });
  lineas.push("END:VCALENDAR");
  return `${lineas.flatMap(plegar).join("\r\n")}\r\n`;
}
