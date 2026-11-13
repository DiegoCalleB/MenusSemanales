import { consultaCole, diaDeCole } from "@/dominio/calendario-escolar";
import type { FechaIso } from "@/dominio/fechas";
import type { EstadoHogar } from "./estado";

/** «¿Hay cole este día?» con lo que ha apuntado la familia (D-144). */
export const hayColeDe = (e: EstadoHogar) => consultaCole(e.diasCole);

/** Por qué no hay cole ese día entre semana (festivo, vacaciones…), o `null` si hay cole o es fin de semana. */
export function sinColeEntreSemana(e: EstadoHogar, f: FechaIso): string | null {
  const d = diaDeCole(f, e.diasCole);
  return d.hay || d.origen === "fin-de-semana" ? null : d.motivo;
}
