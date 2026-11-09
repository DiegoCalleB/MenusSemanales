import { claveArticulo } from "@/dominio/habituales";
import { SUPERMERCADOS, enlaceDeProducto } from "@/dominio/supermercado";

/**
 * El producto de la tienda online elegido para cada artículo (D-132): «leche» → el enlace de la
 * leche que se compra siempre. Se guarda en el móvil (no se sincroniza) por el nombre del artículo,
 * sin tildes ni mayúsculas, para que valga para «Leche» y «leche».
 */
export type ProductosOnline = Record<string, string>;

const CLAVE = "menus-semanales:productos-online";
const MAX_PRODUCTOS = 500;

/** La clave con la que se recuerda un artículo. */
export const claveDeProducto = (nombre: string): string => claveArticulo(nombre);

/** Lo guardado, solo lo que sigue siendo un enlace de producto de la tienda. */
export function leerProductos(): ProductosOnline {
  try {
    const crudo = JSON.parse(window.localStorage.getItem(CLAVE) ?? "null") as unknown;
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return {};
    const tienda = SUPERMERCADOS[0];
    if (!tienda) return {};
    const salida: ProductosOnline = {};
    for (const [k, v] of Object.entries(crudo).slice(0, MAX_PRODUCTOS)) {
      const enlace = typeof v === "string" ? enlaceDeProducto(tienda, v) : null;
      if (enlace && k !== "") salida[k] = enlace;
    }
    return salida;
  } catch {
    return {};
  }
}

export function guardarProductos(p: ProductosOnline): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    // sin almacenamiento: se recuerda hasta recargar
  }
}
