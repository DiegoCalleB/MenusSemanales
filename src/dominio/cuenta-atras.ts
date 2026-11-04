import { type Cumple, diasHasta, edadQueCumple, proximaFecha } from "./cumples";
import { type FechaIso, diasEntre } from "./fechas";
import type { EventoExterno } from "./ics";

export interface CuentaAtras {
  clave: string;
  fecha: FechaIso;
  hasta: FechaIso | null;
  hora: string | null;
  /** Se repite cada año (cumpleaños). */
  anual: boolean;
  emoji: string;
  titulo: string;
  dias: number;
  /** «5 días», «mañana»… listo para mostrar. */
  texto: string;
}

export const textoDias = (dias: number): string =>
  dias === 0 ? "¡hoy!" : dias === 1 ? "mañana" : `${dias} días`;

/** ¿Es el cumpleaños de alguien que ya tenemos? Google suele traer los mismos y no deben salir dos veces. */
export function esCumpleRepetido(titulo: string, cumples: readonly Cumple[]): boolean {
  const t = titulo.toLowerCase();
  return t.includes("cumple") && cumples.some((c) => t.includes(c.nombre.toLowerCase()));
}

/**
 * Cuenta atrás de lo próximo: cumpleaños y fechas señaladas del calendario, de lo más cercano a lo
 * más lejano. Es corta a propósito (D-073): solo lo que cae en las próximas semanas y unos pocos.
 * El propio día de un cumpleaños lo cubre la tarjeta de felicitación (D-070), así que se salta.
 */
export function cuentaAtras(
  cumples: readonly Cumple[],
  eventos: Record<FechaIso, { titulo: string; emoji: string }>,
  hoy: FechaIso,
  {
    maxDias = 30,
    max = 3,
    externos = [],
  }: { maxDias?: number; max?: number; externos?: readonly EventoExterno[] } = {},
): CuentaAtras[] {
  const lista: CuentaAtras[] = [];
  for (const c of cumples) {
    const dias = diasHasta(c, hoy);
    if (dias === 0 || dias > maxDias) continue;
    const edad = edadQueCumple(c, hoy);
    lista.push({
      clave: `cumple-${c.id}`,
      fecha: proximaFecha(c, hoy),
      hasta: null,
      hora: null,
      anual: true,
      emoji: "🎂",
      titulo: `${c.nombre}${edad !== null ? ` (${edad})` : ""}`,
      dias,
      texto: textoDias(dias),
    });
  }
  for (const [fecha, ev] of Object.entries(eventos)) {
    const dias = diasEntre(hoy, fecha);
    if (dias < 0 || dias > maxDias) continue;
    if (esCumpleRepetido(ev.titulo, cumples)) continue;
    lista.push({
      clave: `evento-${fecha}`,
      fecha,
      hasta: null,
      hora: null,
      anual: false,
      emoji: ev.emoji,
      titulo: ev.titulo,
      dias,
      texto: textoDias(dias),
    });
  }
  // Los de Google Calendar. Un cumpleaños que ya tenemos nosotros no se repite.
  for (const ev of externos) {
    const dias = diasEntre(hoy, ev.fecha);
    if (dias < 0 || dias > maxDias) continue;
    if (esCumpleRepetido(ev.titulo, cumples)) continue;
    lista.push({
      clave: `google-${ev.fecha}-${ev.titulo}`,
      fecha: ev.fecha,
      hasta: ev.hasta ?? null,
      hora: ev.hora,
      anual: false,
      emoji: "📅",
      titulo: ev.titulo,
      dias,
      texto: textoDias(dias),
    });
  }
  return lista
    .sort((a, b) => a.dias - b.dias || a.titulo.localeCompare(b.titulo, "es"))
    .slice(0, max);
}
