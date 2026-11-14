import { consultaCole, diaDeCole } from "@/dominio/calendario-escolar";
import type { FechaIso } from "@/dominio/fechas";
import type { EstadoHogar } from "./estado";

/** «¿Hay cole este día?» con lo que ha apuntado la familia (D-144). */
export const hayColeDe = (e: EstadoHogar) => consultaCole(e.diasCole);

/** ¿El hogar tiene algo del cole (mochila, menú, días apuntados)? Si no, no se habla del cole. */
export const tieneCole = (e: EstadoHogar) =>
  e.mochila.length > 0 || Object.keys(e.colegio).length > 0 || e.diasCole.length > 0;

/** Por qué no hay cole ese día entre semana (festivo, vacaciones…), o `null` si hay cole o es fin de semana. */
export function sinColeEntreSemana(e: EstadoHogar, f: FechaIso): string | null {
  const d = diaDeCole(f, e.diasCole);
  return d.hay || d.origen === "fin-de-semana" ? null : d.motivo;
}
