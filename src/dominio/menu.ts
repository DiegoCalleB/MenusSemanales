import { z } from "zod";
import { proximosACaducar, stockUtilizable } from "./despensa";
import { contarSemana, estadoDelGrupo } from "./equilibrio";
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
 * del día, complementar el menú del cole según su recomendador de cenas (ver `recomendadosParaCenar`), no repetir un plato elegido en los 7 días cercanos
 * y no repetir grupo con el día anterior o el siguiente ya elegidos. Un plato ya elegido no vuelve a
 * ofrecerse hasta pasados 7 días, así que se puede planificar una quincena sin agotar el catálogo.
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
  /** Receta, en pasos cortos (opcional). */
  pasos: z.string().max(4000).nullable().optional(),
  /** La familia no quiere que se proponga (pero se conserva en el catálogo). */
  noProponer: z.boolean().optional(),
  /** Ingredientes y tiempos estimados al importarlo: la familia debe revisarlos. */
  porRevisar: z.boolean().optional(),
});
export type PlatoMenu = z.infer<typeof platoMenuSchema>;

/** Qué han comido las niñas en el cole ese día (primer y segundo plato), si se conoce. */
export interface MenuCole {
  primero: GrupoPlato | null;
  segundo: GrupoPlato | null;
  /** Nombres de los platos tal como los publica el cole (para mostrarlos). */
  textoPrimero?: string | null;
  textoSegundo?: string | null;
  postre?: string | null;
  /** Guarnición o ensalada que acompaña al segundo. */
  guarnicion?: string | null;
  kcal?: number | null;
}

/**
 * Recomendador de cenas del cole (documento «Recomendador de cenas»): qué conviene cenar según lo
 * que se comió. Se guarda como tabla para que sea fácil de revisar frente al documento original.
 */
const RECOMENDADO_TRAS_PRIMERO: Partial<Record<GrupoPlato, readonly GrupoPlato[]>> = {
  verdura: ["pasta", "arroz"],
  pasta: ["verdura"],
  arroz: ["verdura"],
  legumbre: ["verdura", "pasta", "arroz"],
};
const RECOMENDADO_TRAS_SEGUNDO: Partial<Record<GrupoPlato, readonly GrupoPlato[]>> = {
  huevo: ["carne", "pescado"],
  pescado: ["huevo", "carne"],
  legumbre: ["verdura", "huevo"],
  carne: ["huevo", "pescado"],
};

/** Qué recomienda el cole cenar tras cada plato (por separado), para poder explicarlo. */
export function recomendacionesPorPlato(cole: MenuCole | null): {
  trasPrimero: readonly GrupoPlato[];
  trasSegundo: readonly GrupoPlato[];
} {
  return {
    trasPrimero: (cole?.primero && RECOMENDADO_TRAS_PRIMERO[cole.primero]) || [],
    trasSegundo: (cole?.segundo && RECOMENDADO_TRAS_SEGUNDO[cole.segundo]) || [],
  };
}

/**
 * Grupos que complementan lo que se comió en el cole, o `null` si no se sabe (no hay restricción).
 * Un plato vale si lo recomienda el primero o el segundo del cole; así no se repite la verdura o la
 * carne del mediodía por la noche.
 */
export function recomendadosParaCenar(cole: MenuCole | null): ReadonlySet<GrupoPlato> | null {
  if (!cole) return null;
  const reglas = [
    cole.primero ? RECOMENDADO_TRAS_PRIMERO[cole.primero] : undefined,
    cole.segundo ? RECOMENDADO_TRAS_SEGUNDO[cole.segundo] : undefined,
  ].filter((r): r is readonly GrupoPlato[] => r !== undefined);
  return reglas.length === 0 ? null : new Set(reglas.flat());
}

export interface DiaMenu {
  fecha: FechaIso;
  /** Tiempo activo máximo de ese día (30 entre semana, 15 si «hoy llego tarde»). */
  minutosMax: number;
  /** Menú del cole de ese día (las niñas comen allí de lunes a viernes). */
  cole: MenuCole | null;
}

export type Motivo =
  | "usa_caducidad"
  | "usa_despensa"
  | "bien_valorado"
  | "hace_tiempo"
  | "novedad"
  | "falta_en_semana"
  | "rapido";

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
  /** Menú del cole de todos los días (para el equilibrio de la semana, también los pasados). */
  colegio?: Readonly<Record<FechaIso, MenuCole>>;
  /** Fecha → plato ya elegido (se respeta y condiciona a los días vecinos). */
  elegidos?: Readonly<Record<FechaIso, string>>;
  /** Opciones por día (por defecto 3). */
  opcionesPorDia?: number;
}

