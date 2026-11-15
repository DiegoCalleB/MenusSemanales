import { consultaCole, diaDeCole } from "@/dominio/calendario-escolar";
import type { FechaIso } from "@/dominio/fechas";
import type { GrupoPlato } from "@/dominio/menu";
import { NOMBRE_GRUPO_ES } from "@/dominio/texto";
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

/** Lo que se cuenta como «repetir» con el comedor: lo principal del día, no la verdura o el arroz. */
const REPETIBLES: ReadonlySet<GrupoPlato> = new Set<GrupoPlato>([
  "pescado",
  "carne",
  "legumbre",
  "huevo",
]);

/**
 * La cena de ese día repite lo del comedor (D-155): el mismo pescado, carne, legumbre o huevo que
 * el primero o el segundo del cole. Las propuestas ya lo evitan; esto avisa de lo elegido a mano.
 */
export function repiteConElCole(
  e: EstadoHogar,
  f: FechaIso,
): { plato: string; grupo: string } | null {
  const cole = e.colegio[f];
  if (!cole || cole.origen === "casa") return null;
  const delCole = new Set([cole.primero, cole.segundo]);
  for (const c of e.comidas.filter((x) => x.fecha === f)) {
    const g = (c.plato as { grupo?: GrupoPlato }).grupo;
    if (g && REPETIBLES.has(g) && delCole.has(g)) {
      return { plato: c.plato.nombre, grupo: NOMBRE_GRUPO_ES[g] ?? g };
    }
  }
  return null;
}
