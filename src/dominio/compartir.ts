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
  evento: { emoji: string; titulo: string } | null;
}

const MAX_WHATSAPP = 3800; // WhatsApp admite más, pero los enlaces largos fallan en algunos móviles

/** Mensaje del menú para WhatsApp. */
export function textoMenu(titulo: string, dias: readonly DiaParaCompartir[]): string {
  const lineas: string[] = [`🍽️ *${titulo}*`, ""];
  for (const d of dias) {
    lineas.push(`*${d.etiqueta}*${d.cole ? `  🎒 ${d.cole}` : ""}`);
    if (d.evento) lineas.push(`${d.evento.emoji} ${d.evento.titulo}`);
    lineas.push(d.platos.length > 0 ? `🍴 ${d.platos.join(" + ")}` : "🍴 _sin decidir_");
    lineas.push("");
  }
  lineas.push("_Hecho con Menús Semanales_");
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
export function generarIcs(
  nombre: string,
  eventos: readonly EventoCalendario[],
  ahora: Date,
): string {
  const sello = ahora
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lineas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Menus Semanales//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escaparIcs(nombre)}`,
  ];
  eventos.forEach((e, i) => {
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${sinGuiones(e.fecha)}-${i}@menus-semanales`,
      `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${sinGuiones(e.fecha)}`,
      `DTEND;VALUE=DATE:${sinGuiones(sumarDias(e.fecha, 1))}`,
      `SUMMARY:${escaparIcs(e.titulo)}`,
      `DESCRIPTION:${escaparIcs(e.descripcion)}`,
      "END:VEVENT",
    );
  });
  lineas.push("END:VCALENDAR");
  return `${lineas.flatMap(plegar).join("\r\n")}\r\n`;
}