export interface MenuPropuesto {
  dias: Array<{ fecha: FechaIso; opciones: Opcion[] }>;
}

const DIAS_REPETICION_FUERTE = 7;
/** Un plato elegido no se vuelve a ofrecer a menos de esta distancia (en días). */
const DISTANCIA_MINIMA_REPETIR = 7;
const DIAS_ANTIGUEDAD_MAX = 21;

/** ¿Cumple el plato las reglas duras de ese día? */
export function cumpleReglasDuras(
  plato: PlatoMenu,
  dia: DiaMenu,
  excluidos: ReadonlySet<string>,
  gruposVecinos: ReadonlySet<GrupoPlato>,
): boolean {
  if (plato.minutosActivos > dia.minutosMax) return false;
  const recomendados = recomendadosParaCenar(dia.cole);
  if (recomendados && !recomendados.has(plato.grupo)) return false;
  if (gruposVecinos.has(plato.grupo)) return false;
  return !plato.ingredientes.some((i) => !i.opcional && excluidos.has(i.ingredienteId));
}

/**
 * Desempate determinista (0 a 0,1): con las mismas notas, el orden alfabético de los identificadores
 * no debe decidir el menú. Depende del plato y del día, así que cada día desempata distinto, pero
 * mismos datos → mismo resultado.
 */
function desempate(platoId: string, fecha: string): number {
  let h = 2166136261;
  for (const c of `${platoId}|${fecha}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 10000;
}

function puntuar(
  plato: PlatoMenu,
  dia: DiaMenu,
  ctx: ContextoMenu,
  stock: Map<string, number>,
  caducan: ReadonlySet<string>,
  ofrecidos: ReadonlySet<string>,
  semana: Readonly<Partial<Record<GrupoPlato, number>>>,
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

  // Equilibrio de la semana (cole + cenas): sube lo que falta, baja lo que ya se ha pasado.
  const eq = estadoDelGrupo(plato.grupo, semana);
  if (eq?.estado === "falta") {
    p += 1.5;
    motivos.push("falta_en_semana");
  } else if (eq?.estado === "completo") {
    p -= 2.5;
  }

  if (ofrecidos.has(plato.id)) p -= 3;
  p += desempate(plato.id, dia.fecha);

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
  const elegidosLista = Object.entries(elegidos);
  const ofrecidos = new Set<string>();
  const colegio: Record<FechaIso, MenuCole> =
    ctx.colegio ?? Object.fromEntries(ctx.dias.flatMap((d) => (d.cole ? [[d.fecha, d.cole]] : [])));
  const cenasPorGrupo: Record<FechaIso, GrupoPlato> = {};
  for (const [f, id] of elegidosLista) {
    const g = porId.get(id)?.grupo;
    if (g) cenasPorGrupo[f] = g;
  }

  const dias = ctx.dias.map((dia) => {
    const semana = contarSemana(dia.fecha, colegio, cenasPorGrupo);
    const fijo = elegidos[dia.fecha] ? porId.get(elegidos[dia.fecha] as string) : undefined;
    if (fijo) {
      return {
        fecha: dia.fecha,
        opciones: [puntuar(fijo, dia, ctx, stock, caducan, new Set(), semana)],
      };
    }

    const vecinos = new Set<GrupoPlato>();
    for (const f of [sumarDias(dia.fecha, -1), sumarDias(dia.fecha, 1)]) {
      const vecino = elegidos[f] ? porId.get(elegidos[f] as string) : undefined;
      if (vecino) vecinos.add(vecino.grupo);
    }

    const candidatas = ctx.catalogo
      .filter(
        (p) =>
          !elegidosLista.some(
            ([f, id]) =>
              id === p.id && Math.abs(diasEntre(f, dia.fecha)) < DISTANCIA_MINIMA_REPETIR,
          ) && cumpleReglasDuras(p, dia, excluidos, vecinos),
      )
      .map((p) => puntuar(p, dia, ctx, stock, caducan, ofrecidos, semana));
    const opciones = elegirVariadas(candidatas, n);
    for (const o of opciones) ofrecidos.add(o.plato.id);
    return { fecha: dia.fecha, opciones };
  });

  return { dias };
}
