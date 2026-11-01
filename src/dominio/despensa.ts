import { type FechaIso, enRango, sumarDias } from "./fechas";
import { redondear } from "./numeros";
import {
  type ItemDespensa,
  type Movimiento,
  type MovimientoAplicado,
  type Plato,
  UBICACIONES,
} from "./tipos";

/**
 * Despensa: qué descontar al cocinar y cómo deshacerlo. Funciones puras: reciben el estado y
 * devuelven datos nuevos; nunca modifican lo que reciben.
 *
 * Las mismas reglas las hace cumplir la base de datos (`aplicar_movimientos`): el stock no puede
 * quedar negativo y todo cambio es un movimiento que se puede invertir.
 */

export class StockInsuficienteError extends Error {
  constructor(
    readonly ingredienteId: string,
    readonly ubicacion: string,
  ) {
    super(`Stock insuficiente de ${ingredienteId} en ${ubicacion}`);
    this.name = "StockInsuficienteError";
  }
}

export class StockCaducadoError extends Error {
  constructor(
    readonly ingredienteId: string,
    readonly ubicacion: string,
  ) {
    super(
      `Hay stock caducado de ${ingredienteId} en ${ubicacion}: hay que tirarlo antes de añadir más`,
    );
    this.name = "StockCaducadoError";
  }
}

const ordenUbicacion = (u: string) => UBICACIONES.indexOf(u as (typeof UBICACIONES)[number]);

function caducado(item: ItemDespensa, hoy: FechaIso): boolean {
  return item.caducaEn !== null && item.caducaEn < hoy;
}

/** Stock utilizable por ingrediente: suma de todas las ubicaciones, sin lo ya caducado. */
export function stockUtilizable(
  despensa: readonly ItemDespensa[],
  hoy: FechaIso,
): Map<string, number> {
  const total = new Map<string, number>();
  for (const item of despensa) {
    if (caducado(item, hoy)) continue;
    total.set(item.ingredienteId, redondear((total.get(item.ingredienteId) ?? 0) + item.cantidad));
  }
  return total;
}

export interface PlanCocinado {
  /** Movimientos negativos a aplicar. Nunca dejan el stock por debajo de cero. */
  movimientos: Movimiento[];
  /** Lo que falta en la despensa para cocinar el plato completo. */
  faltantes: Array<{ ingredienteId: string; cantidad: number }>;
}

/**
 * Calcula qué descontar al cocinar `raciones` de un plato.
 *
 * - Los ingredientes opcionales no se descuentan.
 * - Se gasta primero lo que caduca antes y, a igualdad, lo de la nevera antes que lo del congelador.
 * - Lo caducado no se usa.
 * - Si no hay suficiente, se descuenta lo que haya y se informa de lo que falta.
 */
export function planificarCocinado(args: {
  plato: Plato;
  raciones: number;
  despensa: readonly ItemDespensa[];
  hoy: FechaIso;
}): PlanCocinado {
  const { plato, raciones, despensa, hoy } = args;
  if (!(raciones > 0)) throw new RangeError("Las raciones deben ser positivas");

  const movimientos: Movimiento[] = [];
  const faltantes: PlanCocinado["faltantes"] = [];

  for (const ing of plato.ingredientes) {
    if (ing.opcional) continue;
    let pendiente = redondear(ing.cantidadPorRacion * raciones);

    const candidatos = despensa
      .filter((i) => i.ingredienteId === ing.ingredienteId && i.cantidad > 0 && !caducado(i, hoy))
      .sort(
        (a, b) =>
          (a.caducaEn ?? "9999-12-31").localeCompare(b.caducaEn ?? "9999-12-31") ||
          ordenUbicacion(a.ubicacion) - ordenUbicacion(b.ubicacion),
      );

    for (const c of candidatos) {
      if (pendiente <= 0) break;
      const toma = Math.min(pendiente, c.cantidad);
      movimientos.push({ ingredienteId: c.ingredienteId, ubicacion: c.ubicacion, delta: -toma });
      pendiente = redondear(pendiente - toma);
    }
    if (pendiente > 0) faltantes.push({ ingredienteId: ing.ingredienteId, cantidad: pendiente });
  }
  return { movimientos, faltantes };
}

/**
 * Movimientos inversos, en orden inverso, que restauran también la caducidad que tenía cada fila:
 * aplicarlos tras los originales deja la despensa exactamente como estaba, fechas incluidas.
 * Requiere los movimientos YA APLICADOS (que recuerdan la caducidad anterior).
 */
