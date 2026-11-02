import type { FechaIso } from "./fechas";
import { redondear, redondearArriba } from "./numeros";
import { stockUtilizable } from "./despensa";
import {
  type ComidaPlanificada,
  type Ingrediente,
  type ItemDespensa,
  SECCIONES,
  type Seccion,
  type Unidad,
} from "./tipos";

/**
 * Lista de la compra automática:
 *
 *   comprar = max(0, necesidad del menú + stock mínimo − stock utilizable)
 *
 * La necesidad es Σ cantidad por ración × raciones de cada comida elegida (sin ingredientes
 * opcionales). Lo caducado no cuenta como stock. Se redondea hacia arriba a un múltiplo de compra.
 */

export interface ArticuloCompra {
  ingredienteId: string;
  nombre: string;
  unidad: Unidad;
  seccion: Seccion;
  cantidad: number;
  /** Por qué está en la lista: «Cena del martes», «Stock mínimo». */
  motivos: string[];
  /** Si se ha cambiado la cantidad a mano, la que calculó la app. */
  calculada?: number;
}

/** Paso de compra por unidad: los gramos y mililitros se redondean a 50; las unidades, a 1. */
export const PASO_POR_UNIDAD: Record<Unidad, number> = { g: 50, ml: 50, ud: 1 };

export function calcularCompra(args: {
  comidas: readonly ComidaPlanificada[];
  despensa: readonly ItemDespensa[];
  ingredientes: ReadonlyMap<string, Ingrediente>;
  hoy: FechaIso;
  pasoPorUnidad?: Partial<Record<Unidad, number>>;
}): ArticuloCompra[] {
  const { comidas, despensa, ingredientes, hoy } = args;
  const pasos = { ...PASO_POR_UNIDAD, ...args.pasoPorUnidad };

  const necesidad = new Map<string, number>();
  const motivos = new Map<string, string[]>();
  for (const comida of comidas) {
    if (!(comida.raciones > 0)) continue;
    for (const ing of comida.plato.ingredientes) {
      if (ing.opcional) continue;
      const cantidad = ing.cantidadPorRacion * comida.raciones;
      necesidad.set(
        ing.ingredienteId,
        redondear((necesidad.get(ing.ingredienteId) ?? 0) + cantidad),
      );
      const lista = motivos.get(ing.ingredienteId) ?? [];
      if (!lista.includes(comida.etiqueta)) lista.push(comida.etiqueta);
      motivos.set(ing.ingredienteId, lista);
    }
  }

  const stock = stockUtilizable(despensa, hoy);
  const minimos = new Map<string, number>();
  for (const item of despensa) {
    if (item.minimo !== null) {
      minimos.set(item.ingredienteId, Math.max(minimos.get(item.ingredienteId) ?? 0, item.minimo));
    }
  }

  const ids = new Set([...necesidad.keys(), ...minimos.keys()]);
  const articulos: ArticuloCompra[] = [];
  for (const id of ids) {
    const ingrediente = ingredientes.get(id);
    if (!ingrediente) continue; // ingrediente desconocido: no se puede comprar sin nombre ni unidad

    const necesaria = necesidad.get(id) ?? 0;
    const minimo = minimos.get(id) ?? 0;
    const hay = stock.get(id) ?? 0;
    const falta = redondear(necesaria + minimo - hay);
    if (falta <= 0) continue;

    const razones = [...(motivos.get(id) ?? [])];
    // Si hay un mínimo, siempre suma a lo que falta, así que siempre es una de las razones.
    if (minimo > 0) razones.push("Stock mínimo");

    articulos.push({
      ingredienteId: id,
      nombre: ingrediente.nombre,
      unidad: ingrediente.unidad,
      seccion: ingrediente.seccion,
      cantidad: redondearArriba(falta, pasos[ingrediente.unidad]),
      motivos: razones,
    });
  }

  return articulos.sort(
    (a, b) =>
      SECCIONES.indexOf(a.seccion) - SECCIONES.indexOf(b.seccion) ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
}

/** Formato que espera `sincronizar_compra_auto` en la base de datos. */
export function aPayloadSincronizacion(
  articulos: readonly ArticuloCompra[],
): Array<{ ingrediente_id: string; cantidad: number; motivo: string }> {
  return articulos.map((a) => ({
    ingrediente_id: a.ingredienteId,
    cantidad: a.cantidad,
    motivo: a.motivos.join(" · ").slice(0, 100),
  }));
}
