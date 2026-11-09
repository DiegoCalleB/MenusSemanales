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

/**
 * El asistente de la compra online (D-131): se recorre la lista de un artículo en un artículo. Se
 * apunta qué artículos ya están en la cesta de la tienda y cuáles se han dejado para luego. Todo
 * son funciones puras sobre las claves de los artículos; guardarlo en el móvil es cosa de la
 * pantalla.
 */
export interface ProgresoOnline {
  /** Ya en la cesta de la tienda. */
  hechos: string[];
  /** Dejados para el final («Saltar»). */
  saltados: string[];
}

export const PROGRESO_VACIO: ProgresoOnline = { hechos: [], saltados: [] };

const sin = (lista: readonly string[], clave: string): string[] => lista.filter((c) => c !== clave);

/** Lo marca como ya en la cesta (y deja de estar «saltado»). */
export const marcarEnCesta = (p: ProgresoOnline, clave: string): ProgresoOnline => ({
  hechos: p.hechos.includes(clave) ? p.hechos : [...p.hechos, clave],
  saltados: sin(p.saltados, clave),
});

/** Lo quita de la cesta (por si se marcó sin querer). */
export const quitarDeCesta = (p: ProgresoOnline, clave: string): ProgresoOnline => ({
  hechos: sin(p.hechos, clave),
  saltados: p.saltados,
});

/** Lo deja para el final: pasa al siguiente y vuelve a salir cuando no quede otro. */
export const saltar = (p: ProgresoOnline, clave: string): ProgresoOnline => ({
  hechos: sin(p.hechos, clave),
  saltados: [...sin(p.saltados, clave), clave],
});

/** Se queda solo con lo que sigue en la lista (lo comprado o quitado ya no cuenta). */
export const podarProgreso = (p: ProgresoOnline, claves: readonly string[]): ProgresoOnline => ({
  hechos: p.hechos.filter((c) => claves.includes(c)),
  saltados: p.saltados.filter((c) => claves.includes(c)),
});

/**
 * El artículo que toca ahora: el primero de la lista que ni está en la cesta ni se ha saltado; si
 * no queda ninguno, el primero de los saltados (en el orden en que se saltaron); y `null` cuando
 * todo está ya en la cesta.
 */
export function articuloActual(claves: readonly string[], p: ProgresoOnline): string | null {
  const nuevo = claves.find((c) => !p.hechos.includes(c) && !p.saltados.includes(c));
  if (nuevo !== undefined) return nuevo;
  return p.saltados.find((c) => claves.includes(c) && !p.hechos.includes(c)) ?? null;
}

/** Cuántos de la lista están ya en la cesta, de cuántos. */
export const contarEnCesta = (
  claves: readonly string[],
  p: ProgresoOnline,
): { hechos: number; total: number } => ({
  hechos: claves.filter((c) => p.hechos.includes(c)).length,
  total: claves.length,
});

/**
 * Recordar el producto elegido (D-132). La app no puede ver qué producto se elige en la tienda, así
 * que la persona pega su enlace («Compartir → Copiar enlace» en la web de Mercadona). Solo se
 * aceptan enlaces https de la propia tienda: nunca se abre una dirección de otro sitio.
 */

/** El primer enlace de un texto pegado («Mira esto https://…» al compartir), o null. */
export function extraerEnlace(texto: string): string | null {
  const m = /https?:\/\/[^\s<>"']+/i.exec(texto);
  return m ? m[0] : null;
}

/**
 * La dirección limpia (sin parámetros ni «#») de un producto de esa tienda, o null si el texto no
 * es un enlace https de su dominio, o es la portada o una búsqueda y no un producto.
 */
export function enlaceDeProducto(supermercado: Supermercado, texto: string): string | null {
  try {
    const u = new URL(extraerEnlace(texto) ?? texto.trim());
    const tienda = new URL(supermercado.tienda);
    if (u.protocol !== "https:" || u.host !== tienda.host) return null;
    const ruta = u.pathname.replace(/\/+$/, "");
    if (ruta === "" || ruta.startsWith("/search-results")) return null;
    return `${u.origin}${ruta}`;
  } catch {
    return null;
  }
}

/** Un nombre legible a partir del enlace («…/leche-entera-hacendado» → «Leche entera hacendado»). */
export function nombreDeProducto(enlace: string): string {
  try {
    const ultimo = new URL(enlace).pathname.split("/").filter(Boolean).pop() ?? "";
    const palabras = decodeURIComponent(ultimo).replace(/[-_]+/g, " ").trim();
    if (palabras === "" || /^\d+$/.test(palabras)) return "Producto guardado";
    return palabras.charAt(0).toUpperCase() + palabras.slice(1);
  } catch {
    return "Producto guardado";
  }
}
