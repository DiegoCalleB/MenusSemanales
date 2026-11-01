/** Redondea a `decimales` (por defecto 2, como las columnas `numeric(10,2)` de la base de datos). */
export function redondear(valor: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * f) / f;
}

/**
 * Redondea hacia arriba al siguiente múltiplo de `paso` (p. ej. comprar de 50 g en 50 g).
 * Tolera el ruido de coma flotante: 0,3 / 0,1 = 2,9999999999999996 debe dar 3, no 4.
 */
export function redondearArriba(valor: number, paso: number): number {
  if (!(paso > 0)) throw new RangeError("El paso debe ser positivo");
  if (valor <= 0) return 0;
  return redondear(Math.ceil(redondear(valor / paso, 6)) * paso);
}