export function invertirMovimientos(aplicados: readonly MovimientoAplicado[]): Movimiento[] {
  return [...aplicados].reverse().map((m) => ({
    ingredienteId: m.ingredienteId,
    ubicacion: m.ubicacion,
    delta: -m.delta,
    restaurarCaducidad: m.caducaAntes,
  }));
}

/** Movimientos que tiran todo el stock caducado: hay que hacerlo antes de añadir stock nuevo a esa fila. */
export function descartarCaducados(despensa: readonly ItemDespensa[], hoy: FechaIso): Movimiento[] {
  return despensa
    .filter((i) => i.cantidad > 0 && caducado(i, hoy))
    .map((i) => ({ ingredienteId: i.ingredienteId, ubicacion: i.ubicacion, delta: -i.cantidad }));
}

/**
 * Aplica movimientos con las mismas reglas que la base de datos y devuelve la despensa nueva y los
 * movimientos aplicados (para poder deshacerlos). No modifica lo que recibe y, si algún movimiento
 * falla, no se aplica ninguno.
 *
 *  - El stock nunca queda negativo.
 *  - Una fila que llega a 0 pierde su caducidad.
 *  - Añadir stock a una fila vacía crea un lote nuevo, sin la caducidad del anterior.
 *  - No se mezcla stock nuevo con stock caducado: hay que tirar lo caducado antes (salvo al deshacer).
 */
export function aplicarMovimientos(
  despensa: readonly ItemDespensa[],
  movimientos: readonly Movimiento[],
  hoy: FechaIso,
): { despensa: ItemDespensa[]; aplicados: MovimientoAplicado[] } {
  const resultado = despensa.map((i) => ({ ...i }));
  const aplicados: MovimientoAplicado[] = [];

  for (const m of movimientos) {
    const item = resultado.find(
      (i) => i.ingredienteId === m.ingredienteId && i.ubicacion === m.ubicacion,
    );
    const caducaAntes = item?.caducaEn ?? null;
    const esDeshacer = m.restaurarCaducidad !== undefined;

    if (m.delta > 0) {
      if (item && item.cantidad > 0 && caducado(item, hoy) && !esDeshacer) {
        throw new StockCaducadoError(m.ingredienteId, m.ubicacion);
      }
      if (!item) {
        resultado.push({
          ingredienteId: m.ingredienteId,
          ubicacion: m.ubicacion,
          cantidad: redondear(m.delta),
          minimo: null,
          caducaEn: m.restaurarCaducidad ?? null,
        });
      } else if (item.cantidad === 0) {
        item.cantidad = redondear(m.delta);
        item.caducaEn = m.restaurarCaducidad ?? null;
      } else {
        item.cantidad = redondear(item.cantidad + m.delta);
      }
    } else {
      if (!item || redondear(item.cantidad + m.delta) < 0) {
        throw new StockInsuficienteError(m.ingredienteId, m.ubicacion);
      }
      item.cantidad = redondear(item.cantidad + m.delta);
      if (item.cantidad === 0) item.caducaEn = null;
    }
    aplicados.push({ ...m, caducaAntes });
  }
  return { despensa: resultado, aplicados };
}

/** Lo que caduca en los próximos `dias` días (incluido hoy): conviene gastarlo ya. */
export function proximosACaducar(
  despensa: readonly ItemDespensa[],
  hoy: FechaIso,
  dias = 3,
): ItemDespensa[] {
  const limite = sumarDias(hoy, dias);
  return despensa
    .filter((i) => i.cantidad > 0 && i.caducaEn !== null && enRango(i.caducaEn, hoy, limite))
    .sort((a, b) => (a.caducaEn ?? "").localeCompare(b.caducaEn ?? ""));
}

/** Ingredientes cuyo stock total (sin caducados) está por debajo de su mínimo. */
export function bajoMinimo(
  despensa: readonly ItemDespensa[],
  hoy: FechaIso,
): Array<{ ingredienteId: string; stock: number; minimo: number }> {
  const stock = stockUtilizable(despensa, hoy);
  const minimos = new Map<string, number>();
  for (const i of despensa) {
    if (i.minimo !== null)
      minimos.set(i.ingredienteId, Math.max(minimos.get(i.ingredienteId) ?? 0, i.minimo));
  }
  return [...minimos]
    .map(([ingredienteId, minimo]) => ({
      ingredienteId,
      minimo,
      stock: stock.get(ingredienteId) ?? 0,
    }))
    .filter((x) => x.stock < x.minimo)
    .sort((a, b) => a.ingredienteId.localeCompare(b.ingredienteId));
}
