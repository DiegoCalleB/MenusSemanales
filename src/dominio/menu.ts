import { z } from "zod";
import { proximosACaducar, stockUtilizable } from "./despensa";
import { type FechaIso, diasEntre, sumarDias } from "./fechas";
import { redondear } from "./numeros";
import { type ItemDespensa, fechaIsoSchema, platoSchema } from "./tipos";

/**
 * Motor determinista del menú (D-041). Decide qué platos se ofrecen cada día. Es el único que
 * aplica las reglas: cualquier plato que proponga la IA (borradores, D-016) pasa por aquí igual
 * que los del catálogo. No usa azar: con los mismos datos devuelve siempre lo mismo, así que se
 * puede probar con propiedades y explicar cada opción.
 *
 * Reglas duras (nunca se rompen): ingredientes excluidos (alergias, sabores raros), tiempo máximo
 * del día, no coincidir con el grupo del menú del cole, no repetir un plato ya elegido en la semana
 * y no repetir grupo con el día anterior o el siguiente ya elegidos.
 * Reglas blandas (puntúan): valoración, tiempo desde la última vez, aprovechar caducidades y lo que
 * ya hay en casa, rapidez y variedad entre las opciones.
 */

export const GRUPOS_PLATO = [
  "carne",
  "pescado",
  "legumbre",
  "huevo",
  "pasta",
  "arroz",
  "verdura",
  "otro",
] as const;
export const grupoPlatoSchema = z.enum(GRUPOS_PLATO);
export type GrupoPlato = z.infer<typeof grupoPlatoSchema>;

export const platoMenuSchema = platoSchema.extend({
  grupo: grupoPlatoSchema,
  /** Minutos de trabajo activo (sin contar horno o cocción sin vigilar), ver D-033. */
  minutosActivos: z.number().int().min(1).max(480),
  ultimaVez: fechaIsoSchema.nullable().default(null),
  /** Valoración media de la familia, de 1 a 5. */
  valoracion: z.number().min(1).max(5).nullable().default(null),
});
export type PlatoMenu = z.infer<typeof platoMenuSchema>;

export interface DiaMenu {
  fecha: FechaIso;
  /** Tiempo activo máximo de ese día (30 entre semana, 15 si «hoy llego tarde»). */
  minutosMax: number;
  /** Grupo del plato que las niñas comen en el cole ese día, si se conoce. */
  grupoCole: GrupoPlato | null;
}

export type Motivo =
  "usa_caducidad" | "usa_despensa" | "bien_valorado" | "hace_tiempo" | "novedad" | "rapido";

export interface Opcion {
  plato: PlatoMenu;
  puntuacion: number;
  motivos: Motivo[];
}

export interface ContextoMenu {
  hoy: FechaIso;
  dias: readonly DiaMenu[];
  catalogo: readonly PlatoMenu[];
  despensa: readonly ItemDespensa[];
  /** Ingredientes que nadie quiere o que no se pueden comer. */
  excluirIngredientes: readonly string[];
  /** Fecha → plato ya elegido (se respeta y condiciona a los días vecinos). */
  elegidos?: Readonly<Record<FechaIso, string>>;
  /** Opciones por día (por defecto 3). */
  opcionesPorDia?: number;
}

export interface MenuPropuesto {
  dias: Array<{ fecha: FechaIso; opciones: Opcion[] }>;
}

const DIAS_REPETICION_FUERTE = 7;
const DIAS_ANTIGUEDAD_MAX = 21;

/** ¿Cumple el plato las reglas duras de ese día? */
export function cumpleReglasDuras(
  plato: PlatoMenu,
  dia: DiaMenu,
  excluidos: ReadonlySet<string>,
  gruposVecinos: ReadonlySet<GrupoPlato>,
): boolean {
  if (plato.minutosActivos > dia.minutosMax) return false;
  if (dia.grupoCole === plato.grupo) return false;
  if (gruposVecinos.has(plato.grupo)) return false;
  return !plato.ingredientes.some((i) => !i.opcional && excluidos.has(i.ingredienteId));
}

