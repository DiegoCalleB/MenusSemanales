/**
 * Pasar la lista de la compra a un supermercado online (D-127). Ningún supermercado español ofrece
 * una API pública para que una aplicación de terceros llene el carrito o haga un pedido, así que la
 * app no compra por vosotros: abre, para cada artículo, la búsqueda de ese producto en la tienda
 * online. Quien compra sigue siendo la persona, con su propia cuenta; la app no guarda ni pide
 * ninguna contraseña.
 *
 * Cada supermercado es una entrada de `SUPERMERCADOS` con la forma de su dirección de búsqueda. Si
 * una tienda cambia la suya, se corrige aquí y nada más.
 */

export interface Supermercado {
  id: string;
  nombre: string;
  /** Página de inicio de la tienda online. */
  tienda: string;
  /** Dirección que abre la búsqueda de un producto. */
  buscar: (termino: string) => string;
}

export const SUPERMERCADOS: readonly Supermercado[] = [
  {
    id: "mercadona",
    nombre: "Mercadona",
    tienda: "https://tienda.mercadona.es",
    buscar: (termino) =>
      `https://tienda.mercadona.es/search-results?query=${encodeURIComponent(termino)}`,
  },
];

const MAX_TERMINO = 60;

/**
 * Lo que se busca de un artículo: su nombre sin lo que va entre paréntesis («Pollo (pechuga)» →
 * «Pollo»), sin espacios de más y con un máximo de largo.
 */
export function terminoDeBusqueda(nombre: string): string {
  return nombre
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TERMINO)
    .trim();
}

/** La dirección que abre en ese supermercado la búsqueda de un artículo de la lista. */
export const enlaceDeBusqueda = (supermercado: Supermercado, nombre: string): string =>
  supermercado.buscar(terminoDeBusqueda(nombre));
