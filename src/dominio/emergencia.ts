import { stockUtilizable, proximosACaducar } from "./despensa";
import type { FechaIso } from "./fechas";
import { type MenuCole, type PlatoMenu, recomendadosParaCenar } from "./menu";
import { redondear } from "./numeros";
import type { ItemDespensa } from "./tipos";

/**
 * Cena de emergencia (D-033): «hoy llego tarde y no he planificado nada». Propone platos muy
 * rápidos que se puedan hacer YA con lo que hay en casa, o a los que les falte muy poco, para no
 * acabar comiendo cualquier cosa de la nevera. Es determinista como el resto del motor (D-041).
 */

export interface Faltante {
  ingredienteId: string;
  /** Cantidad que falta, en la unidad del ingrediente. */
  falta: number;
}

export interface OpcionEmergencia {
  plato: PlatoMenu;
  /** true si con lo que hay en casa se puede cocinar ahora mismo. */
  completa: boolean;
  faltan: Faltante[];
  /** Gasta algo que caduca en los próximos 3 días. */
  usaCaducidad: boolean;
  /** Complementa lo que comieron las niñas en el cole (si se conoce). */
  encajaConCole: boolean;
}

const MAX_FALTANTES = 2;

export function cenaDeEmergencia(args: {
  catalogo: readonly PlatoMenu[];
  despensa: readonly ItemDespensa[];
  hoy: FechaIso;
  /** Raciones de adulto equivalentes de quienes cenan. */
  raciones: number;
  excluirIngredientes: readonly string[];
  cole?: MenuCole | null;
  /** Tiempo máximo (por defecto 15 minutos, el de «hoy llego tarde»). */
  minutosMax?: number;
  /** Cuántas opciones devolver (por defecto 5). */
  max?: number;
}): OpcionEmergencia[] {
  const { catalogo, despensa, hoy, raciones } = args;
  const minutosMax = args.minutosMax ?? 15;
  const excluidos = new Set(args.excluirIngredientes);
  const stock = stockUtilizable(despensa, hoy);
  const caducan = new Set(proximosACaducar(despensa, hoy, 3).map((i) => i.ingredienteId));
  const recomendados = recomendadosParaCenar(args.cole ?? null);

  const opciones: OpcionEmergencia[] = [];
  for (const plato of catalogo) {
    if (plato.minutosActivos > minutosMax) continue;
    const obligatorios = plato.ingredientes.filter((i) => !i.opcional);
    if (obligatorios.some((i) => excluidos.has(i.ingredienteId))) continue;

    const faltan: Faltante[] = [];
    for (const ing of obligatorios) {
      const necesita = ing.cantidadPorRacion * raciones;
      const falta = redondear(necesita - (stock.get(ing.ingredienteId) ?? 0));
      if (falta > 0) faltan.push({ ingredienteId: ing.ingredienteId, falta });
    }
    if (faltan.length > MAX_FALTANTES) continue;

    opciones.push({
      plato,
      completa: faltan.length === 0,
      faltan,
      usaCaducidad: obligatorios.some((i) => caducan.has(i.ingredienteId)),
      encajaConCole: recomendados === null || recomendados.has(plato.grupo),
    });
  }

  return opciones
    .sort(
      (a, b) =>
        Number(b.completa) - Number(a.completa) ||
        a.faltan.length - b.faltan.length ||
        Number(b.encajaConCole) - Number(a.encajaConCole) ||
        Number(b.usaCaducidad) - Number(a.usaCaducidad) ||
        (b.plato.valoracion ?? 0) - (a.plato.valoracion ?? 0) ||
        a.plato.minutosActivos - b.plato.minutosActivos ||
        a.plato.id.localeCompare(b.plato.id),
    )
    .slice(0, args.max ?? 5);
}