function puntuar(
  plato: PlatoMenu,
  dia: DiaMenu,
  ctx: ContextoMenu,
  stock: Map<string, number>,
  caducan: ReadonlySet<string>,
  ofrecidos: ReadonlySet<string>,
): Opcion {
  const motivos: Motivo[] = [];
  let p = 0;

  if (plato.valoracion !== null) {
    p += (plato.valoracion - 3) * 1.5;
    if (plato.valoracion >= 4) motivos.push("bien_valorado");
  }

  if (plato.ultimaVez === null) {
    p += 1.5;
    motivos.push("novedad");
  } else {
    const desde = Math.max(0, diasEntre(plato.ultimaVez, dia.fecha));
    if (desde < DIAS_REPETICION_FUERTE) p -= 5;
    else if (desde >= 14) motivos.push("hace_tiempo");
    p += Math.min(desde / DIAS_ANTIGUEDAD_MAX, 1) * 3;
  }

  const obligatorios = plato.ingredientes.filter((i) => !i.opcional);
  if (obligatorios.length > 0) {
    const enCasa = obligatorios.filter((i) => (stock.get(i.ingredienteId) ?? 0) > 0).length;
    const fraccion = enCasa / obligatorios.length;
    p += fraccion * 2;
    if (fraccion >= 0.5) motivos.push("usa_despensa");
  }
  const aprovechan = obligatorios.filter((i) => caducan.has(i.ingredienteId)).length;
  if (aprovechan > 0) {
    p += Math.min(aprovechan, 2) * 2;
    motivos.push("usa_caducidad");
  }

  const holgura = 1 - plato.minutosActivos / dia.minutosMax;
  p += holgura;
  if (plato.minutosActivos <= 15) motivos.push("rapido");

  if (ofrecidos.has(plato.id)) p -= 3;

  return { plato, puntuacion: redondear(p, 3), motivos };
}

/** Ordena por puntuación y reparte grupos distintos antes de repetir uno (variedad en el día). */
function elegirVariadas(candidatas: Opcion[], n: number): Opcion[] {
  const ordenadas = [...candidatas].sort(
    (a, b) => b.puntuacion - a.puntuacion || a.plato.id.localeCompare(b.plato.id),
  );
  const elegidas: Opcion[] = [];
  const grupos = new Set<GrupoPlato>();
  for (const o of ordenadas) {
    if (elegidas.length >= n) break;
    if (grupos.has(o.plato.grupo)) continue;
    grupos.add(o.plato.grupo);
    elegidas.push(o);
  }
  for (const o of ordenadas) {
    if (elegidas.length >= n) break;
    if (!elegidas.includes(o)) elegidas.push(o);
  }
  return elegidas.sort(
    (a, b) => b.puntuacion - a.puntuacion || a.plato.id.localeCompare(b.plato.id),
  );
}

/**
 * Propone opciones para cada día. Los días con plato ya elegido devuelven solo ese. Si las reglas
 * duras no dejan ninguna opción, el día queda con la lista vacía (la interfaz lo dirá: no se
 * relajan las reglas en silencio).
 */
export function proponerMenu(ctx: ContextoMenu): MenuPropuesto {
  const n = ctx.opcionesPorDia ?? 3;
  const excluidos = new Set(ctx.excluirIngredientes);
  const stock = stockUtilizable(ctx.despensa, ctx.hoy);
  const caducan = new Set(proximosACaducar(ctx.despensa, ctx.hoy, 3).map((i) => i.ingredienteId));
  const porId = new Map(ctx.catalogo.map((p) => [p.id, p]));
  const elegidos = ctx.elegidos ?? {};
  const idsElegidos = new Set(Object.values(elegidos));
  const ofrecidos = new Set<string>();

  const dias = ctx.dias.map((dia) => {
    const fijo = elegidos[dia.fecha] ? porId.get(elegidos[dia.fecha] as string) : undefined;
    if (fijo) {
      return { fecha: dia.fecha, opciones: [puntuar(fijo, dia, ctx, stock, caducan, new Set())] };
    }

    const vecinos = new Set<GrupoPlato>();
    for (const f of [sumarDias(dia.fecha, -1), sumarDias(dia.fecha, 1)]) {
      const vecino = elegidos[f] ? porId.get(elegidos[f] as string) : undefined;
      if (vecino) vecinos.add(vecino.grupo);
    }

    const candidatas = ctx.catalogo
      .filter((p) => !idsElegidos.has(p.id) && cumpleReglasDuras(p, dia, excluidos, vecinos))
      .map((p) => puntuar(p, dia, ctx, stock, caducan, ofrecidos));
    const opciones = elegirVariadas(candidatas, n);
    for (const o of opciones) ofrecidos.add(o.plato.id);
    return { fecha: dia.fecha, opciones };
  });

  return { dias };
}
