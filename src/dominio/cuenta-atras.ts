import { type Cumple, diasHasta, edadQueCumple } from "./cumples";
import { type FechaIso, diasEntre } from "./fechas";

export interface CuentaAtras {
  clave: string;
  emoji: string;
  titulo: string;
  dias: number;
  /** «5 días», «mañana»… listo para mostrar. */
  texto: string;
}

export const textoDias = (dias: number): string =>
  dias === 0 ? "¡hoy!" : dias === 1 ? "mañana" : `${dias} días`;

/**
 * Cuenta atrás de lo próximo: cumpleaños y fechas señaladas del calendario, de lo más cercano a lo
 * más lejano. Es corta a propósito (D-073): solo lo que cae en las próximas semanas y unos pocos.
 * El propio día de un cumpleaños lo cubre la tarjeta de felicitación (D-070), así que se salta.
 */
export function cuentaAtras(
  cumples: readonly Cumple[],
  eventos: Record<FechaIso, { titulo: string; emoji: string }>,
  hoy: FechaIso,
  { maxDias = 30, max = 3 }: { maxDias?: number; max?: number } = {},
): CuentaAtras[] {
  const lista: CuentaAtras[] = [];
  for (const c of cumples) {
    const dias = diasHasta(c, hoy);
    if (dias === 0 || dias > maxDias) continue;
    const edad = edadQueCumple(c, hoy);
    lista.push({
      clave: `cumple-${c.id}`,
      emoji: "🎂",
      titulo: `${c.nombre}${edad !== null ? ` (${edad})` : ""}`,
      dias,
      texto: textoDias(dias),
    });
  }
  for (const [fecha, ev] of Object.entries(eventos)) {
    const dias = diasEntre(hoy, fecha);
    if (dias < 0 || dias > maxDias) continue;
    lista.push({
      clave: `evento-${fecha}`,
      emoji: ev.emoji,
      titulo: ev.titulo,
      dias,
      texto: textoDias(dias),
    });
  }
  return lista
    .sort((a, b) => a.dias - b.dias || a.titulo.localeCompare(b.titulo, "es"))
    .slice(0, max);
}
